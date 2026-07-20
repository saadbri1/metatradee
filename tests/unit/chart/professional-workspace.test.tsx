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
      'session-header context toolbar tools chart order replay results journal',
    );
    expect(screen.getByLabelText('Chart session header')).toBeInTheDocument();
    expect(screen.getByLabelText('Market toolbar')).toBeInTheDocument();
    expect(screen.getByLabelText('Working chart tools')).toBeInTheDocument();
    expect(screen.getByLabelText('Session context')).toBeInTheDocument();
    expect(screen.getByTestId('dominant-chart-pane')).toBeInTheDocument();
    expect(screen.getByLabelText('Simulated order panel')).toHaveAttribute(
      'data-responsive',
      'desktop-overlay medium-drawer small-bottom-sheet',
    );
    expect(screen.getByLabelText('Simulated order panel')).not.toBeVisible();
    expect(screen.getByLabelText('Charts and running results')).toBeInTheDocument();
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

  it('opens the order panel on replay start, stays collapsible, and honours O', async () => {
    const user = userEvent.setup();
    render(<ChartWorkspace />);
    await load(user);
    // Loaded review mode: no active ticket.
    const panel = screen.getByLabelText('Simulated order panel');
    expect(panel).not.toBeVisible();
    await user.click(screen.getByRole('button', { name: /start replay/i }));
    // Replay = trading mode: the ticket is open by default on desktop.
    expect(panel).toBeVisible();
    await user.click(within(panel).getByRole('button', { name: /close order panel/i }));
    expect(panel).not.toBeVisible();
    await user.keyboard('o');
    expect(panel).toBeVisible();
  });

  it('supports numeric tab shortcuts and honest session-only notes', async () => {
    const user = userEvent.setup();
    render(<ChartWorkspace />);
    const details = screen.getByLabelText('Trading workspace details');
    await user.keyboard('4');
    expect(within(details).getByRole('tab', { name: /session/i })).toHaveAttribute(
      'data-state',
      'active',
    );
    await user.keyboard('3');
    expect(within(details).getByRole('tab', { name: /^trade note$/i })).toHaveAttribute(
      'data-state',
      'active',
    );
    expect(screen.getByText(/session notes are not saved yet/i)).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: /^trade note$/i }), 'Opening range review');
    await user.click(within(details).getByRole('tab', { name: /session/i }));
    expect(screen.getByText(/no positions or P&L are inferred/i)).toBeInTheDocument();
    await user.keyboard('3');
    expect(screen.getByRole('textbox', { name: /^trade note$/i })).toHaveValue(
      'Opening range review',
    );
  });

  it('shows a deterministic replay progress rail without changing fetch discipline', async () => {
    const user = userEvent.setup();
    render(<ChartWorkspace />);
    await load(user);
    await user.click(screen.getByRole('button', { name: /start replay/i }));
    expect(screen.getByTestId('professional-trading-workspace')).toHaveAttribute(
      'data-replay-state',
      'ready',
    );
    expect(screen.getByRole('progressbar', { name: /replay progress/i })).toHaveAttribute(
      'aria-valuetext',
      '1 of 3 candles revealed',
    );
    expect(screen.getByText(/replay mode/i)).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
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
      expect(within(panel).getByRole('tab', { name: /executions/i })).toHaveAttribute(
        'data-state',
        'active',
      ),
    );
  });
});

describe('route-scoped light workspace', () => {
  /**
   * The workspace opts into the project's existing `.light` token set for this
   * route only. These tests pin the SCOPING CONTRACT — that the class is on the
   * workspace root and not leaked upward — because a later refactor of the root
   * className is exactly how a route-level theme decision gets dropped silently.
   */
  it('applies the light token scope to the workspace root', () => {
    const { container } = render(<ChartWorkspace />);
    const root = container.querySelector('[data-layout]');
    expect(root).not.toBeNull();
    expect(root).toHaveClass('light');
  });

  it('paints the scoped surface from tokens, never a hardcoded colour', () => {
    const { container } = render(<ChartWorkspace />);
    const root = container.querySelector('[data-layout]')!;
    expect(root).toHaveClass('bg-background');
    expect(root).toHaveClass('text-foreground');
    // No literal colour may appear on the root — tokens only.
    expect(root.className).not.toMatch(/#[0-9a-f]{3,8}\b|\brgb\(|\bhsl\(/i);
  });

  it('does not touch the global theme class on <html>', () => {
    const before = document.documentElement.className;
    render(<ChartWorkspace />);
    // next-themes owns <html>; a route-scoped workspace must never fight it.
    expect(document.documentElement.className).toBe(before);
  });
});

describe('workspace proportions', () => {
  /**
   * These pin the LAYOUT CONTRACT that makes /chart chart-dominant: the chart
   * row is the only flexible band, everything else is shrink-0, and the root
   * never scrolls. Pixel values live in Tailwind classes, so the assertions
   * target the structural classes rather than computed geometry (jsdom has no
   * layout engine and would report 0 for everything).
   */
  it('keeps the workspace to one viewport with no page scroll', () => {
    const { container } = render(<ChartWorkspace />);
    const root = container.querySelector('[data-layout]')!;
    expect(root).toHaveClass('h-dvh');
    expect(root).toHaveClass('overflow-hidden');
  });

  it('gives the chart row the only flexible band in the column', () => {
    const { container } = render(<ChartWorkspace />);
    const chartPane = screen.getByTestId('dominant-chart-pane');
    const chartRow = chartPane.parentElement!;
    expect(chartRow).toHaveClass('flex-1');
    // The replay/status strip and bottom panel must not compete for height.
    const column = chartRow.parentElement!;
    const fixedBands = Array.from(column.children).filter((el) => el !== chartRow);
    expect(fixedBands.length).toBeGreaterThan(0);
    for (const band of fixedBands) {
      expect(band.className).toMatch(/shrink-0/);
    }
    expect(container.querySelector('[data-layout]')).toBeTruthy();
  });

  it('opens with the context panel and bottom journal visible, order panel closed', () => {
    render(<ChartWorkspace />);
    // Chart-dominant does not mean chart-only: the journal is part of the
    // workflow, and the order drawer must never permanently narrow the chart.
    expect(screen.getByTestId('dominant-chart-pane')).toBeInTheDocument();
    // Scope to the header: "session context" is intentionally both a header
    // toggle and an overflow-menu item, so a global query is ambiguous.
    const header = within(screen.getByLabelText('Chart session header'));
    expect(header.getByRole('button', { name: /hide session context/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(header.getByRole('button', { name: /open order panel/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});

describe('replay trading lifecycle', () => {
  /**
   * Position accounting and the trading workflow. The engine itself is proven
   * in tests/unit/simulation/accounting.test.ts; these assert the WIRING —
   * panel discoverability and that Stats/Positions read the accounting fold,
   * never fabricated numbers.
   */
  it('opens the order panel with Buy and Sell when replay starts on desktop', async () => {
    const user = userEvent.setup();
    render(<ChartWorkspace />);
    await load(user);
    const header = within(screen.getByLabelText('Chart session header'));
    await user.click(header.getByRole('button', { name: /start replay/i }));

    const panel = screen.getByLabelText('Simulated order panel');
    expect(panel).toHaveAttribute('data-state', 'open');
    // Clear Buy and Sell side controls inside the ticket.
    const ticket = within(panel);
    expect(ticket.getByRole('button', { name: /^buy$/i })).toBeInTheDocument();
    expect(ticket.getByRole('button', { name: /^sell$/i })).toBeInTheDocument();
    // Collapsible: the user can put it away.
    await user.click(ticket.getByRole('button', { name: /close order panel/i }));
    expect(screen.getByLabelText('Simulated order panel')).toHaveAttribute('data-state', 'closed');
  });

  it('keeps the ticket inactive outside replay', async () => {
    const user = userEvent.setup();
    render(<ChartWorkspace />);
    await load(user);
    // Loaded review mode: panel closed, no active ticket anywhere.
    expect(screen.getByLabelText('Simulated order panel')).toHaveAttribute('data-state', 'closed');
  });

  it('shows honest empty accounting before any fill', async () => {
    const user = userEvent.setup();
    render(<ChartWorkspace />);
    await load(user);
    const context = within(screen.getByLabelText('Session context'));
    // P&L and Position sections exist but claim nothing without fills.
    expect(context.getByText('Net P&L')).toBeInTheDocument();
    expect(context.getByText('Average entry')).toBeInTheDocument();
    expect(context.queryByText(/\$\d/)).not.toBeInTheDocument();
  });

  it('exposes a Positions tab with an honest empty state', async () => {
    const user = userEvent.setup();
    render(<ChartWorkspace />);
    await load(user);
    await user.click(screen.getByRole('tab', { name: /positions/i }));
    expect(screen.getByText(/no position activity in this replay session/i)).toBeInTheDocument();
  });
});
