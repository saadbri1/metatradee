/**
 * Chart → real market-data API integration (Phase 12.7).
 *
 * `fetch` is stubbed throughout: no request reaches the API route or the
 * provider, so this suite never bills the account. The canvas chart itself is
 * not asserted (canvas exposes nothing to assistive tech) — what is asserted is
 * everything a user or screen reader can reach, plus the request discipline that
 * keeps a billed endpoint from being called wrongly.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Candle } from '@/features/chart/types';

/**
 * The canvas vendor cannot run under jsdom (no real canvas, no matchMedia), and
 * canvas exposes nothing to assertions anyway. Mocking at the module boundary
 * keeps the vendor out of the test run AND gives us a direct assertion on the
 * candles handed to it — the thing that actually matters here.
 */
const priceChartCalls = vi.hoisted(() => [] as Candle[][]);
vi.mock('@/features/chart/components/price-chart', () => ({
  PriceChart: ({
    candles,
    watermark,
    priceScaleLocked,
    fitRequest,
  }: {
    candles: Candle[];
    watermark?: string;
    priceScaleLocked?: boolean;
    fitRequest?: number;
  }) => {
    priceChartCalls.push(candles);
    return (
      <div
        data-testid="price-chart"
        data-watermark={watermark}
        data-locked={String(priceScaleLocked ?? false)}
        data-fit-request={String(fitRequest ?? 0)}
      >
        {candles.length} candles rendered
      </div>
    );
  },
}));

import { ChartWorkspace } from '@/features/chart/components/chart-workspace';

const CANDLES = [
  { time: 1654548600, open: 4120.5, high: 4121, low: 4120, close: 4120.75, volume: 100 },
  { time: 1654548660, open: 4120.75, high: 4122, low: 4120.5, close: 4121.5, volume: 110 },
  { time: 1654548720, open: 4121.5, high: 4121.75, low: 4119, close: 4119.25, volume: 120 },
  { time: 1654548780, open: 4119.25, high: 4120, low: 4118.5, close: 4119.75, volume: 130 },
  { time: 1654548840, open: 4119.75, high: 4123, low: 4119.5, close: 4122.5, volume: 140 },
];

function successBody(candles = CANDLES) {
  return {
    data: {
      symbol: 'ESM2',
      timeframe: '1m',
      start: '2022-06-06T20:50:00Z',
      end: '2022-06-06T20:55:00Z',
      provider: 'databento',
      candles,
    },
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function errorBody(code: string, message = 'detail') {
  return { error: { code, message } };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  priceChartCalls.length = 0;
  fetchMock = vi.fn(async () => jsonResponse(successBody()));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function load(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /load candles/i }));
}

describe('production path contains no fixtures', () => {
  const root = resolve(__dirname, '../../..');

  /**
   * Matches an actual import of the fixtures module. A plain substring search
   * would also hit prose in doc comments — which is exactly where these files
   * explain why fixtures are absent — and would fail for the wrong reason.
   */
  const IMPORTS_FIXTURES = /^\s*(?:import|export)[^\n]*from\s*['"][^'"]*fixtures['"]/m;

  it('the /chart route does not import the fixture module', () => {
    const page = readFileSync(resolve(root, 'src/app/(protected)/chart/page.tsx'), 'utf8');
    expect(IMPORTS_FIXTURES.test(page)).toBe(false);
    expect(page).not.toContain('getFixtureSeries');
  });

  it('the workspace does not import the fixture module', () => {
    const workspace = readFileSync(
      resolve(root, 'src/features/chart/components/chart-workspace.tsx'),
      'utf8',
    );
    expect(IMPORTS_FIXTURES.test(workspace)).toBe(false);
    expect(workspace).not.toContain('getFixtureSeries');
    expect(workspace).not.toContain('generateFixtureCandles');
  });

  it('the shared summary module does not depend on fixtures', () => {
    // `summarizeCandles` was moved out of fixtures.ts precisely so this holds:
    // production code must not reach the fixture module even transitively.
    const summary = readFileSync(resolve(root, 'src/features/chart/summary.ts'), 'utf8');
    expect(IMPORTS_FIXTURES.test(summary)).toBe(false);
  });
});

describe('initial state', () => {
  it('renders controls with conservative defaults and loads nothing', () => {
    render(<ChartWorkspace />);
    expect(screen.getByLabelText(/contract/i)).toHaveValue('ESM2');
    expect(screen.getByLabelText(/timeframe/i)).toHaveValue('1m');
    expect(screen.getByLabelText(/start/i)).toHaveValue('2022-06-06T20:50');
    expect(screen.getByLabelText(/end/i)).toHaveValue('2022-06-06T21:50');
    expect(screen.getByText(/no candles loaded/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('claims nothing about data provenance before a response arrives', () => {
    render(<ChartWorkspace />);
    expect(screen.queryByText(/real historical market data/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/databento/i)).not.toBeInTheDocument();
  });
});

describe('controls', () => {
  it('accepts a dated contract and upper-cases it', async () => {
    const user = userEvent.setup();
    render(<ChartWorkspace />);
    const input = screen.getByLabelText(/contract/i);
    await user.clear(input);
    await user.type(input, 'nqz5');
    expect(input).toHaveValue('NQZ5');
  });

  it('offers exactly the four supported timeframes', async () => {
    const user = userEvent.setup();
    render(<ChartWorkspace />);
    const select = screen.getByLabelText(/timeframe/i);
    expect([...(select as HTMLSelectElement).options].map((o) => o.value)).toEqual([
      '1m',
      '5m',
      '15m',
      '1h',
    ]);
    await user.selectOptions(select, '15m');
    expect(select).toHaveValue('15m');
  });

  it('accepts edited start and end datetimes', async () => {
    const user = userEvent.setup();
    render(<ChartWorkspace />);
    const start = screen.getByLabelText(/start/i);
    await user.clear(start);
    await user.type(start, '2022-06-07T10:00');
    expect(start).toHaveValue('2022-06-07T10:00');
  });
});

describe('draft controls vs loaded series', () => {
  it('shows no "changes not loaded" chip before anything has loaded', async () => {
    const user = userEvent.setup();
    render(<ChartWorkspace />);
    await user.selectOptions(screen.getByLabelText(/timeframe/i), '5m');
    expect(screen.queryByText(/changes not loaded/i)).not.toBeInTheDocument();
  });

  it('editing a control after a load does NOT alter the loaded metadata', async () => {
    const user = userEvent.setup();
    render(<ChartWorkspace />);
    await load(user);
    await screen.findByText(/real historical market data/i);

    await user.selectOptions(screen.getByLabelText(/timeframe/i), '15m');

    // Header and details still describe the RESPONSE (1m), not the draft (15m).
    expect(screen.getByText('ESM2 · 1m')).toBeInTheDocument();
    const details = screen.getByLabelText('Series details');
    expect(details).toHaveTextContent('1m');
    expect(details).not.toHaveTextContent('15m');
    // And no new request was fired by the edit alone.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('flags divergence with a "Changes not loaded" chip', async () => {
    const user = userEvent.setup();
    render(<ChartWorkspace />);
    await load(user);
    await screen.findByText(/real historical market data/i);
    expect(screen.queryByText(/changes not loaded/i)).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/timeframe/i), '5m');
    expect(screen.getByText(/changes not loaded/i)).toBeInTheDocument();
  });

  it('clears the chip once the changed request loads successfully', async () => {
    const user = userEvent.setup();
    render(<ChartWorkspace />);
    await load(user);
    await screen.findByText(/real historical market data/i);

    await user.selectOptions(screen.getByLabelText(/timeframe/i), '5m');
    expect(screen.getByText(/changes not loaded/i)).toBeInTheDocument();

    await load(user);
    await waitFor(() => expect(screen.queryByText(/changes not loaded/i)).not.toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reverting the draft to the loaded values clears the chip without a request', async () => {
    const user = userEvent.setup();
    render(<ChartWorkspace />);
    await load(user);
    await screen.findByText(/real historical market data/i);

    const select = screen.getByLabelText(/timeframe/i);
    await user.selectOptions(select, '5m');
    expect(screen.getByText(/changes not loaded/i)).toBeInTheDocument();
    await user.selectOptions(select, '1m');
    expect(screen.queryByText(/changes not loaded/i)).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('successful load', () => {
  it('sends the exact API query parameters as ISO UTC', async () => {
    const user = userEvent.setup();
    render(<ChartWorkspace />);
    await load(user);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const url = new URL(String(fetchMock.mock.calls[0]![0]), 'http://localhost');
    expect(url.pathname).toBe('/api/market-data/candles');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      symbol: 'ESM2',
      timeframe: '1m',
      start: '2022-06-06T20:50:00Z',
      end: '2022-06-06T21:50:00Z',
    });
  });

  it('shows a loading state and disables repeat submission while in flight', async () => {
    const user = userEvent.setup();
    let release!: (r: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise<Response>((res) => (release = res)));
    render(<ChartWorkspace />);
    await load(user);

    const button = screen.getByRole('button', { name: /loading/i });
    expect(button).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent(/loading chart/i);

    release(jsonResponse(successBody()));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /load candles/i })).toBeEnabled(),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reports the provider, contract, timeframe, range and candle count', async () => {
    const user = userEvent.setup();
    render(<ChartWorkspace />);
    await load(user);
    await screen.findByText(/real historical market data/i);
    expect(screen.getAllByText(/Databento/).length).toBeGreaterThan(0);
    expect(screen.getByText('2022-06-06T20:50:00Z')).toBeInTheDocument();
    expect(screen.getByText('2022-06-06T20:55:00Z')).toBeInTheDocument();
    // Candle count appears in the details panel.
    const details = screen.getByLabelText('Series details');
    expect(details).toHaveTextContent('5');
    expect(details).toHaveTextContent('ESM2');
  });

  it('populates the accessible summary and candle table from the API response', async () => {
    const user = userEvent.setup();
    render(<ChartWorkspace />);
    await load(user);
    await screen.findByRole('table');
    // 5 data rows + 1 header row.
    expect(screen.getAllByRole('row')).toHaveLength(6);
    expect(screen.getByRole('columnheader', { name: /volume/i })).toBeInTheDocument();
    // The summary appears twice by design — once visibly and once in the
    // sr-only table caption — so assert presence, not uniqueness.
    const summaries = screen.getAllByText(/ESM2:/);
    expect(summaries.length).toBeGreaterThan(0);
    // Direction is spelled out, never colour alone.
    expect(summaries[0]).toHaveTextContent(/up|down/);
  });

  it('passes the API candles straight into the chart component', async () => {
    const user = userEvent.setup();
    render(<ChartWorkspace />);
    await load(user);
    await screen.findByTestId('price-chart');
    expect(priceChartCalls.at(-1)).toEqual(CANDLES);
  });

  it('hands the loaded symbol and timeframe to the chart as a watermark', async () => {
    const user = userEvent.setup();
    render(<ChartWorkspace />);
    await load(user);
    const chart = await screen.findByTestId('price-chart');
    expect(chart).toHaveAttribute('data-watermark', 'ESM2 · 1m');
  });

  it('does not mutate the candles returned by the API', async () => {
    const body = successBody();
    const snapshot = structuredClone(body);
    fetchMock.mockResolvedValueOnce(jsonResponse(body));
    const user = userEvent.setup();
    render(<ChartWorkspace />);
    await load(user);
    await screen.findByRole('table');
    expect(body).toEqual(snapshot);
  });

  it('renders the empty state when the API returns zero candles', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(successBody([])));
    const user = userEvent.setup();
    render(<ChartWorkspace />);
    await load(user);
    // Appears in the visual empty state and again in the accessible summary.
    await waitFor(() =>
      expect(screen.getAllByText(/no candles to display/i).length).toBeGreaterThan(0),
    );
    expect(screen.queryByTestId('price-chart')).not.toBeInTheDocument();
  });

  it('preserves the TradingView attribution', async () => {
    render(<ChartWorkspace />);
    const link = screen.getByRole('link', { name: /tradingview/i });
    expect(link).toHaveAttribute('href', 'https://www.tradingview.com/');
  });
});

describe('price-scale lock and shortcuts', () => {
  it('toggles the lock via the labelled toolbar button and reflects aria-pressed', async () => {
    const user = userEvent.setup();
    render(<ChartWorkspace />);
    const button = screen.getByRole('button', { name: /lock price scale/i });
    expect(button).toHaveAttribute('aria-pressed', 'false');

    await user.click(button);
    expect(screen.getByRole('button', { name: /unlock price scale/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByText(/price scale locked/i)).toBeInTheDocument();
  });

  it('passes the locked state into the chart component', async () => {
    const user = userEvent.setup();
    render(<ChartWorkspace />);
    await load(user);
    const chart = await screen.findByTestId('price-chart');
    expect(chart).toHaveAttribute('data-locked', 'false');

    await user.click(screen.getByRole('button', { name: /lock price scale/i }));
    expect(screen.getByTestId('price-chart')).toHaveAttribute('data-locked', 'true');
  });

  it('keyboard L toggles the lock', async () => {
    const user = userEvent.setup();
    render(<ChartWorkspace />);
    await user.keyboard('l');
    expect(screen.getByText(/price scale locked/i)).toBeInTheDocument();
    await user.keyboard('l');
    expect(screen.queryByText(/price scale locked/i)).not.toBeInTheDocument();
  });

  it('keyboard F requests a content fit on the chart', async () => {
    const user = userEvent.setup();
    render(<ChartWorkspace />);
    await load(user);
    const chart = await screen.findByTestId('price-chart');
    expect(chart).toHaveAttribute('data-fit-request', '0');
    await user.keyboard('f');
    expect(screen.getByTestId('price-chart')).toHaveAttribute('data-fit-request', '1');
    await user.keyboard('f');
    expect(screen.getByTestId('price-chart')).toHaveAttribute('data-fit-request', '2');
  });

  it('the fit toolbar button requests a content fit without the keyboard', async () => {
    const user = userEvent.setup();
    render(<ChartWorkspace />);
    await load(user);
    await user.click(screen.getByRole('button', { name: /fit candles to view/i }));
    expect(screen.getByTestId('price-chart')).toHaveAttribute('data-fit-request', '1');
  });

  it('shortcuts do not fire while typing in a field', async () => {
    const user = userEvent.setup();
    render(<ChartWorkspace />);
    const input = screen.getByLabelText(/contract/i);
    await user.clear(input);
    await user.type(input, 'flf');
    // The characters landed in the input…
    expect(input).toHaveValue('FLF');
    // …and neither L nor F acted as a shortcut.
    expect(screen.queryByText(/price scale locked/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /lock price scale/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('modifier combos are left alone (⌘K stays global)', async () => {
    const user = userEvent.setup();
    render(<ChartWorkspace />);
    await user.keyboard('{Meta>}l{/Meta}');
    expect(screen.queryByText(/price scale locked/i)).not.toBeInTheDocument();
  });

  it('slash focuses the contract field and Escape leaves it', async () => {
    const user = userEvent.setup();
    render(<ChartWorkspace />);
    const input = screen.getByLabelText(/contract/i);
    expect(input).not.toHaveFocus();
    await user.keyboard('/');
    expect(input).toHaveFocus();
    // While focused, "/" must type, not re-trigger the shortcut.
    await user.keyboard('{Escape}');
    expect(input).not.toHaveFocus();
  });

  it('documents the shortcuts in an accessible help popover', async () => {
    const user = userEvent.setup();
    render(<ChartWorkspace />);
    await user.click(screen.getByRole('button', { name: /shortcuts/i }));
    expect(await screen.findByRole('heading', { name: /keyboard shortcuts/i })).toBeInTheDocument();
    expect(screen.getByText(/lock \/ unlock price scale/i)).toBeInTheDocument();
    // "Fit candles to view" is deliberately BOTH a toolbar control name and a
    // documented shortcut — same wording, same action. Assert both exist.
    expect(screen.getAllByText(/fit candles to view/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/focus the contract field/i)).toBeInTheDocument();
    expect(screen.getByText(/shortcuts pause while you are typing/i)).toBeInTheDocument();
  });
});

describe('error states', () => {
  it.each([
    ['market_data_not_configured', 503, /not configured/i],
    ['validation_failed', 422, /check the request/i],
    ['market_data_timeout', 504, /timed out/i],
    ['request_cancelled', 503, /cancelled/i],
    ['market_data_unavailable', 502, /unavailable/i],
    ['market_data_rate_limited', 429, /rate limit/i],
    ['no_market_data', 404, /no candles for that range/i],
    ['internal', 500, /something went wrong/i],
  ])('maps %s to an honest, announced state', async (code, status, copy) => {
    fetchMock.mockResolvedValueOnce(jsonResponse(errorBody(code), status));
    const user = userEvent.setup();
    render(<ChartWorkspace />);
    await load(user);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(copy);
  });

  it('reports an expired session for a 401', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(errorBody('unauthorized'), 401));
    const user = userEvent.setup();
    render(<ChartWorkspace />);
    await load(user);
    expect(await screen.findByRole('alert')).toHaveTextContent(/session has expired/i);
  });

  it('reports a connection problem when the request cannot be sent', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const user = userEvent.setup();
    render(<ChartWorkspace />);
    await load(user);
    expect(await screen.findByRole('alert')).toHaveTextContent(/connection problem/i);
  });

  it('reports an unexpected response for an unreadable body', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('not json', { status: 200, headers: { 'content-type': 'text/plain' } }),
    );
    const user = userEvent.setup();
    render(<ChartWorkspace />);
    await load(user);
    expect(await screen.findByRole('alert')).toHaveTextContent(/unexpected response/i);
  });

  it('NEVER falls back to fixture or synthetic candles on failure', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(errorBody('market_data_unavailable'), 502));
    const user = userEvent.setup();
    render(<ChartWorkspace />);
    await load(user);
    await screen.findByRole('alert');
    // No table, no summary, no fixture instrument — nothing that could be read
    // as price data.
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText(/DEMO\/USD/)).not.toBeInTheDocument();
    expect(screen.queryByText(/real historical market data/i)).not.toBeInTheDocument();
  });
});

describe('request discipline', () => {
  it('aborts the in-flight request when a new load starts', async () => {
    const signals: AbortSignal[] = [];
    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      signals.push(init.signal!);
      return new Promise<Response>((resolve) => {
        init.signal!.addEventListener('abort', () => resolve(jsonResponse(successBody())));
      });
    });
    const user = userEvent.setup();
    render(<ChartWorkspace />);
    await load(user);
    await waitFor(() => expect(signals).toHaveLength(1));

    // The button is disabled while loading, so submit the form directly — this
    // asserts the abort logic itself, not the disabled-button guard.
    const form = screen.getByRole('form', { name: /market data request/i });
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await waitFor(() => expect(signals[0]!.aborted).toBe(true));
  });

  it('aborts the in-flight request on unmount', async () => {
    let captured!: AbortSignal;
    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      captured = init.signal!;
      return new Promise<Response>(() => {});
    });
    const user = userEvent.setup();
    const { unmount } = render(<ChartWorkspace />);
    await load(user);
    await waitFor(() => expect(captured).toBeDefined());
    unmount();
    expect(captured.aborted).toBe(true);
  });

  it('does not let a slow earlier response overwrite a newer one', async () => {
    const resolvers: ((r: Response) => void)[] = [];
    fetchMock.mockImplementation(() => new Promise<Response>((resolve) => resolvers.push(resolve)));
    const user = userEvent.setup();
    render(<ChartWorkspace />);
    await load(user);
    await waitFor(() => expect(resolvers).toHaveLength(1));

    const form = screen.getByRole('form', { name: /market data request/i });
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await waitFor(() => expect(resolvers).toHaveLength(2));

    // Newest resolves first with one candle, then the stale first request
    // resolves with five. The stale result must be discarded.
    resolvers[1]!(jsonResponse(successBody(CANDLES.slice(0, 1))));
    await screen.findByRole('table');
    resolvers[0]!(jsonResponse(successBody(CANDLES)));

    await waitFor(() => {
      // 1 data row + 1 header row — still the newer response.
      expect(screen.getAllByRole('row')).toHaveLength(2);
    });
  });

  it('does not render an error when the request was cancelled', async () => {
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal!.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        }),
    );
    const user = userEvent.setup();
    render(<ChartWorkspace />);
    await load(user);
    const form = screen.getByRole('form', { name: /market data request/i });
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    // The aborted first request must not paint an error over the new loading state.
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });
});
