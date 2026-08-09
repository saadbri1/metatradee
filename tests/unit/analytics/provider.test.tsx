/**
 * The analytics provider mount.
 *
 * WHY THIS IS WORTH A TEST. Both vendors are idempotent-ish in the browser, but
 * a duplicated mount doubles page-view counts and halves the value of every
 * funnel measured on top of them — silently, and in a way no error surfaces.
 * Counting the mounts is the only cheap way to notice.
 *
 * The vendor components are stubbed: what is being asserted is OUR composition,
 * not that Vercel's script loads, which only a real browser on a real
 * deployment can show. That check lives in the production verification instead,
 * where it also revealed that Vercel rewrites the Speed Insights script to an
 * obfuscated path — so asserting a hardcoded URL here would be asserting
 * something untrue of production.
 */
import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const analyticsMounts = vi.hoisted(() => ({ count: 0 }));
const speedMounts = vi.hoisted(() => ({ count: 0 }));

vi.mock('@vercel/analytics/react', () => ({
  Analytics: () => {
    analyticsMounts.count += 1;
    return null;
  },
}));
const vendorTrack = vi.hoisted(() => vi.fn());
vi.mock('@vercel/analytics', () => ({ track: vendorTrack }));
vi.mock('@vercel/speed-insights/next', () => ({
  SpeedInsights: () => {
    speedMounts.count += 1;
    return null;
  },
}));

const pathname = vi.hoisted(() => ({ value: '/tools' }));
vi.mock('next/navigation', () => ({ usePathname: () => pathname.value }));

import { AnalyticsProvider } from '@/lib/analytics/analytics-provider';
import { resetAnalyticsSink } from '@/lib/analytics/analytics';

beforeEach(() => {
  analyticsMounts.count = 0;
  speedMounts.count = 0;
  vendorTrack.mockClear();
  // No organic referrer by default — keeps the mount tests free of side events.
  Object.defineProperty(document, 'referrer', { value: '', configurable: true });
});

afterEach(() => {
  resetAnalyticsSink();
  vi.restoreAllMocks();
});

describe('the provider mounts each vendor exactly once', () => {
  it('renders one Analytics and one SpeedInsights', () => {
    render(<AnalyticsProvider />);
    expect(analyticsMounts.count).toBe(1);
    expect(speedMounts.count).toBe(1);
  });

  it('renders no DOM of its own, so it cannot shift layout', () => {
    const { container } = render(<AnalyticsProvider />);
    // Both vendors inject a script into <head>; neither occupies page flow.
    expect(container).toBeEmptyDOMElement();
  });
});

describe('organic attribution', () => {
  /*
   * Asserted against the VENDOR mock, not a local sink. The provider installs
   * its own sink in an effect on mount, so anything installed beforehand is
   * replaced before the organic event fires — and asserting on the vendor is
   * the more honest check anyway: it proves the event reached the transport.
   */
  const trackedNames = () => vendorTrack.mock.calls.map((c) => c[0] as string);

  it('reports a landing when the referrer is a search engine', () => {
    Object.defineProperty(document, 'referrer', {
      value: 'https://www.google.com/search',
      configurable: true,
    });
    render(<AnalyticsProvider />);
    expect(trackedNames()).toContain('organic_landing');
  });

  it('reports the page bucket, never the referrer or the path', () => {
    Object.defineProperty(document, 'referrer', {
      value: 'https://www.google.com/search?q=xauusd+lot+size',
      configurable: true,
    });
    render(<AnalyticsProvider />);
    const call = vendorTrack.mock.calls.find((c) => c[0] === 'organic_landing');
    expect(call?.[1]).toEqual({ page_group: 'tool' });
    // The search query the visitor typed must never travel.
    expect(JSON.stringify(vendorTrack.mock.calls)).not.toContain('xauusd+lot+size');
  });

  it('reports nothing for a direct visit', () => {
    render(<AnalyticsProvider />);
    expect(trackedNames()).not.toContain('organic_landing');
  });

  it('reports nothing for an internal referrer', () => {
    Object.defineProperty(document, 'referrer', {
      value: `${window.location.origin}/pricing`,
      configurable: true,
    });
    render(<AnalyticsProvider />);
    // In-app navigation is not acquisition.
    expect(trackedNames()).not.toContain('organic_landing');
  });
});
