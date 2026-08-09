/**
 * The analytics layer, and above all its privacy guarantees.
 *
 * THE ASSERTION THAT MATTERS is negative: that a financial value CANNOT leave
 * the browser as an analytics parameter. The calculators take a stranger's real
 * account balance and real risk appetite, typed into a public page. If any of
 * that reaches a vendor it is a data-protection incident, not a bug — so the
 * tests below spend most of their effort trying to get such a value through and
 * failing.
 *
 * The type system already refuses these payloads at compile time. These tests
 * exist because types are gone at runtime, and a `as never`, a plain-JS caller,
 * or a future widening of a payload type would all sail past the compiler.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  resetAnalyticsSink,
  setAnalyticsSink,
  trackEvent,
  type AnalyticsSink,
} from '@/lib/analytics/analytics';
import { isCleanPayload, sanitizeProps } from '@/lib/analytics/sanitize';
import {
  CALCULATOR_IDS,
  EVENT_SCHEMA,
  FORBIDDEN_KEY_FRAGMENTS,
  PAGE_GROUPS,
  type AnalyticsEventName,
} from '@/lib/analytics/events';
import { pageGroupFor } from '@/lib/analytics/page-group';

let sent: { name: string; props: Record<string, string | boolean> }[] = [];

const recordingSink: AnalyticsSink = {
  track: (name, props) => sent.push({ name, props }),
};

beforeEach(() => {
  sent = [];
  setAnalyticsSink(recordingSink);
});

afterEach(() => {
  resetAnalyticsSink();
  vi.restoreAllMocks();
});

/** The exact values a calculator holds. None may ever appear in an event. */
const FINANCIAL_PAYLOAD = {
  balance: 20000,
  riskPercent: 1,
  riskAmount: 200,
  stopDistance: 5,
  lots: 0.4,
  lotSize: 0.4,
  entryPrice: 2000,
  exitPrice: 2030,
  pnl: -450.25,
  symbol: 'XAUUSD',
  accountBalance: 20000,
};

describe('financial values cannot escape', () => {
  it('drops every calculator input, even when handed directly to the sanitiser', () => {
    const { props, dropped } = sanitizeProps('calculator_completed', {
      calculator: 'xauusd_lot_size',
      ...FINANCIAL_PAYLOAD,
    });
    expect(props).toEqual({ calculator: 'xauusd_lot_size' });
    expect(dropped).toHaveLength(Object.keys(FINANCIAL_PAYLOAD).length);
  });

  it('sends nothing financial through the real tracking path', () => {
    // `as never` is exactly the escape hatch a careless future edit would use.
    trackEvent('calculator_completed', {
      calculator: 'position_size',
      ...FINANCIAL_PAYLOAD,
    } as never);

    expect(sent).toHaveLength(1);
    const serialised = JSON.stringify(sent[0]);
    for (const value of Object.values(FINANCIAL_PAYLOAD)) {
      expect(serialised, `leaked ${value}`).not.toContain(String(value));
    }
    expect(sent[0]!.props).toEqual({ calculator: 'position_size' });
  });

  it('refuses numbers categorically, not just large ones', () => {
    // Every legitimate property is an enum member; a number is always a mistake.
    for (const n of [0, 1, -1, 0.01, 1e9, Number.NaN, Number.POSITIVE_INFINITY]) {
      const { props } = sanitizeProps('calculator_started', { calculator: n as never });
      expect(props.calculator).toBeUndefined();
    }
  });

  it('refuses objects, arrays and null rather than stringifying them', () => {
    for (const v of [{ a: 1 }, [1, 2], null, undefined, () => {}]) {
      const { props } = sanitizeProps('calculator_started', { calculator: v as never });
      expect(props.calculator).toBeUndefined();
    }
  });

  it('refuses free prose, which is how a message body would arrive', () => {
    const message = 'x'.repeat(200);
    const { props } = sanitizeProps('chat_message_sent', { locale: message as never });
    expect(props.locale).toBeUndefined();
  });

  it('never lets a personal identifier through under any event', () => {
    const identifiers = {
      email: 'trader@example.com',
      name: 'Sam Trader',
      phone: '+15551234567',
      apiKey: 'sk-live-ABCDEFGHIJKLMNOP',
      password: 'hunter2hunter2',
      brokerAccount: '12345678',
      message: 'I lost money on gold last week',
    };
    for (const name of Object.keys(EVENT_SCHEMA) as AnalyticsEventName[]) {
      const { props } = sanitizeProps(name, identifiers);
      expect(Object.keys(props), `${name} accepted an identifier`).toEqual([]);
    }
  });
});

describe('the schema and the type union stay in step', () => {
  it('declares no property whose name is forbidden', () => {
    /*
     * Guards the case the allowlist alone would miss: someone ADDS a forbidden
     * key to a schema. Then the key is "declared" and would pass — unless this
     * fails first.
     */
    for (const [event, keys] of Object.entries(EVENT_SCHEMA)) {
      for (const key of keys) {
        const lower = key.toLowerCase();
        const hit = FORBIDDEN_KEY_FRAGMENTS.find((f) => lower.includes(f));
        expect(hit, `${event}.${key} contains forbidden fragment "${hit}"`).toBeUndefined();
      }
    }
  });

  it('covers every event the calculators and chatbot actually fire', () => {
    for (const name of [
      'organic_landing',
      'calculator_started',
      'calculator_completed',
      'calculator_rejected',
      'signup_cta_click',
      'pricing_viewed',
      'support_form_submitted',
      'chat_opened',
      'chat_message_sent',
      'chat_escalation_opened',
    ]) {
      expect(EVENT_SCHEMA, name).toHaveProperty(name);
    }
  });

  it('accepts the documented example from the brief unchanged', () => {
    trackEvent('calculator_completed', { calculator: 'xauusd_lot_size' });
    expect(sent).toEqual([
      { name: 'calculator_completed', props: { calculator: 'xauusd_lot_size' } },
    ]);
  });

  it('treats a clean payload as clean and a dirty one as not', () => {
    expect(isCleanPayload('calculator_started', { calculator: 'risk_reward' })).toBe(true);
    expect(isCleanPayload('calculator_started', { calculator: 'risk_reward', balance: 1 })).toBe(
      false,
    );
  });
});

describe('tracking never breaks the page', () => {
  it('swallows a sink that throws', () => {
    setAnalyticsSink({
      track: () => {
        throw new Error('beacon blocked');
      },
    });
    // An ad blocker must not take a calculator down with it.
    expect(() => trackEvent('pricing_viewed', {})).not.toThrow();
  });

  it('sends nothing at all when no sink is installed', () => {
    resetAnalyticsSink();
    expect(() => trackEvent('signup_completed', { source_page: 'auth' })).not.toThrow();
    expect(sent).toEqual([]);
  });

  it('does not throw on a null payload from a plain-JS caller', () => {
    expect(() => trackEvent('pricing_viewed', null as never)).not.toThrow();
  });
});

describe('page grouping never leaks a path', () => {
  it('buckets the public routes', () => {
    expect(pageGroupFor('/')).toBe('home');
    expect(pageGroupFor('/pricing')).toBe('pricing');
    expect(pageGroupFor('/tools')).toBe('tool');
    expect(pageGroupFor('/tools/xauusd-lot-size-calculator')).toBe('tool');
    expect(pageGroupFor('/support')).toBe('support');
    expect(pageGroupFor('/contact')).toBe('support');
    expect(pageGroupFor('/login')).toBe('auth');
  });

  it('never returns an identifier-bearing path for an authenticated route', () => {
    // These carry record ids. The bucket must reveal none of it.
    for (const path of ['/journal/abc-123', '/playbook/9f8e7d', '/reports/secret-token']) {
      const group = pageGroupFor(path);
      expect(PAGE_GROUPS).toContain(group);
      expect(group).not.toContain('/');
    }
  });

  it('falls back to a bucket rather than echoing an unknown path', () => {
    expect(PAGE_GROUPS).toContain(pageGroupFor('/something-new'));
    expect(PAGE_GROUPS).toContain(pageGroupFor(null));
    expect(PAGE_GROUPS).toContain(pageGroupFor(undefined));
  });
});

describe('calculator ids', () => {
  it('are stable, unique keys distinct from URLs', () => {
    expect(new Set(CALCULATOR_IDS).size).toBe(CALCULATOR_IDS.length);
    for (const id of CALCULATOR_IDS) expect(id).not.toContain('/');
  });
});
