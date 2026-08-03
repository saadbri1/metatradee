#!/usr/bin/env node
/**
 * ADD event types to the EXISTING PayPal Sandbox webhook. Nothing else.
 *
 * Deliberately separate from scripts/paypal-webhook.mjs, which provisions a
 * webhook from scratch and would be actively destructive here: it PATCHes
 * `/event_types` with `op: replace` against its own hardcoded subscription
 * list, ignores PAYPAL_WEBHOOK_ID, and CREATES a webhook when it finds no URL
 * match. Running it to add two events would drop every event it does not know
 * about and could leave you with a second webhook.
 *
 * This script instead:
 *   - addresses the webhook by its EXISTING id (PAYPAL_WEBHOOK_ID)
 *   - never creates, and never deletes, a webhook
 *   - never touches the URL
 *   - computes the UNION of what is already registered with what is being
 *     added, so nothing currently subscribed is lost
 *   - re-reads from PayPal afterwards and refuses to report success unless
 *     BOTH the new events are present AND every previously-registered event
 *     survived
 *
 * PayPal's webhook PATCH has no "append" operation — `/event_types` can only be
 * replaced as a whole array. Preserving the existing set is therefore something
 * this script must do explicitly, which is exactly where a careless update
 * silently unsubscribes half your events.
 *
 * Usage:
 *   PAYPAL_CLIENT_ID=... PAYPAL_CLIENT_SECRET=... PAYPAL_WEBHOOK_ID=... \
 *     node scripts/paypal-webhook-add-events.mjs
 *
 * Add --dry-run to read and report the plan WITHOUT writing anything.
 *
 * Sandbox only. It refuses to run against live. It issues no refunds, changes
 * no application code, and touches nothing in Production.
 */

const CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID;
const ENVIRONMENT = process.env.PAYPAL_ENVIRONMENT || 'sandbox';
const DRY_RUN = process.argv.includes('--dry-run');

/** Exactly the two events being added. Nothing else is introduced. */
const EVENTS_TO_ADD = ['PAYMENT.CAPTURE.REFUNDED', 'PAYMENT.CAPTURE.REVERSED'];

function die(msg, detail) {
  console.error(`\n✖ ${msg}`);
  if (detail) console.error(typeof detail === 'string' ? detail : JSON.stringify(detail, null, 2));
  process.exit(1);
}

if (ENVIRONMENT !== 'sandbox') {
  die('Refusing to run: this script is sandbox-only.\n  Set PAYPAL_ENVIRONMENT=sandbox.');
}
const BASE = 'https://api-m.sandbox.paypal.com';

if (!CLIENT_ID || !CLIENT_SECRET || !WEBHOOK_ID) {
  die(
    'PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET and PAYPAL_WEBHOOK_ID must all be set.\n' +
      '  The webhook id is required BECAUSE this script updates an existing\n' +
      '  webhook and must never create a second one.\n\n' +
      '  PAYPAL_CLIENT_ID=xxx PAYPAL_CLIENT_SECRET=yyy PAYPAL_WEBHOOK_ID=zzz \\\n' +
      '    node scripts/paypal-webhook-add-events.mjs',
  );
}

async function api(path, { method = 'GET', token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  return { ok: res.ok, status: res.status, json };
}

async function authenticate() {
  const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const json = await res.json().catch(() => ({}));
  // Never echo the body on failure — it can contain credential material.
  if (!res.ok || !json.access_token) {
    die(`PayPal authentication failed (HTTP ${res.status}).`, {
      name: json.error,
      description: json.error_description,
    });
  }
  return json.access_token;
}

const names = (hook) => (hook.event_types ?? []).map((e) => e.name);

const token = await authenticate();

// 1. Read the EXISTING webhook by id. No listing, no matching, no creating.
const before = await api(`/v1/notifications/webhooks/${WEBHOOK_ID}`, { token });
if (before.status === 404) {
  die(
    `No webhook with id ${WEBHOOK_ID} exists on this PayPal app.\n` +
      '  Check that PAYPAL_CLIENT_ID belongs to the same app the webhook was\n' +
      '  created under — a webhook is scoped to one app.',
  );
}
if (!before.ok) die(`Could not read the webhook (HTTP ${before.status})`, before.json);

const existingEvents = names(before.json);
const webhookUrl = before.json.url;

console.log('Existing webhook');
console.log(`  id  : ${WEBHOOK_ID}`);
console.log(`  url : ${webhookUrl}`);
console.log(`  events (${existingEvents.length}):`);
for (const n of [...existingEvents].sort()) console.log(`    ${n}`);

const missing = EVENTS_TO_ADD.filter((e) => !existingEvents.includes(e));
if (missing.length === 0) {
  console.log('\n✓ Both events are already registered. Nothing to do.');
  console.log('\n────────────────────────────────────────');
  console.log(`PAYPAL_WEBHOOK_ID=${WEBHOOK_ID}`);
  console.log(`URL=${webhookUrl}`);
  console.log('────────────────────────────────────────');
  console.log(`Confirmed events (${existingEvents.length}):`);
  for (const n of [...existingEvents].sort()) console.log(`  ${n}`);
  process.exit(0);
}

/*
 * THE UNION. PayPal can only replace the whole array, so every currently
 * registered event has to be sent back alongside the new ones or it is
 * silently unsubscribed. Deduplicated and sorted for a stable diff.
 */
const union = [...new Set([...existingEvents, ...EVENTS_TO_ADD])].sort();

console.log(`\nAdding (${missing.length}):`);
for (const n of missing) console.log(`  + ${n}`);
console.log(`Resulting set will contain ${union.length} events.`);

if (DRY_RUN) {
  console.log('\n--dry-run: nothing was written.');
  process.exit(0);
}

// 2. PATCH only /event_types. The URL is never included, so it cannot change.
const patch = await api(`/v1/notifications/webhooks/${WEBHOOK_ID}`, {
  method: 'PATCH',
  token,
  body: [{ op: 'replace', path: '/event_types', value: union.map((name) => ({ name })) }],
});
if (!patch.ok) die(`Could not update the webhook (HTTP ${patch.status})`, patch.json);

// 3. Verify by RE-READING from PayPal rather than trusting the PATCH response.
const after = await api(`/v1/notifications/webhooks/${WEBHOOK_ID}`, { token });
if (!after.ok) die(`Could not re-read the webhook (HTTP ${after.status})`, after.json);

const confirmed = names(after.json).sort();

// 3a. Both new events must be present.
const stillMissing = EVENTS_TO_ADD.filter((e) => !confirmed.includes(e));
if (stillMissing.length) {
  die('PayPal did not subscribe every requested event.', { missing: stillMissing });
}

// 3b. Nothing that was registered before may have been lost. This is the check
//     that makes "preserve all currently registered events" a guarantee rather
//     than an intention.
const lost = existingEvents.filter((e) => !confirmed.includes(e));
if (lost.length) {
  die(
    'Events that were previously registered are GONE after the update.\n' +
      '  Re-add them immediately — deliveries for these are being dropped.',
    { lost },
  );
}

// 3c. The URL must be untouched.
if (after.json.url !== webhookUrl) {
  die(`The webhook URL changed, which this script must never do.\n  now: ${after.json.url}`);
}

console.log('\n✓ Update verified by re-reading from PayPal');
console.log(`✓ All ${existingEvents.length} previously registered event(s) preserved`);
console.log('\n────────────────────────────────────────');
console.log(`PAYPAL_WEBHOOK_ID=${WEBHOOK_ID}`);
console.log(`URL=${webhookUrl}`);
console.log('────────────────────────────────────────');
console.log(`Confirmed events (${confirmed.length}):`);
for (const n of confirmed) console.log(`  ${n}`);
console.log('\nNo refund was issued. No application code changed.');
