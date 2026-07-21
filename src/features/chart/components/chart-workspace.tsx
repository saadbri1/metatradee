'use client';

/**
 * Professional historical-chart workspace.
 *
 * Request discipline: no request on mount, one explicit load action, bounded
 * sequential chunks for wider sessions, abort on superseding submit/unmount,
 * and stale-response guards. Replay and simulated orders operate only on the
 * assembled candle array and never cross a network boundary.
 */
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Database } from 'lucide-react';
import { cn } from '@/lib/utils';
import { summarizeCandles } from '../summary';
import type { Candle } from '../types';
import type { ChartCrosshairMode } from '../provider';
import {
  loadCandleSession,
  ChartRequestError,
  CHART_ERROR_COPY,
  type CandleResponse,
  type ChartErrorCode,
} from '../api';
import { ChartEmpty, ChartError, ChartLoading } from './states';
import {
  ChartControls,
  DEFAULT_CONTROLS,
  toIsoUtc,
  type ChartControlsValue,
} from './chart-controls';
import { ChartToolsRail } from './chart-tools-rail';
import { ChartSessionHeader } from './chart-session-header';
import { MarketToolbar } from './market-toolbar';
import { OrderPanel } from './order-panel';
import { ReplayTradingBar } from './replay-trading-bar';
import { WorkspaceBottomPanel, type WorkspaceTab } from './workspace-bottom-panel';
import { WorkspaceContextPanel } from './workspace-context-panel';
import {
  MIN_REPLAY_CANDLES,
  currentCandle,
  currentTimestamp,
  initializeReplayViewport,
  replayChartWindow,
  resetReplayViewport,
  resumeReplayFollow,
  selectReplayStartCursor,
  suspendReplayFollow,
  visibleCandles,
  type ReplayViewportState,
} from '@/features/replay';
import { useReplay } from '@/features/replay/use-replay';
import { ReplayToolbar } from '@/features/replay/components/replay-toolbar';
import {
  accountingSnapshot,
  demoAccountSnapshot,
  instrumentSpecification,
  simulationFillMarkers,
  simulationPriceLines,
  type OrderSide,
  type OrderType,
} from '@/features/simulation';
import { useSimulation } from '@/features/simulation/use-simulation';
import type { OrderTicketDraft } from '@/features/simulation/components/order-ticket';
import { useUIStore } from '@/store/ui-store';

const PriceChart = dynamic(() => import('./price-chart').then((module) => module.PriceChart), {
  ssr: false,
  loading: () => <ChartLoading height="100%" />,
});

const NO_CANDLES: Candle[] = [];

type WorkspaceState =
  | { status: 'initial' }
  | { status: 'loading' }
  | { status: 'success'; response: CandleResponse }
  | { status: 'error'; code: ChartErrorCode; detail?: string };

function sameRequest(a: ChartControlsValue, b: ChartControlsValue): boolean {
  return (
    a.symbol.trim() === b.symbol.trim() &&
    a.timeframe === b.timeframe &&
    a.start === b.start &&
    a.end === b.end
  );
}

function formatUtc(seconds: number | null): string | null {
  if (seconds === null) return null;
  return `${new Date(seconds * 1000).toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

export function ChartWorkspace() {
  const [controls, setControls] = useState<ChartControlsValue>(DEFAULT_CONTROLS);
  const [loadedControls, setLoadedControls] = useState<ChartControlsValue | null>(null);
  const [state, setState] = useState<WorkspaceState>({ status: 'initial' });
  const [priceScaleLocked, setPriceScaleLocked] = useState(false);
  const [fitRequest, setFitRequest] = useState(0);
  const [resetRequest, setResetRequest] = useState(0);
  const [volumeVisible, setVolumeVisible] = useState(true);
  const [annotationsVisible, setAnnotationsVisible] = useState(true);
  const [crosshairMode, setCrosshairMode] = useState<ChartCrosshairMode>('free');
  const [marketOpen, setMarketOpen] = useState(false);
  const [contextPanelOpen, setContextPanelOpen] = useState(false);
  const [orderPanelOpen, setOrderPanelOpen] = useState(false);
  const [orderSide, setOrderSide] = useState<OrderSide>('buy');
  const [bottomTab, setBottomTab] = useState<WorkspaceTab>('trade_note');
  const [bottomCollapsed, setBottomCollapsed] = useState(true);
  const [workspaceExpanded, setWorkspaceExpanded] = useState(false);
  const [playbookNote, setPlaybookNote] = useState('');
  const [contextNote, setContextNote] = useState('');
  const [tradeNote, setTradeNote] = useState('');
  const [dailyJournal, setDailyJournal] = useState('');
  const [replayViewport, setReplayViewport] = useState<ReplayViewportState | null>(null);
  const setMobileDrawerOpen = useUIStore((store) => store.setMobileDrawerOpen);

  const replay = useReplay();
  const replayActive = replay.state.status !== 'idle';
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const simulationIdRef = useRef(1);
  const replayRef = useRef({ active: replayActive, replay });
  replayRef.current = { active: replayActive, replay };
  const orderPanelOpenRef = useRef(orderPanelOpen);
  orderPanelOpenRef.current = orderPanelOpen;
  const marketOpenRef = useRef(marketOpen);
  marketOpenRef.current = marketOpen;
  const expandedRef = useRef(workspaceExpanded);
  expandedRef.current = workspaceExpanded;
  const openOrderPanelRef = useRef<(side?: OrderSide) => void>(() => undefined);
  const exitReplayRef = useRef<() => void>(() => undefined);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (
      typeof window.matchMedia === 'function' &&
      !window.matchMedia('(min-width: 1024px)').matches
    ) {
      setContextPanelOpen(false);
    }
  }, []);

  useEffect(() => {
    const isTyping = (target: EventTarget | null): target is HTMLElement => {
      if (!(target instanceof HTMLElement)) return false;
      return (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      );
    };
    const isInteractive = (target: EventTarget | null): boolean =>
      target instanceof HTMLElement && (target.tagName === 'BUTTON' || target.tagName === 'A');

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      const { active, replay: replayApi } = replayRef.current;

      if (event.key === 'Escape') {
        if (target?.closest('[data-radix-popper-content-wrapper], [role="dialog"]')) return;
        if (target?.closest('[aria-label="Simulated order panel"]')) {
          setOrderPanelOpen(false);
          return;
        }
        if (marketOpenRef.current) {
          setMarketOpen(false);
          return;
        }
        if (orderPanelOpenRef.current) {
          setOrderPanelOpen(false);
          return;
        }
        if (expandedRef.current) {
          setWorkspaceExpanded(false);
          return;
        }
        if (active && !isTyping(target)) exitReplayRef.current();
        else if (isTyping(target)) target.blur();
        return;
      }

      if (isTyping(target)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (active && !isInteractive(target)) {
        switch (event.key) {
          case ' ':
            event.preventDefault();
            replayApi.togglePlay();
            return;
          case 'ArrowRight':
            event.preventDefault();
            if (event.shiftKey) replayApi.advance(10);
            else replayApi.next();
            return;
          case 'ArrowLeft':
            event.preventDefault();
            replayApi.previous();
            return;
        }
        if (event.key.toLowerCase() === 'r' && !event.shiftKey) {
          replayApi.reset();
          setReplayViewport((current) => (current ? resetReplayViewport(current) : current));
          return;
        }
        if (event.key.toLowerCase() === 'b' && !event.shiftKey) {
          openOrderPanelRef.current('buy');
          return;
        }
        if (event.key.toLowerCase() === 's' && !event.shiftKey) {
          openOrderPanelRef.current('sell');
          return;
        }
      }

      const tab = (
        {
          '1': 'orders',
          '2': 'executions',
          '3': 'trade_note',
          '4': 'session',
          '5': 'daily_journal',
          '6': 'positions',
        } as const
      )[event.key as '1' | '2' | '3' | '4' | '5' | '6'];
      if (tab) {
        setBottomTab(tab);
        setBottomCollapsed(false);
        return;
      }

      switch (event.key.toLowerCase()) {
        case 'l':
          setPriceScaleLocked((locked) => !locked);
          break;
        case 'f':
          if (replayRef.current.active) {
            setReplayViewport((current) =>
              current ? suspendReplayFollow(current, replayApi.state.cursor) : current,
            );
          }
          setFitRequest((request) => request + 1);
          break;
        case 'o':
          if (replayRef.current.active) setOrderPanelOpen((open) => !open);
          break;
        case '/':
          event.preventDefault();
          setMarketOpen(true);
          requestAnimationFrame(() => document.getElementById('chart-symbol')?.focus());
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const submit = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = ++requestIdRef.current;
    const isCurrent = () => requestId === requestIdRef.current;
    const requested: ChartControlsValue = { ...controls, symbol: controls.symbol.trim() };
    setState({ status: 'loading' });

    try {
      const response = await loadCandleSession(
        {
          symbol: requested.symbol,
          timeframe: requested.timeframe,
          start: toIsoUtc(requested.start),
          end: toIsoUtc(requested.end),
        },
        controller.signal,
      );
      if (isCurrent()) {
        setState({ status: 'success', response });
        setLoadedControls(requested);
        setMarketOpen(false);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      if (!isCurrent()) return;
      if (error instanceof ChartRequestError) {
        setState({ status: 'error', code: error.code, detail: error.detail });
      } else {
        setState({ status: 'error', code: 'unexpected' });
      }
    }
  }, [controls]);

  const response = state.status === 'success' ? state.response : null;
  const candles = response?.candles ?? NO_CANDLES;
  const simulation = useSimulation(replay.state, candles);
  const replayCandles = useMemo(() => visibleCandles(replay.state), [replay.state]);
  const replayWindow = useMemo(
    () => (replayActive && replayViewport ? replayChartWindow(replay.state, replayViewport) : null),
    [replay.state, replayActive, replayViewport],
  );
  const chartCandles = replayWindow?.candles ?? (replayActive ? replayCandles : candles);
  const accessibleCandles = replayActive ? replayCandles : candles;
  const summary = useMemo(() => summarizeCandles(accessibleCandles), [accessibleCandles]);
  const isEmpty = state.status === 'success' && candles.length === 0;
  const canReplay = response !== null && candles.length >= MIN_REPLAY_CANDLES;
  const canPlaceOrder =
    replayActive &&
    simulation.state !== null &&
    replay.state.status !== 'completed' &&
    replay.state.cursor < candles.length - 1;
  const replayCandle = currentCandle(replay.state);
  const replayRange = replayWindow?.logicalRange ?? null;
  /*
   * Position accounting: a pure fold over the deterministic fill log, marked
   * against the latest REVEALED candle close. The accounting module never sees
   * the candle window, so future bars cannot leak into P&L even during replay.
   */
  const specification = useMemo(
    () => (response ? instrumentSpecification(response.symbol) : null),
    [response],
  );
  const accounting = useMemo(() => {
    if (!specification || !simulation.state) return null;
    return accountingSnapshot(simulation.state.fills, specification, replayCandle?.close ?? null);
  }, [specification, simulation.state, replayCandle]);
  const demoAccount = useMemo(
    () => (accounting ? demoAccountSnapshot(accounting) : null),
    [accounting],
  );
  const orderLines = useMemo(
    () => simulationPriceLines(simulation.state, accounting),
    [simulation.state, accounting],
  );
  const fillMarkers = useMemo(
    () => simulationFillMarkers(simulation.state, specification),
    [simulation.state, specification],
  );
  const chartFillMarkers = useMemo(() => {
    if (!replayActive) return fillMarkers;
    const times = new Set(chartCandles.map((candle) => candle.time));
    return fillMarkers.filter((marker) => times.has(marker.time));
  }, [chartCandles, fillMarkers, replayActive]);
  const hasSimulationActivity =
    simulation.state !== null &&
    (simulation.state.fills.length > 0 ||
      simulation.state.orders.some(
        (order) => order.status === 'working' || order.status === 'pending',
      ));
  const isDirty =
    loadedControls !== null && state.status !== 'loading' && !sameRequest(controls, loadedControls);

  const openOrderPanel = useCallback((side?: OrderSide) => {
    if (side) setOrderSide(side);
    setOrderPanelOpen(true);
  }, []);
  openOrderPanelRef.current = openOrderPanel;

  const exitReplay = useCallback(() => {
    if (
      hasSimulationActivity &&
      !window.confirm('Exit replay and discard all in-memory simulated orders and fills?')
    ) {
      return;
    }
    simulation.discard();
    replay.exit();
    setReplayViewport(null);
    setPriceScaleLocked(false);
    setOrderPanelOpen(false);
  }, [hasSimulationActivity, replay, simulation]);
  exitReplayRef.current = exitReplay;

  const submitOrder = useCallback(
    (draft: OrderTicketDraft): { ok: true } | { ok: false; message: string } => {
      if (!response || !replayCandle || !canPlaceOrder) {
        return { ok: false, message: 'Orders require at least one future replay candle.' };
      }
      const numberOrNaN = (value: string) => (value.trim() === '' ? Number.NaN : Number(value));
      const quantity = numberOrNaN(draft.quantity);
      const price = numberOrNaN(draft.price);
      const stopLoss = numberOrNaN(draft.stopLoss);
      const takeProfit = numberOrNaN(draft.takeProfit);
      const sequence = simulationIdRef.current++;
      const id = `sim-order-${sequence}`;
      const entry = {
        id,
        symbol: response.symbol,
        side: draft.side,
        type: draft.type as OrderType,
        quantity,
        ...(draft.type === 'limit' ? { limitPrice: price } : {}),
        ...(draft.type === 'stop' ? { stopPrice: price } : {}),
      };
      const hasStopLoss = draft.stopLoss.trim() !== '';
      const hasTakeProfit = draft.takeProfit.trim() !== '';
      const result =
        hasStopLoss || hasTakeProfit
          ? simulation.placeBracket({
              entry,
              stopLoss: hasStopLoss ? { id: `${id}-sl`, price: stopLoss } : undefined,
              takeProfit: hasTakeProfit ? { id: `${id}-tp`, price: takeProfit } : undefined,
              ocoGroupId: `${id}-oco`,
              entryReferencePrice:
                draft.type === 'market'
                  ? replayCandle.close
                  : draft.type === 'limit'
                    ? entry.limitPrice
                    : entry.stopPrice,
            })
          : simulation.place(entry);
      if (!result) return { ok: false, message: 'Replay simulation is not ready.' };
      if (result.ok) {
        setBottomTab('orders');
        return { ok: true };
      }
      return { ok: false, message: result.error.message };
    },
    [canPlaceOrder, replayCandle, response, simulation],
  );

  const submitQuickOrder = useCallback(
    (side: OrderSide, quantity: number): { ok: true } | { ok: false; message: string } =>
      submitOrder({
        side,
        type: 'market',
        quantity: String(quantity),
        price: '',
        stopLoss: '',
        takeProfit: '',
      }),
    [submitOrder],
  );

  const submitAdvancedOrder = useCallback(
    (draft: OrderTicketDraft): { ok: true } | { ok: false; message: string } => {
      const result = submitOrder(draft);
      if (result.ok) setBottomCollapsed(false);
      return result;
    },
    [submitOrder],
  );

  const fitView = useCallback(() => {
    if (replayActive) {
      setReplayViewport((current) =>
        current ? suspendReplayFollow(current, replay.state.cursor) : current,
      );
    }
    setFitRequest((request) => request + 1);
  }, [replay.state.cursor, replayActive]);

  const resetView = useCallback(() => {
    setPriceScaleLocked(false);
    if (replayActive) {
      setReplayViewport((current) => (current ? resumeReplayFollow(current) : current));
    } else {
      setResetRequest((request) => request + 1);
    }
  }, [replayActive]);

  const dataStatus =
    state.status === 'loading'
      ? 'Loading historical data'
      : state.status === 'success'
        ? 'Historical data ready'
        : state.status === 'error'
          ? 'Data request failed'
          : 'No data loaded';

  return (
    <section
      aria-label="Trading workspace"
      data-testid="professional-trading-workspace"
      data-layout="session-header toolbar tools chart trading-bar replay context order results journal"
      data-replay-state={replay.state.status}
      data-replay-follow={replayViewport?.following ? 'following' : 'manual'}
      className={cn(
        // Route-scoped dark terminal; platform routes keep their own surface.
        'chart-terminal',
        'flex h-dvh min-h-[38rem] flex-col overflow-hidden bg-background text-foreground',
        replayActive && 'ring-1 ring-inset ring-primary/30',
        workspaceExpanded && 'fixed inset-0 z-[60] h-dvh min-h-0 border-0',
      )}
    >
      <ChartSessionHeader
        response={response}
        replayActive={replayActive}
        canReplay={canReplay}
        replayTime={replayActive ? formatUtc(currentTimestamp(replay.state)) : null}
        contextPanelOpen={contextPanelOpen}
        orderPanelOpen={orderPanelOpen}
        expanded={workspaceExpanded}
        onOpenNavigation={() => setMobileDrawerOpen(true)}
        onToggleContextPanel={() => setContextPanelOpen((open) => !open)}
        onStartReplay={() => {
          const startCursor = selectReplayStartCursor(candles.length);
          replay.start(candles, startCursor);
          setReplayViewport(initializeReplayViewport(startCursor));
          // Quick Buy/Sell stays visible below the chart. Advanced parameters
          // remain closed until requested so the chart is never obscured by
          // default.
          setOrderPanelOpen(false);
        }}
        onExitReplay={exitReplay}
        onToggleOrderPanel={() => setOrderPanelOpen((open) => !open)}
        onFit={fitView}
        onReset={resetView}
        onToggleExpanded={() => setWorkspaceExpanded((expanded) => !expanded)}
      />

      <div className="flex min-h-0 flex-1">
        <WorkspaceContextPanel
          open={contextPanelOpen}
          onOpenChange={setContextPanelOpen}
          response={response}
          replay={replay.state}
          simulation={simulation.state}
          accounting={accounting}
          demoAccount={demoAccount}
          playbookNote={playbookNote}
          onPlaybookNoteChange={setPlaybookNote}
          contextNote={contextNote}
          onContextNoteChange={setContextNote}
        />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <MarketToolbar
            symbol={response?.symbol ?? null}
            timeframe={response?.timeframe ?? null}
            range={response ? `${response.start} → ${response.end}` : null}
            candleCount={response?.candles.length ?? null}
            provider={response?.provider ?? null}
            dataStatus={dataStatus}
            dirty={isDirty}
            marketOpen={marketOpen}
            onMarketOpenChange={setMarketOpen}
            marketControls={
              <ChartControls
                value={controls}
                onChange={setControls}
                onSubmit={submit}
                loading={state.status === 'loading'}
                disabled={replayActive}
                compact
              />
            }
            onFit={fitView}
            scaleLocked={priceScaleLocked}
            onToggleScaleLock={() => setPriceScaleLocked((locked) => !locked)}
            volumeVisible={volumeVisible}
            onToggleVolume={() => setVolumeVisible((visible) => !visible)}
            annotationsVisible={annotationsVisible}
            onToggleAnnotations={() => setAnnotationsVisible((visible) => !visible)}
          />

          {/*
            The chart row is the only flexible band in the column: header,
            toolbar, replay strip and bottom panel are all `shrink-0`, so every
            pixel they don't claim goes here. At 1600×900 with the bottom panel
            open that settles around 60% of viewport height — chart-dominant,
            with the journal still usable and no page scroll (the root is
            `h-dvh overflow-hidden`).
          */}
          <div className="flex min-h-[18rem] min-w-0 flex-1">
            <ChartToolsRail
              crosshairMode={crosshairMode}
              onCrosshairModeChange={setCrosshairMode}
              onFit={fitView}
              onReset={resetView}
              scaleLocked={priceScaleLocked}
              onToggleScaleLock={() => setPriceScaleLocked((locked) => !locked)}
              volumeVisible={volumeVisible}
              onToggleVolume={() => setVolumeVisible((visible) => !visible)}
              annotationsVisible={annotationsVisible}
              onToggleAnnotations={() => setAnnotationsVisible((visible) => !visible)}
              workspaceExpanded={workspaceExpanded}
              onToggleWorkspaceExpanded={() => setWorkspaceExpanded((expanded) => !expanded)}
            />

            <section
              aria-label="Price chart"
              data-testid="dominant-chart-pane"
              className="relative min-h-0 min-w-0 flex-1 bg-card"
            >
              {state.status === 'initial' ? (
                <ChartInitial />
              ) : state.status === 'loading' ? (
                <ChartLoading height="100%" />
              ) : state.status === 'error' ? (
                <ChartError
                  height="100%"
                  message={`${CHART_ERROR_COPY[state.code].title}. ${
                    state.detail ?? CHART_ERROR_COPY[state.code].hint
                  }`}
                />
              ) : isEmpty ? (
                <ChartEmpty height="100%" />
              ) : (
                <PriceChart
                  candles={chartCandles}
                  height="100%"
                  watermark={response ? `${response.symbol} · ${response.timeframe}` : undefined}
                  priceScaleLocked={priceScaleLocked}
                  fitRequest={fitRequest}
                  resetRequest={resetRequest}
                  volumeVisible={volumeVisible}
                  crosshairMode={crosshairMode}
                  orderAnnotationsVisible={annotationsVisible}
                  replayMode={replayActive}
                  logicalRange={replayRange}
                  logicalIndexOffset={replayWindow?.startIndex ?? 0}
                  logicalRangeRevision={replayViewport?.revision ?? 0}
                  onManualViewportChange={
                    replayActive
                      ? () =>
                          setReplayViewport((current) =>
                            current ? suspendReplayFollow(current, replay.state.cursor) : current,
                          )
                      : undefined
                  }
                  orderLines={orderLines}
                  fillMarkers={chartFillMarkers}
                />
              )}
            </section>
          </div>

          {/*
            THE REPLAY TERMINAL. One bordered surface holding the trading row
            and the transport row. Previously these were two independently
            bordered strips (~89px of chrome); merging them removes a duplicate
            frame and gives the height back to the chart, which is the priority
            whenever the two compete.
          */}
          <div className="min-w-0 shrink-0 border-t border-border bg-card empty:hidden">
            {replayActive && response && replayCandle && demoAccount ? (
              <ReplayTradingBar
                symbol={response.symbol}
                currentPrice={replayCandle.close}
                account={demoAccount}
                canTrade={canPlaceOrder}
                onMarketOrder={submitQuickOrder}
                onOpenAdvanced={openOrderPanel}
              />
            ) : null}
            {replayActive ? (
              <ReplayToolbar
                state={replay.state}
                onTogglePlay={replay.togglePlay}
                onNext={replay.next}
                onAdvanceTen={() => replay.advance(10)}
                onPrevious={replay.previous}
                onReset={() => {
                  replay.reset();
                  setReplayViewport((current) =>
                    current ? resetReplayViewport(current) : current,
                  );
                }}
                following={replayViewport?.following ?? false}
                onResumeFollow={() =>
                  setReplayViewport((current) => (current ? resumeReplayFollow(current) : current))
                }
                onSpeedChange={replay.setSpeed}
                onExit={exitReplay}
              />
            ) : (
              <div className="flex min-h-9 items-center justify-between gap-3 px-3 text-[10px] text-muted-foreground">
                <span className="truncate">
                  {response && !canReplay
                    ? 'Replay needs at least 2 candles.'
                    : response
                      ? 'Replay ready · Simulated orders remain browser-session only.'
                      : 'Load candles to enable replay and simulated orders.'}
                </span>
                <span className="hidden shrink-0 sm:inline">
                  Charts by{' '}
                  <a
                    href="https://www.tradingview.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    TradingView
                  </a>{' '}
                  Lightweight Charts™
                </span>
              </div>
            )}
          </div>

          <div
            className={cn(
              'min-h-0 shrink-0 transition-[height] duration-150',
              bottomCollapsed ? 'h-8' : 'h-[min(14rem,32dvh)]',
            )}
          >
            <WorkspaceBottomPanel
              value={bottomTab}
              onValueChange={setBottomTab}
              collapsed={bottomCollapsed}
              onCollapsedChange={setBottomCollapsed}
              response={response}
              candles={accessibleCandles}
              summary={summary}
              replay={replay.state}
              simulation={simulation.state}
              accounting={accounting}
              demoAccount={demoAccount}
              tradeNote={tradeNote}
              onTradeNoteChange={setTradeNote}
              dailyJournal={dailyJournal}
              onDailyJournalChange={setDailyJournal}
              onCancelOrder={simulation.cancel}
            />
          </div>
        </div>
      </div>

      <OrderPanel
        open={orderPanelOpen}
        onOpenChange={setOrderPanelOpen}
        side={orderSide}
        symbol={response?.symbol ?? null}
        currentPrice={replayCandle?.close ?? null}
        replayActive={replayActive}
        canSubmit={canPlaceOrder}
        onSubmit={submitAdvancedOrder}
        simulation={simulation.state}
        onCancelOrder={simulation.cancel}
      />

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {simulation.announcement}
      </p>
      <p className="sr-only" aria-live="polite">
        Order panel {orderPanelOpen ? 'expanded' : 'collapsed'}.
      </p>
    </section>
  );
}

/*
 * The initial state intentionally stays inside the chart pane: the market
 * selector is a deliberate action and no provider request occurs on mount.
 */
function ChartInitial() {
  return (
    <div className="relative flex h-full min-h-72 flex-col items-center justify-center overflow-hidden border border-border bg-card">
      <div aria-hidden className="absolute inset-x-0 top-1/2 h-px bg-border/60" />
      <div aria-hidden className="absolute inset-y-0 left-1/2 w-px bg-border/40" />
      <div className="relative flex max-w-md flex-col items-center border border-border bg-background/80 px-8 py-7 text-center shadow-xl shadow-background/30 backdrop-blur-sm">
        <span className="mb-3 flex size-10 items-center justify-center border border-primary/30 bg-primary/10 text-primary">
          <Database className="size-5" aria-hidden />
        </span>
        <p className="text-sm font-semibold">No candles loaded</p>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          Build a historical replay session from Change market. Choose a dated contract and UTC
          range, then load real candles. Nothing is requested until you confirm.
        </p>
      </div>
    </div>
  );
}
