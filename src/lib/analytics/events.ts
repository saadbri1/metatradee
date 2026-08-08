/**
 * THE analytics event registry.
 *
 * PRIVACY IS ENFORCED BY THE TYPE SYSTEM HERE, not by reviewer discipline.
 *
 * This product holds people's trading records. The calculators are worse still:
 * their inputs are a stranger's real account balance and real risk appetite,
 * typed into a public page before they have any relationship with us. None of
 * that may ever reach an analytics vendor, and "remember not to send it" is not
 * a control — it is a hope.
 *
 * So every event below declares a CLOSED payload. There is no `Record<string,
 * unknown>` anywhere in this file and no numeric field at all. A property is
 * either a value from a fixed enum or a boolean. That makes the dangerous call
 * a compile error rather than a code-review catch:
 *
 *     trackEvent('calculator_completed', { calculator: 'xauusd_lot_size' })  ✅
 *     trackEvent('calculator_completed', { balance: 20000 })                 ❌ won't compile
 *
 * `sanitize.ts` then re-checks the same rules at runtime, because types are
 * gone by then and a JS caller or an `as never` can still get through.
 *
 * ADDING AN EVENT: add a member to `AnalyticsEvent` and its allowed keys to
 * `EVENT_SCHEMA`. A mismatch between the two fails `analytics.test.ts`.
 */
import type { PlanTier } from '@/features/billing/plans';
import type { SupportCategory } from '@/features/contact/schemas';
import type { SupportChatLocale } from '@/features/support-chat/types';

/** The public calculators. Ids are stable analytics keys, not URLs. */
export const CALCULATOR_IDS = ['position_size', 'xauusd_lot_size', 'risk_reward'] as const;
export type CalculatorId = (typeof CALCULATOR_IDS)[number];

/**
 * Coarse page buckets.
 *
 * A bucket rather than a path, so reporting can compare page TYPES without one
 * row per URL — and so a future authenticated page cannot accidentally send its
 * path, which for this product can itself be identifying.
 */
export const PAGE_GROUPS = [
  'home',
  'product',
  'pricing',
  'tool',
  'support',
  'resources',
  'auth',
] as const;
export type PageGroup = (typeof PAGE_GROUPS)[number];

export const BILLING_INTERVALS = ['monthly', 'annual'] as const;
export type BillingIntervalProp = (typeof BILLING_INTERVALS)[number];

/** Whether a submission actually reached the transport. Never the content. */
export const SUBMIT_OUTCOMES = ['sent', 'failed'] as const;
export type SubmitOutcome = (typeof SUBMIT_OUTCOMES)[number];

/**
 * Every event, with its exact payload.
 *
 * Note what is absent throughout: no amounts, no prices the user typed, no
 * message text, no email, no symbol, no free-form string of any kind.
 */
export type AnalyticsEvent =
  /* ---- Acquisition ------------------------------------------------- */
  /** A page view that arrived from an organic search referrer. */
  | { name: 'organic_landing'; props: { page_group: PageGroup } }

  /* ---- Calculators (public, unauthenticated) ------------------------ */
  /** First input change. Fires once per calculator per page view. */
  | { name: 'calculator_started'; props: { calculator: CalculatorId } }
  /** A valid result was rendered. The RESULT ITSELF IS NEVER SENT. */
  | { name: 'calculator_completed'; props: { calculator: CalculatorId } }
  /**
   * A validation refusal was shown. `reason` is our own closed error code —
   * never the offending value.
   */
  | { name: 'calculator_rejected'; props: { calculator: CalculatorId; reason: string } }
  /** Click on a related-tool or related-page link from a calculator. */
  | { name: 'calculator_related_click'; props: { calculator: CalculatorId } }

  /* ---- Conversion --------------------------------------------------- */
  | { name: 'signup_cta_click'; props: { page_group: PageGroup } }
  | { name: 'signup_started'; props: { page_group: PageGroup } }
  | { name: 'signup_completed'; props: Record<string, never> }
  | { name: 'pricing_viewed'; props: Record<string, never> }
  | { name: 'plan_selected'; props: { tier: PlanTier; interval: BillingIntervalProp } }

  /* ---- Support intent ----------------------------------------------- */
  /** Category is a fixed enum; the message body is never included. */
  | { name: 'support_form_submitted'; props: { category: SupportCategory; outcome: SubmitOutcome } }
  | { name: 'contact_channel_click'; props: Record<string, never> }

  /* ---- Chatbot ------------------------------------------------------- */
  | { name: 'chat_opened'; props: { page_group: PageGroup } }
  /** THE MESSAGE TEXT IS NEVER SENT. Only that a turn happened, and in which language. */
  | { name: 'chat_message_sent'; props: { locale: SupportChatLocale } }
  | { name: 'chat_escalation_opened'; props: { locale: SupportChatLocale } };

export type AnalyticsEventName = AnalyticsEvent['name'];

/** Payload type for one event name. */
export type PropsFor<N extends AnalyticsEventName> = Extract<AnalyticsEvent, { name: N }>['props'];

/**
 * The RUNTIME allowlist, mirroring the types above.
 *
 * Types vanish at compile time. This is what actually stops a stray key from
 * leaving the browser, and `analytics.test.ts` asserts it stays in step with
 * the union — a new event without a schema entry fails the suite.
 */
export const EVENT_SCHEMA: Record<AnalyticsEventName, readonly string[]> = {
  organic_landing: ['page_group'],
  calculator_started: ['calculator'],
  calculator_completed: ['calculator'],
  calculator_rejected: ['calculator', 'reason'],
  calculator_related_click: ['calculator'],
  signup_cta_click: ['page_group'],
  signup_started: ['page_group'],
  signup_completed: [],
  pricing_viewed: [],
  plan_selected: ['tier', 'interval'],
  support_form_submitted: ['category', 'outcome'],
  contact_channel_click: [],
  chat_opened: ['page_group'],
  chat_message_sent: ['locale'],
  chat_escalation_opened: ['locale'],
};

/**
 * Key fragments that must never appear in a payload, whatever the schema says.
 *
 * Belt AND braces. The schema allowlist above is the real control; this exists
 * so that a future edit which *adds* a forbidden key to a schema still fails,
 * loudly, instead of quietly shipping. Matched as substrings against lowercased
 * key names, so `accountBalance`, `risk_pct` and `stopLoss` are all caught.
 */
export const FORBIDDEN_KEY_FRAGMENTS = [
  'balance',
  'amount',
  'risk',
  'stop',
  'lot',
  'size',
  'price',
  'entry',
  'exit',
  'profit',
  'loss',
  'pnl',
  'symbol',
  'ticker',
  'instrument',
  'journal',
  'note',
  'message',
  'text',
  'content',
  'query',
  'email',
  'phone',
  'name',
  'address',
  'broker',
  'credential',
  'password',
  'token',
  'apikey',
  'api_key',
  'secret',
  'account',
  'user_id',
  'userid',
] as const;
