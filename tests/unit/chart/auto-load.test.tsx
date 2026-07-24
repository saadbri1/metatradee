/**
 * The production contract: opening /chart loads real candles automatically.
 * No Change-market form, no manual date entry, no "no candles loaded" state.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { Candle } from '@/features/chart/types';

vi.mock('@/features/chart/components/price-chart', () => ({
  PriceChart: ({ candles }: { candles: Candle[] }) => (
    <div data-testid="price-chart">{candles.length} candles rendered</div>
  ),
}));

import { ChartWorkspace } from '@/features/chart/components/chart-workspace';

const CANDLES: Candle[] = [
  { time: 1654548600, open: 4120, high: 4122, low: 4119, close: 4121, volume: 100 },
  { time: 1654548660, open: 4121, high: 4123, low: 4120, close: 4122, volume: 120 },
  { time: 1654548720, open: 4122, high: 4124, low: 4121, close: 4123, volume: 140 },
];

function ok(candles: readonly Candle[] = CANDLES) {
  return new Response(
    JSON.stringify({
      data: {
        symbol: 'ESM2',
        timeframe: '1m',
        start: '2022-06-06T20:50:00Z',
        end: '2022-06-06T21:50:00Z',
        provider: 'databento',
        candles,
      },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  window.localStorage.clear();
  fetchMock = vi.fn(async () => ok());
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('automatic first load', () => {
  it('requests a session on open without any user interaction', async () => {
    render(<ChartWorkspace />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    // The starter session is a real historical contract/range, not a fixture.
    const url = String(fetchMock.mock.calls[0]![0]);
    expect(url).toContain('symbol=ESM2');
    expect(url).toContain('start=2022-06-06');
  });

  it('renders candles without opening Change market', async () => {
    render(<ChartWorkspace />);
    expect(await screen.findByTestId('price-chart')).toHaveTextContent('3 candles rendered');
    // The rejected empty state must never be the normal initial state.
    expect(screen.queryByText(/no candles loaded/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /load candles/i })).not.toBeInTheDocument();
  });

  it('persists the loaded session so the next visit opens on data', async () => {
    render(<ChartWorkspace />);
    await screen.findByTestId('price-chart');
    await waitFor(() => {
      const saved = window.localStorage.getItem('metatradee-chart-session');
      expect(saved).not.toBeNull();
      expect(JSON.parse(saved!)).toMatchObject({ symbol: 'ESM2', timeframe: '1m' });
    });
  });

  it('loads the saved session instead of the starter on a later visit', async () => {
    window.localStorage.setItem(
      'metatradee-chart-session',
      JSON.stringify({
        symbol: 'MESU4',
        timeframe: '5m',
        start: '2024-06-10T13:30',
        end: '2024-06-10T20:00',
      }),
    );
    render(<ChartWorkspace />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(String(fetchMock.mock.calls[0]![0])).toContain('symbol=MESU4');
  });

  it('falls back to the starter session when the saved one is invalid', async () => {
    window.localStorage.setItem('metatradee-chart-session', JSON.stringify({ symbol: 'X' }));
    render(<ChartWorkspace />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(String(fetchMock.mock.calls[0]![0])).toContain('symbol=ESM2');
  });

  it('keeps the workspace and offers recovery when the automatic load fails', async () => {
    fetchMock.mockImplementation(
      async () =>
        new Response(JSON.stringify({ error: { code: 'market_data_unavailable', message: 'x' } }), {
          status: 502,
          headers: { 'content-type': 'application/json' },
        }),
    );
    render(<ChartWorkspace />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    // The full workspace stays — never replaced by a giant error card.
    expect(screen.getByTestId('professional-trading-workspace')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /change market/i })).toBeInTheDocument();
  });
});
