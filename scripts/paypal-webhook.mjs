#!/usr/bin/env node
/**
 * Create (or reuse) the PayPal Sandbox webhook via the REST API, because the
 * dashboard's "Create webhook" is failing.
 *
 * Runs on your machine so the client secret is never printed, logged, or sent
 * anywhere except PayPal's own token endpoint. It prints ONLY the webhook id
 * and the subscribed event names.
 *
 * Usage:
 *   PAYPAL_CLIENT_ID=... PAYPAL_CLIENT_SECRET=... node scripts/paypal-webhook.mjs
 *
 * Sandbox only. It refuses to run against live.
 */

const CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const ENVIRONMENT = process.env.PAYPAL_ENVIRONMENT || 'sandbox';

if (ENVIRONMENT !== 'sandbox') {
  console.error('\n✖ Refusing to run: this script is sandbox-only.');
  console.error('  Unset PAYPAL_ENVIRONMENT or set it to "sandbox".');
  process.exit(1);
}
const BASE = 'https://api-m.sandbox.paypal.com';

/**
 * The VERIFIED branch alias. Vercel truncates long branch names and appends a
 * hash, so the "obvious" full-length hostname does not resolve — registering it
 * gives you a webhook that silently delivers nowhere. Override only with a URL
 * you have actually curled.
 */
const WEBHOOK_URL =
  process.env.PAYPAL_WEBHOOK_URL ||
  'https://metatradee-git-review-chart-light-worksp-ff8e28-lamsa-marketing.vercel.app/api/billing/paypal/webhook';

const EVENTS = [
  'BILLING.SUBSCRIPTION.CREATED',
  'BILLING.SUBSCRIPTION.ACTIVATED',
  'BILLING.SUBSCRIPTION.UPDATED',
  'BILLING.SUBSCRIPTION.SUSPENDED',
  'BILLING.SUBSCRIPTION.CANCELLED',
  'BILLING.SUBSCRIPTION.EXPIRED',
  'BILLING.SUBSCRIPTION.PAYMENT.FAILED',
];

function die(msg, detail) {
  console.error(`\n✖ ${msg}`);
  if (detail) console.error(typeof detail === 'string' ? detail : JSON.stringify(detail, null, 2));
  process.exit(1);
}

if (!CLIENT_ID || !CLIENT_SECRET) {
  die(
    'PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET must be set in your shell.\n' +
      '  PAYPAL_CLIENT_ID=xxx PAYPAL_CLIENT_SECRET=yyy node scripts/paypal-webhook.mjs',
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

/**
 * Refuse to register an endpoint that is not actually reachable. PayPal will
 * accept a URL it cannot reach and then fail every delivery silently, which is
 * exactly the failure mode this guards against.
 */
async function assertReachable(url) {
  try {
    const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(15000) });
    // Our route answers 405 to GET; anything that responds at all proves DNS,
    // TLS and routing work.
    if (res.status >= 500) {
      die(`The webhook URL responded ${res.status}. Fix the deployment before registering it.`);
    }
    console.log(`✓ Endpoint reachable (HTTP ${res.status})`);
  } catch (e) {
    die(
      `The webhook URL is NOT reachable, so PayPal could never deliver to it:\n  ${url}\n` +
        '  Check the hostname — Vercel truncates long branch aliases and adds a hash.',
      String(e.message || e),
    );
  }
}

/** Same URL and exactly the same event set, order-independent. */
function isExactMatch(hook) {
  if (hook.url !== WEBHOOK_URL) return false;
  const have = (hook.event_types ?? []).map((e) => e.name).sort();
  const want = [...EVENTS].sort();
  return have.length === want.length && have.every((n, i) => n === want[i]);
}

const token = await authenticate();
await assertReachable(WEBHOOK_URL);

// 1. List existing webhooks first, so we never create a duplicate.
const list = await api('/v1/notifications/webhooks', { token });
if (!list.ok) die(`Could not list webhooks (HTTP ${list.status})`, list.json);
const existing = list.json.webhooks ?? [];
console.log(`✓ ${existing.length} existing webhook(s) on this app`);

let webhookId = null;

const exact = existing.find(isExactMatch);
if (exact) {
  console.log('✓ Reusing an existing webhook that already matches exactly');
  webhookId = exact.id;
} else {
  const sameUrl = existing.find((h) => h.url === WEBHOOK_URL);
  if (sameUrl) {
    // Same URL, different events — patch rather than create a second one.
    console.log('✓ Webhook exists for this URL with different events — updating in place');
    const patch = await api(`/v1/notifications/webhooks/${sameUrl.id}`, {
      method: 'PATCH',
      token,
      body: [{ op: 'replace', path: '/event_types', value: EVENTS.map((name) => ({ name })) }],
    });
    if (!patch.ok) die(`Could not update the webhook (HTTP ${patch.status})`, patch.json);
    webhookId = sameUrl.id;
  } else {
    const created = await api('/v1/notifications/webhooks', {
      method: 'POST',
      token,
      body: { url: WEBHOOK_URL, event_types: EVENTS.map((name) => ({ name })) },
    });
    if (!created.ok) {
      die(
        `Could not create the webhook (HTTP ${created.status}).\n` +
          '  WEBHOOK_URL_ALREADY_EXISTS → it is on another app; delete it there first.\n' +
          '  WEBHOOK_NUMBER_LIMIT_EXCEEDED → this app already has the maximum.\n' +
          "  This is PayPal's exact response:",
        created.json,
      );
    }
    console.log('✓ Created a new webhook');
    webhookId = created.json.id;
  }
}

// 2. Verify by RE-READING from PayPal rather than trusting the create response.
const verify = await api(`/v1/notifications/webhooks/${webhookId}`, { token });
if (!verify.ok) die(`Could not verify the webhook (HTTP ${verify.status})`, verify.json);

const confirmedUrl = verify.json.url;
const confirmedEvents = (verify.json.event_types ?? []).map((e) => e.name).sort();

if (confirmedUrl !== WEBHOOK_URL) {
  die(`PayPal reports a different URL than requested:\n  ${confirmedUrl}`);
}
const missing = EVENTS.filter((e) => !confirmedEvents.includes(e));
if (missing.length) die('PayPal did not subscribe every requested event.', { missing });

console.log('\n────────────────────────────────────────');
console.log(`PAYPAL_WEBHOOK_ID=${webhookId}`);
console.log('────────────────────────────────────────');
console.log('Subscribed events:');
for (const name of confirmedEvents) console.log(`  ${name}`);
console.log('\nAdd it to Vercel Preview:');
console.log(`  printf '%s' "${webhookId}" | npx vercel env add PAYPAL_WEBHOOK_ID preview`);
console.log('Then redeploy. The webhook id is not a secret.');
