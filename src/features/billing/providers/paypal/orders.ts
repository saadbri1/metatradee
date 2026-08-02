/**
 * PayPal ORDERS v2 — SERVER ONLY.
 *
 * One-time payments, not subscriptions. Two calls make up the whole flow:
 * create an order for an amount WE compute, then capture it and read back what
 * PayPal says actually happened.
 *
 * The browser's role is reduced to relaying an order id. It never sends an
 * amount, a tier, a duration or a user id that we then believe — every one of
 * those is derived here or read back from PayPal. That is the entire security
 * model of this file.
 */
import 'server-only';
import { accessToken, payPalConfig, PayPalApiError, type PayPalConfig } from './client';

/**
 * A PayPal error carrying its machine-readable `issue`.
 *
 * The one that matters is ORDER_ALREADY_CAPTURED: it is not a failure but
 * PayPal refusing to charge twice, and the caller must resolve it against the
 * payment we already recorded rather than treating it as a declined payment.
 */
export class PayPalOrderError extends PayPalApiError {
  readonly issue: string | null;
  constructor(status: number, issue: string | null, message: string) {
    super(status, message);
    this.issue = issue;
    this.name = 'PayPalOrderError';
  }
}

export const ALREADY_CAPTURED = 'ORDER_ALREADY_CAPTURED';

/** The currency PayPal is charged in. Uppercase, as the API requires. */
export const ORDER_CURRENCY = 'USD' as const;

/**
 * Cents → PayPal's decimal string. PayPal rejects `19` and `19.0`; it wants
 * exactly two decimal places. Integer arithmetic throughout — a float would
 * eventually produce `18.999999999999996` and a rejected order.
 */
export function formatAmount(cents: number): string {
  if (!Number.isInteger(cents) || cents <= 0) {
    throw new PayPalApiError(400, 'Amount must be a positive whole number of cents.');
  }
  const whole = Math.floor(cents / 100);
  const rest = cents % 100;
  return `${whole}.${String(rest).padStart(2, '0')}`;
}

/** Inverse of formatAmount, for comparing PayPal's answer against our price. */
export function parseAmount(value: string): number | null {
  if (!/^\d+\.\d{2}$/.test(value)) return null;
  const [whole, rest] = value.split('.');
  return Number(whole) * 100 + Number(rest);
}

/** The subset of a PayPal order/capture response this app relies on. */
export interface PayPalCaptureDetail {
  id?: string;
  status?: string;
  amount?: { value?: string; currency_code?: string };
  /*
   * THE OWNER, as the CAPTURE response returns it.
   *
   * custom_id is set on the purchase unit at creation, and a GET of the order
   * echoes it back at `purchase_units[].custom_id`. The CAPTURE response does
   * not: it returns a trimmed purchase unit and moves custom_id down onto the
   * capture object itself. Reading only the purchase-unit copy therefore found
   * `undefined` on every real capture and rejected the payment as "not yours".
   */
  custom_id?: string;
  invoice_id?: string;
  create_time?: string;
  update_time?: string;
}

export interface PayPalPurchaseUnit {
  /** We set this to `tier:interval` at creation — PayPal echoes it back. */
  reference_id?: string;
  /** We set this to the buyer's MetaTradee user id at creation. */
  custom_id?: string;
  amount?: { value?: string; currency_code?: string };
  payments?: { captures?: PayPalCaptureDetail[] };
}

export interface PayPalOrder {
  id?: string;
  status?: string;
  purchase_units?: PayPalPurchaseUnit[];
}

async function callOrders(
  path: string,
  init: RequestInit,
  cfg: PayPalConfig,
  requestId?: string,
): Promise<PayPalOrder> {
  const token = await accessToken(cfg);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  /*
   * PayPal-Request-Id makes the call itself idempotent at PayPal's end: a
   * retried capture returns the ORIGINAL capture rather than charging again.
   * Our own unique index is the second line of defence, not the first.
   */
  if (requestId) headers['PayPal-Request-Id'] = requestId;

  const res = await fetch(`${cfg.baseUrl}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  });

  const body = (await res.json().catch(() => ({}))) as PayPalOrder & {
    name?: string;
    details?: { issue?: string }[];
  };

  if (!res.ok) {
    /*
     * The `issue` is surfaced rather than flattened into a generic failure,
     * because ORDER_ALREADY_CAPTURED must be handled as "already paid", not as
     * "declined". Nothing else from the body is propagated — a PayPal error
     * body can carry buyer account detail.
     */
    const issue = body?.details?.[0]?.issue ?? body?.name ?? null;
    throw new PayPalOrderError(res.status, issue, 'PayPal order request failed');
  }
  return body;
}

/**
 * Create an order for an amount the SERVER decided.
 *
 * @param amountCents  From the central pricing config, never from the browser.
 * @param referenceId  `tier:interval` — echoed back at capture so the grant is
 *                     derived from PayPal's copy, not from a second client call.
 * @param customId     The buyer's user id, so the payment carries its owner.
 */
export async function createOrder(
  amountCents: number,
  referenceId: string,
  customId: string,
  cfg: PayPalConfig = payPalConfig(),
): Promise<PayPalOrder> {
  return callOrders(
    '/v2/checkout/orders',
    {
      method: 'POST',
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: referenceId,
            custom_id: customId,
            amount: { currency_code: ORDER_CURRENCY, value: formatAmount(amountCents) },
          },
        ],
        /*
         * EXPERIENCE CONTEXT LIVES HERE, NOT IN application_context.
         *
         * The previous attempt set landing_page under `application_context`,
         * which is deprecated, and the buyer still landed on
         * checkoutweb/signup — the account-creation flow asking for a
         * password, date of birth and national ID. Deprecated does not mean
         * "still honoured": PayPal reads the experience settings from
         * payment_source.paypal.experience_context, and a landing_page it does
         * not read is a landing_page that does not apply.
         *
         * application_context is now GONE rather than kept alongside. Two
         * copies of the same setting in one request is how you get a fix that
         * appears to work while the ignored copy is the one being read — and
         * it leaves nobody able to say which location actually took effect.
         *
         * This block controls only which hosted page opens first. It disables
         * no funding source: a buyer without a PayPal account can still reach
         * guest card checkout from the login page.
         */
        payment_source: {
          paypal: {
            experience_context: {
              landing_page: 'LOGIN',
              user_action: 'PAY_NOW',
              shipping_preference: 'NO_SHIPPING',
            },
          },
        },
      }),
    },
    cfg,
  );
}

/**
 * Capture an approved order. The response is the authority on whether money
 * moved — the button's success callback is not.
 */
export async function captureOrder(
  orderId: string,
  cfg: PayPalConfig = payPalConfig(),
): Promise<PayPalOrder> {
  return callOrders(
    `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
    { method: 'POST', body: '{}' },
    cfg,
    // Stable per order, so a retry of the SAME capture is idempotent at PayPal.
    `capture-${orderId}`,
  );
}

/** Read an order back — used to recover state when a capture retry conflicts. */
export async function getOrder(
  orderId: string,
  cfg: PayPalConfig = payPalConfig(),
): Promise<PayPalOrder> {
  return callOrders(`/v2/checkout/orders/${encodeURIComponent(orderId)}`, { method: 'GET' }, cfg);
}
