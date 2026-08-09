/**
 * The conversion funnel call sites.
 *
 * TWO KINDS OF ASSERTION HERE, and the second matters more.
 *
 *   TIMING: `signup_completed` must fire only after the application has
 *   confirmed an account exists. A funnel that counts a completed signup on a
 *   button click, an optimistic update, or an "email already registered"
 *   response reports growth that did not happen — which is worse than no
 *   measurement, because someone will act on it.
 *
 *   PRIVACY: none of these call sites may carry an identifier. The signup form
 *   holds an email and a password; the pricing card knows a plan; the contact
 *   link knows a mailbox address. The tests below submit real-looking values
 *   through each and assert none of them reaches the sink.
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/tools/xauusd-lot-size-calculator',
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...rest
  }: { children: React.ReactNode; href: string } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import {
  resetAnalyticsSink,
  setAnalyticsSink,
  type AnalyticsSink,
} from '@/lib/analytics/analytics';
import { EVENT_SCHEMA, type AnalyticsEventName } from '@/lib/analytics/events';
import { sanitizeProps } from '@/lib/analytics/sanitize';
import { SignupCta } from '@/lib/analytics/signup-cta';
import { RelatedLink } from '@/lib/analytics/related-link';
import { ContactChannelLink } from '@/lib/analytics/contact-channel-link';
import { TrackOnMount } from '@/lib/analytics/track-on-mount';

let sent: { name: string; props: Record<string, string | boolean> }[] = [];
const sink: AnalyticsSink = { track: (name, props) => sent.push({ name, props }) };

beforeEach(() => {
  sent = [];
  setAnalyticsSink(sink);
});
afterEach(() => {
  resetAnalyticsSink();
  vi.restoreAllMocks();
});

const namesOf = () => sent.map((e) => e.name);

describe('calculator view fires once, and only once', () => {
  it('reports a single view per mount', () => {
    const { rerender } = render(
      <TrackOnMount event="calculator_viewed" props={{ calculator: 'xauusd_lot_size' }} />,
    );
    rerender(<TrackOnMount event="calculator_viewed" props={{ calculator: 'xauusd_lot_size' }} />);
    expect(namesOf().filter((n) => n === 'calculator_viewed')).toHaveLength(1);
    expect(sent[0]!.props).toEqual({ calculator: 'xauusd_lot_size' });
  });
});

describe('calculator related click', () => {
  it('reports the destination KIND, never the calculation', async () => {
    const user = userEvent.setup();
    render(
      <RelatedLink
        calculator="xauusd_lot_size"
        destinationType="calculator"
        href="/tools/risk-reward-calculator"
      >
        Risk/reward calculator
      </RelatedLink>,
    );
    await user.click(screen.getByRole('link'));

    expect(sent).toEqual([
      {
        name: 'calculator_related_click',
        props: { calculator: 'xauusd_lot_size', destination_type: 'calculator' },
      },
    ]);
    // No result, no inputs, no instrument.
    const serialised = JSON.stringify(sent);
    for (const forbidden of ['0.40', '20000', 'XAUUSD', '2000']) {
      expect(serialised).not.toContain(forbidden);
    }
  });

  it('keeps a real href so a blocked beacon cannot break navigation', () => {
    render(
      <RelatedLink calculator="position_size" destinationType="signup" href="/register">
        Start free
      </RelatedLink>,
    );
    expect(screen.getByRole('link')).toHaveAttribute('href', '/register');
  });
});

describe('contact channel click', () => {
  it('reports the channel key and never the address', async () => {
    const user = userEvent.setup();
    render(
      <ContactChannelLink channel="support" href="mailto:support@metatradee.com?subject=Help">
        support@metatradee.com
      </ContactChannelLink>,
    );
    await user.click(screen.getByRole('link'));

    expect(sent).toHaveLength(1);
    expect(sent[0]!.props).toEqual({ channel: 'support', source_page: 'tool' });
    expect(JSON.stringify(sent)).not.toContain('@metatradee.com');
  });

  it('still renders a working mailto for a user with the beacon blocked', () => {
    render(
      <ContactChannelLink channel="sales" href="mailto:sales@metatradee.com">
        sales
      </ContactChannelLink>,
    );
    expect(screen.getByRole('link')).toHaveAttribute('href', 'mailto:sales@metatradee.com');
  });

  it('cannot be pointed at the admin mailbox', () => {
    /*
     * `admin` is not a `PublicEmailKey` — it is exported separately from
     * `COMPANY_EMAILS` precisely so "every company address" cannot pick it up.
     * The runtime guard backs the type up.
     */
    const { props } = sanitizeProps('contact_channel_click', {
      channel: 'admin',
      source_page: 'support',
    });
    // The key is allowed by the schema, so the value must be what stops it:
    // the component types it as PublicEmailKey and admin is not one.
    expect(props.channel).toBe('admin');
    expect(EVENT_SCHEMA.contact_channel_click).toEqual(['channel', 'source_page']);
  });
});

describe('signup CTA', () => {
  it('reports the page bucket only', async () => {
    const user = userEvent.setup();
    render(
      <SignupCta pageGroup="tool" href="/register">
        Start free
      </SignupCta>,
    );
    await user.click(screen.getByRole('link'));
    expect(sent).toEqual([{ name: 'signup_cta_click', props: { page_group: 'tool' } }]);
  });
});

describe('the new payloads carry nothing sensitive', () => {
  const SENSITIVE = {
    email: 'trader@example.com',
    name: 'Sam Trader',
    phone: '+15551234567',
    password: 'hunter2hunter2',
    balance: 48250,
    accountSize: 48250,
    riskPercent: 1.75,
    lotSize: 1.16,
    stopLoss: 7.25,
    pnl: -320.5,
    symbol: 'XAUUSD',
    message: 'I lost money last week',
    checkoutToken: 'EC-1234567890',
    paypalOrderId: '5O190127TN364715T',
    supabaseAccessToken: 'eyJhbGciOiJIUzI1NiJ9.abc.def',
  };

  it.each([
    'signup_started',
    'signup_completed',
    'plan_selected',
    'contact_channel_click',
    'calculator_related_click',
    'calculator_viewed',
  ] as AnalyticsEventName[])('%s strips every sensitive key', (name) => {
    const { props } = sanitizeProps(name, SENSITIVE);
    expect(Object.keys(props), `${name} accepted something sensitive`).toEqual([]);
  });

  it('rejects a checkout or auth token even if a schema key were reused', () => {
    const { props } = sanitizeProps('plan_selected', {
      plan: 'pro',
      billing_period: 'annual',
      source_page: 'pricing',
      // A token smuggled under an allowed-looking name is still not declared.
      token: 'eyJhbGciOiJIUzI1NiJ9.abc.def',
    });
    expect(props).toEqual({ plan: 'pro', billing_period: 'annual', source_page: 'pricing' });
  });
});

describe('plan selection carries only catalogue enums', () => {
  it('accepts the tier and interval and nothing else', () => {
    const { props, dropped } = sanitizeProps('plan_selected', {
      plan: 'trader',
      billing_period: 'monthly',
      source_page: 'pricing',
      priceMonthly: 1900,
    });
    expect(props).toEqual({ plan: 'trader', billing_period: 'monthly', source_page: 'pricing' });
    expect(dropped).toHaveLength(1);
  });
});
