import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Candle } from '@/features/chart/types';

const chartProps = vi.hoisted(() => [] as Array<Record<string, unknown>>);
vi.mock('@/features/chart/components/price-chart', () => ({
  PriceChart: (props: Record<string, unknown> & { candles: Candle[] }) => {
    chartProps.push(props);
    return <div data-testid="workspace-provider-chart">{props.candles.length} candles</div>;
  },
}));

import { ChartWorkspace } from '@/features/chart/components/chart-workspace';

const CANDLES: Candle[] = [
  { time: 1654548600, open: 4120, high: 4122, low: 4119, close: 4121, volume: 100 },
  { time: 1654548660, open: 4121, high: 4123, low: 4120, close: 4122, volume: 120 },
  { time: 1654548720, open: 4122, high: 4124, low: 4121, close: 4123, volume: 140 },
];

function response() {
  return new Response(
    JSON.stringify({
      data: {
        symbol: 'ESM2',
        timeframe: '1m',
        start: '2022-06-06T20:50:00Z',
        end: '2022-06-06T20:53:00Z',
        provider: 'databento',
        candles: CANDLES,
      },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

async function load(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /change market/i }));
  await user.click(screen.getByRole('button', { name: /load candles/i }));
  await screen.findByTestId('workspace-provider-chart');
}

beforeEach(() => {
  chartProps.length = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => response()),
  );
});

afterEach(() => vi.unstubAllGlobals());

describe('professional workspace composition', () => {
  it('renders the dense hierarchy and only genuine chart tools', () => {
    render(<ChartWorkspace />);
    expect(screen.getByTestId('professional-trading-workspace')).toHaveAttribute(
      'data-layout',
      'toolbar tools chart order replay bottom',
    );
    expect(screen.getByLabelText('Market toolbar')).toBeInTheDocument();
    expect(screen.getByLabelText('Working chart tools')).toBeInTheDocument();
    expect(screen.getByTestId('dominant-chart-pane')).toBeInTheDocument();
    expect(screen.getByLabelText('Simulated order panel')).toHaveAttribute(
      'data-responsive',
      'desktop-persistent medium-drawer small-bottom-sheet',
    );
    expect(screen.getByLabelText('Trading workspace details')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /trend|fibonacci|brush|indicator/i }),
    ).not.toBeInTheDocument();
  });

  it('keeps the market draft behind Change market and never auto-fetches', async () => {
    const user = userEvent.setup();
    render(<ChartWorkspace />);
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.queryByLabelText(/contract/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /change market/i }));
    expect(screen.getByLabelText(/contract/i)).toHaveValue('ESM2');
    await user.selectOptions(screen.getByLabelText(/timeframe/i), '5m');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('routes working view controls through the provider wrapper', async () => {
    const user = userEvent.setup();
    render(<ChartWorkspace />);
    await load(user);
    const toolbar = screen.getByLabelText('Market toolbar');

    await user.click(within(toolbar).getByRole('button', { name: /hide volume/i }));
    expect(chartProps.at(-1)?.volumeVisible).toBe(false);
    await user.click(within(toolbar).getByRole('button', { name: /hide order annotations/i }));
    expect(chartProps.at(-1)?.orderAnnotationsVisible).toBe(false);
    await user.click(screen.getByRole('button', { name: /use magnet crosshair/i }));
    expect(chartProps.at(-1)?.crosshairMode).toBe('magnet');
  });

  it('collapses the order panel and reopens it with O', async () => {
    const user = userEvent.setup();
    render(<ChartWorkspace />);
    const panel = screen.getByLabelText('Simulated order panel');
    await user.click(within(panel).getByRole('button', { name: /collapse order panel/i }));
    expect(panel).not.toBeVisible();
    await user.keyboard('o');
    expect(panel).toBeVisible();
  });

  it('supports numeric tab shortcuts and honest Positions content', async () => {
    const user = userEvent.setup();
    render(<ChartWorkspace />);
    await user.keyboard('3');
    expect(screen.getByRole('tab', { name: /positions/i })).toHaveAttribute('data-state', 'active');
    expect(screen.getByText('Position tracking and P&L arrive in Phase 4.')).toBeInTheDocument();
    await user.keyboard('4');
    expect(screen.getByRole('tab', { name: /session/i })).toHaveAttribute('data-state', 'active');
  });

  it('uses loaded session metadata and performs no extra fetch during replay', async () => {
    const user = userEvent.setup();
    render(<ChartWorkspace />);
    await load(user);
    await user.click(screen.getByRole('button', { name: /start replay/i }));
    await user.keyboard('4');
    const details = screen.getByLabelText('Trading workspace details');
    expect(details).toHaveTextContent('ESM2');
    expect(details).toHaveTextContent('1m');
    expect(details).toHaveTextContent('databento · real historical data');
    expect(details).toHaveTextContent('1 of 3');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('collapses and expands the bottom panel without losing the selected tab', async () => {
    const user = userEvent.setup();
    render(<ChartWorkspace />);
    await user.keyboard('2');
    await user.click(screen.getByRole('button', { name: /collapse bottom panel/i }));
    const panel = screen.getByLabelText('Trading workspace details');
    expect(panel).toHaveAttribute('data-state', 'collapsed');
    await user.click(screen.getByRole('button', { name: /expand bottom panel/i }));
    expect(panel).toHaveAttribute('data-state', 'expanded');
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: /executions/i })).toHaveAttribute(
        'data-state',
        'active',
      ),
    );
  });
});
