#!/usr/bin/env node
/**
 * Provision the PayPal product + six subscription plans via the REST API.
 *
 * WHY THIS IS A SCRIPT YOU RUN, not something the assistant runs: the client
 * secret lives only in your environment. Vercel withholds sensitive values from
 * `vercel env pull`, and pasting a secret into a chat transcript is worse than
 * running one command. This reads the credentials from your own environment,
 * talks to PayPal directly, and prints only ids.
 *
 * IDEMPOTENT: run it as many times as you like. It reuses an existing product
 * or plan with the same name instead of creating duplicates, so a partial run
 * is safe to repeat.
 *
 * Usage:
 *   PAYPAL_CLIENT_ID=... PAYPAL_CLIENT_SECRET=... \
 *   PAYPAL_ENVIRONMENT=sandbox node scripts/paypal-provision.mjs
 *
 * Nothing is written to the repo, and no money moves — creating plans is free.
 */

const CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const ENVIRONMENT = process.env.PAYPAL_ENVIRONMENT || 'sandbox';
const BASE =
  ENVIRONMENT === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';

const PRODUCT_NAME = 'MetaTradee';

/**
 * Must match src/features/billing/pricing.ts exactly. If these drift, the app
 * refuses the subscription rather than honouring a mismatched price — so a typo
 * here surfaces as a rejected checkout, not a silent wrong charge.
 */
const PLANS = [
  { key: 'TRADER_MONTHLY', name: 'Trader Monthly', value: '19.00', unit: 'MONTH' },
  { key: 'TRADER_YEARLY', name: 'Trader Yearly', value: '190.00', unit: 'YEAR' },
  { key: 'PRO_MONTHLY', name: 'Pro Monthly', value: '39.00', unit: 'MONTH' },
  { key: 'PRO_YEARLY', name: 'Pro Yearly', value: '390.00', unit: 'YEAR' },
  { key: 'FUNDED_MONTHLY', name: 'Funded Monthly', value: '59.00', unit: 'MONTH' },
  { key: 'FUNDED_YEARLY', name: 'Funded Yearly', value: '590.00', unit: 'YEAR' },
];

function die(msg, detail) {
  console.error(`\n✖ ${msg}`);
  if (detail) console.error(typeof detail === 'string' ? detail : JSON.stringify(detail, null, 2));
  process.exit(1);
}

if (!CLIENT_ID || !CLIENT_SECRET) {
  die(
    'PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET must be set in your shell.\n' +
      '  Get them from the PayPal Developer dashboard → Apps & Credentials → your Sandbox app.\n' +
      '  Example:\n' +
      '    PAYPAL_CLIENT_ID=xxx PAYPAL_CLIENT_SECRET=yyy node scripts/paypal-provision.mjs',
  );
}

/** Surfaces PayPal's own error body verbatim — that is what you need to debug. */
async function api(path, { method = 'GET', token, body, requestId } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  // PayPal de-duplicates creates keyed on this header.
  if (requestId) headers['PayPal-Request-Id'] = requestId;

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
  if (!res.ok || !json.access_token) {
    die(
      `PayPal authentication failed (HTTP ${res.status}) against ${BASE}.\n` +
        '  This is the exact error PayPal returned:',
      json,
    );
  }
  console.log(`✓ Authenticated against ${ENVIRONMENT} (${BASE})`);
  return json.access_token;
}

async function findOrCreateProduct(token) {
  // Paginate rather than assuming the product is on page 1.
  for (let page = 1; page <= 10; page++) {
    const list = await api(`/v1/catalogs/products?page_size=20&page=${page}`, { token });
    if (!list.ok) die(`Could not list products (HTTP ${list.status})`, list.json);
    const products = list.json.products ?? [];
    const hit = products.find((p) => p.name === PRODUCT_NAME);
    if (hit) {
      console.log(`✓ Reusing existing product "${PRODUCT_NAME}"`);
      return hit.id;
    }
    if (products.length < 20) break;
  }

  const created = await api('/v1/catalogs/products', {
    method: 'POST',
    token,
    requestId: `metatradee-product-${PRODUCT_NAME}`,
    body: {
      name: PRODUCT_NAME,
      description: 'Trading journal, analytics and review tooling.',
      type: 'SERVICE',
      category: 'SOFTWARE',
    },
  });
  if (!created.ok) {
    die(
      `Could not create the product (HTTP ${created.status}).\n` +
        '  If this says PERMISSION_DENIED or NOT_AUTHORIZED, the Sandbox app is\n' +
        "  missing the Subscriptions feature. This is PayPal's exact response:",
      created.json,
    );
  }
  console.log(`✓ Created product "${PRODUCT_NAME}"`);
  return created.json.id;
}

async function listAllPlans(token, productId) {
  const out = [];
  for (let page = 1; page <= 10; page++) {
    const res = await api(
      `/v1/billing/plans?product_id=${encodeURIComponent(productId)}&page_size=20&page=${page}`,
      { token },
    );
    if (!res.ok) die(`Could not list plans (HTTP ${res.status})`, res.json);
    const plans = res.json.plans ?? [];
    out.push(...plans);
    if (plans.length < 20) break;
  }
  return out;
}

async function findOrCreatePlan(token, productId, existing, spec) {
  const hit = existing.find((p) => p.name === spec.name);
  if (hit) {
    if (hit.status !== 'ACTIVE') {
      const act = await api(`/v1/billing/plans/${hit.id}/activate`, { method: 'POST', token });
      if (!act.ok && act.status !== 422) {
        die(`Could not activate existing plan ${spec.name} (HTTP ${act.status})`, act.json);
      }
      console.log(`✓ Reused and activated "${spec.name}"`);
    } else {
      console.log(`✓ Reusing active plan "${spec.name}"`);
    }
    return hit.id;
  }

  const created = await api('/v1/billing/plans', {
    method: 'POST',
    token,
    requestId: `metatradee-plan-${spec.key}`,
    body: {
      product_id: productId,
      name: spec.name,
      description: `MetaTradee ${spec.name}`,
      // ACTIVE at creation, so no separate activate call is needed.
      status: 'ACTIVE',
      billing_cycles: [
        {
          frequency: { interval_unit: spec.unit, interval_count: 1 },
          tenure_type: 'REGULAR',
          sequence: 1,
          // 0 = renew indefinitely until cancelled.
          total_cycles: 0,
          pricing_scheme: {
            fixed_price: { value: spec.value, currency_code: 'USD' },
          },
        },
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee_failure_action: 'CONTINUE',
        // After 3 consecutive failures PayPal suspends; our webhook maps
        // SUSPENDED to past_due and stops granting the paid tier.
        payment_failure_threshold: 3,
      },
    },
  });
  if (!created.ok) {
    die(`Could not create plan "${spec.name}" (HTTP ${created.status})`, created.json);
  }
  console.log(`✓ Created "${spec.name}"`);
  return created.json.id;
}

const token = await authenticate();
const productId = await findOrCreateProduct(token);
const existing = await listAllPlans(token, productId);

const ids = {};
for (const spec of PLANS) {
  ids[spec.key] = await findOrCreatePlan(token, productId, existing, spec);
}

console.log('\n────────────────────────────────────────────────');
console.log(`PRODUCT ID: ${productId}`);
console.log('────────────────────────────────────────────────');
for (const spec of PLANS) console.log(`${spec.name.padEnd(16)} ${ids[spec.key]}`);
console.log('\n── Add these to Vercel PREVIEW ─────────────────');
for (const spec of PLANS) {
  console.log(`PAYPAL_${spec.key}_PLAN_ID=${ids[spec.key]}`);
}
console.log('\nOr paste-and-run:');
for (const spec of PLANS) {
  console.log(
    `printf '%s' "${ids[spec.key]}" | npx vercel env add PAYPAL_${spec.key}_PLAN_ID preview`,
  );
}
console.log(
  '\nStill needed separately: PAYPAL_WEBHOOK_ID (create the webhook, then add it).\n' +
    'The plan ids above are NOT secrets — they are safe to share.',
);
