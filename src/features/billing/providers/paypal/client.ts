/**
 * PayPal REST client — SERVER ONLY.
 *
 * Everything that decides money or access happens here, against PayPal's API,
 * never against anything the browser said. The browser can only ever hand us a
 * subscription id; this module goes and asks PayPal what that id actually is.
 *
 * Secrets: the client secret is read from server env and used solely as HTTP
 * Basic auth. It is never logged, never returned, and never embedded in an
 * error. `import 'server-only'` makes an accidental client import a build
 * error rather than a leak.
 */
import 'server-only';
import { serverEnv } from '@/config/env';

const SANDBOX = 'https://api-m.sandbox.paypal.com';
const LIVE = 'https://api-m.paypal.com';

/** Bounded so a hung PayPal call cannot pin a serverless invocation open. */
const TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 3;

export class PayPalNotConfiguredError extends Error {
  readonly code = 'paypal_not_configured' as const;
  constructor(missing: string[]) {
    // Names only — never values.
    super(`PayPal is not configured. Missing: ${missing.join(', ')}`);
    this.name = 'PayPalNotConfiguredError';
  }
}

export class PayPalApiError extends Error {
  readonly code = 'paypal_api_error' as const;
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'PayPalApiError';
  }
}

export interface PayPalConfig {
  clientId: string;
  clientSecret: string;
  webhookId: string;
  baseUrl: string;
  environment: 'sandbox' | 'live';
}

/** Which required server variables are absent. Names only. */
export function missingPayPalEnvKeys(): string[] {
  const env = serverEnv();
  const missing: string[] = [];
  if (!env.PAYPAL_CLIENT_ID) missing.push('PAYPAL_CLIENT_ID');
  if (!env.PAYPAL_CLIENT_SECRET) missing.push('PAYPAL_CLIENT_SECRET');
  if (!env.PAYPAL_WEBHOOK_ID) missing.push('PAYPAL_WEBHOOK_ID');
  return missing;
}

export function isPayPalConfigured(): boolean {
  return missingPayPalEnvKeys().length === 0;
}

/** Resolve config or throw. Fails CLOSED — never falls back to a default. */
export function payPalConfig(): PayPalConfig {
  const missing = missingPayPalEnvKeys();
  if (missing.length > 0) throw new PayPalNotConfiguredError(missing);
  const env = serverEnv();
  const environment = env.PAYPAL_ENVIRONMENT ?? 'sandbox';
  return {
    clientId: env.PAYPAL_CLIENT_ID as string,
    clientSecret: env.PAYPAL_CLIENT_SECRET as string,
    webhookId: env.PAYPAL_WEBHOOK_ID as string,
    environment,
    baseUrl: environment === 'live' ? LIVE : SANDBOX,
  };
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Retry only what is safe to retry: network faults and 5xx/429. A 4xx is a
 * decision by PayPal and is never retried — retrying an auth failure just
 * burns the rate limit.
 */
async function requestWithRetry(url: string, init: RequestInit): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetchWithTimeout(url, init);
      if (res.status < 500 && res.status !== 429) return res;
      lastError = new PayPalApiError(res.status, `PayPal responded ${res.status}`);
    } catch (e) {
      lastError = e;
    }
    if (attempt < MAX_ATTEMPTS) {
      // Exponential backoff with jitter.
      const delay = 250 * 2 ** (attempt - 1) + Math.floor(Math.random() * 100);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  if (lastError instanceof PayPalApiError) throw lastError;
  throw new PayPalApiError(502, 'PayPal request failed');
}

/**
 * OAuth2 access token. Cached in module scope until shortly before expiry —
 * a serverless instance handling several webhooks should not re-authenticate
 * for each one.
 */
let cachedToken: { token: string; expiresAt: number } | null = null;

export async function accessToken(cfg: PayPalConfig = payPalConfig()): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) return cachedToken.token;

  const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64');
  const res = await requestWithRetry(`${cfg.baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) {
    // Deliberately does not include the body — it can echo credentials.
    throw new PayPalApiError(res.status, 'PayPal authentication failed');
  }
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new PayPalApiError(502, 'PayPal returned no access token');
  cachedToken = {
    token: json.access_token,
    expiresAt: now + (json.expires_in ?? 300) * 1000,
  };
  return cachedToken.token;
}

/** Test seam: drop the cached token. */
export function __resetTokenCache(): void {
  cachedToken = null;
}

/** The subset of a PayPal subscription we rely on. */
export interface PayPalSubscription {
  id: string;
  plan_id: string;
  status: string;
  /** Our user id, set as `custom_id` at creation — how we map back to a user. */
  custom_id?: string;
  start_time?: string;
  status_update_time?: string;
  billing_info?: {
    next_billing_time?: string;
    last_payment?: { time?: string };
    cycle_executions?: unknown[];
  };
}

/**
 * Read a subscription straight from PayPal. This is the authority — the object
 * returned here is what decides the plan, never a value from the browser.
 */
export async function getSubscription(
  subscriptionId: string,
  cfg: PayPalConfig = payPalConfig(),
): Promise<PayPalSubscription> {
  const token = await accessToken(cfg);
  const res = await requestWithRetry(
    `${cfg.baseUrl}/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`,
    { method: 'GET', headers: { Authorization: `Bearer ${token}` } },
  );
  if (res.status === 404) throw new PayPalApiError(404, 'Subscription not found');
  if (!res.ok) throw new PayPalApiError(res.status, 'Could not read the subscription');
  return (await res.json()) as PayPalSubscription;
}

/** Cancel at PayPal. Only called when the app genuinely supports it. */
export async function cancelSubscription(
  subscriptionId: string,
  reason: string,
  cfg: PayPalConfig = payPalConfig(),
): Promise<void> {
  const token = await accessToken(cfg);
  const res = await requestWithRetry(
    `${cfg.baseUrl}/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason.slice(0, 127) }),
    },
  );
  // 204 on success; 422 when it is already cancelled, which is not an error.
  if (!res.ok && res.status !== 422) {
    throw new PayPalApiError(res.status, 'Could not cancel the subscription');
  }
}

export interface WebhookHeaders {
  transmissionId: string | null;
  transmissionTime: string | null;
  transmissionSig: string | null;
  certUrl: string | null;
  authAlgo: string | null;
}

/** Pull the signature headers PayPal sends. Missing ones stay null → reject. */
export function webhookHeadersFrom(headers: Headers): WebhookHeaders {
  return {
    transmissionId: headers.get('paypal-transmission-id'),
    transmissionTime: headers.get('paypal-transmission-time'),
    transmissionSig: headers.get('paypal-transmission-sig'),
    certUrl: headers.get('paypal-cert-url'),
    authAlgo: headers.get('paypal-auth-algo'),
  };
}

/**
 * Verify a webhook with PayPal's verify-webhook-signature API.
 *
 * We deliberately ask PayPal rather than validating the certificate chain
 * ourselves: PayPal rotates certs, and a home-grown verifier that silently
 * degrades is worse than no verifier. Any error, any missing header, and any
 * answer other than SUCCESS is a rejection.
 */
export async function verifyWebhookSignature(
  rawBody: string,
  headers: WebhookHeaders,
  cfg: PayPalConfig = payPalConfig(),
): Promise<boolean> {
  if (
    !headers.transmissionId ||
    !headers.transmissionTime ||
    !headers.transmissionSig ||
    !headers.certUrl ||
    !headers.authAlgo
  ) {
    return false;
  }
  // Only accept a cert served by PayPal itself.
  try {
    const host = new URL(headers.certUrl).hostname;
    if (!/(^|\.)paypal\.com$/i.test(host)) return false;
  } catch {
    return false;
  }

  let parsedEvent: unknown;
  try {
    parsedEvent = JSON.parse(rawBody);
  } catch {
    return false;
  }

  try {
    const token = await accessToken(cfg);
    const res = await requestWithRetry(`${cfg.baseUrl}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transmission_id: headers.transmissionId,
        transmission_time: headers.transmissionTime,
        transmission_sig: headers.transmissionSig,
        cert_url: headers.certUrl,
        auth_algo: headers.authAlgo,
        webhook_id: cfg.webhookId,
        webhook_event: parsedEvent,
      }),
    });
    if (!res.ok) return false;
    const json = (await res.json()) as { verification_status?: string };
    return json.verification_status === 'SUCCESS';
  } catch {
    // A verification failure must never be treated as a pass.
    return false;
  }
}
