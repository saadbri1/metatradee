'use client';

/**
 * Chart workspace — real historical provider data only.
 *
 * NO FIXTURE FALLBACK EXISTS ON THIS PATH. If a request fails, the failure is
 * shown. Synthetic candles are never substituted, because a plausible-looking
 * invented price is worse than a visible error for someone reading a chart to
 * make a decision.
 *
 * Request discipline (every provider call is billed, so this matters):
 *   • Nothing loads until the user asks. No request on mount.
 *   • A new submit aborts the in-flight request before starting another.
 *   • Unmount aborts the in-flight request.
 *   • Responses carry a request id; only the newest may update state, so a slow
 *     earlier response can never overwrite a newer one.
 *
 * The chart is loaded client-only via next/dynamic — the vendor touches
 * `document` at construction and must not be server-rendered.
 */
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CircleDashed, Crosshair, Move, ZoomIn, Database } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { summarizeCandles } from '../summary';
import type { Candle } from '../types';
import {
  loadCandles,
  ChartRequestError,
  CHART_ERROR_COPY,
  type CandleResponse,
  type ChartErrorCode,
} from '../api';
import { CandleSummaryPanel } from './candle-summary';
import { ChartEmpty, ChartError, ChartLoading } from './states';
import {
  ChartControls,
  DEFAULT_CONTROLS,
  toIsoUtc,
  type ChartControlsValue,
} from './chart-controls';

const PriceChart = dynamic(() => import('./price-chart').then((m) => m.PriceChart), {
  ssr: false,
  loading: () => <ChartLoading />,
});

/** Shared empty series — a stable reference, so memoization actually holds. */
const NO_CANDLES: Candle[] = [];

const TOOLS = [
  { icon: Crosshair, label: 'Crosshair' },
  { icon: Move, label: 'Pan' },
  { icon: ZoomIn, label: 'Zoom' },
] as const;

type WorkspaceState =
  | { status: 'initial' }
  | { status: 'loading' }
  | { status: 'success'; response: CandleResponse }
  | { status: 'error'; code: ChartErrorCode; detail?: string };

/** Field-wise equality — the dirty check must not depend on object identity. */
function sameRequest(a: ChartControlsValue, b: ChartControlsValue): boolean {
  return (
    a.symbol.trim() === b.symbol.trim() &&
    a.timeframe === b.timeframe &&
    a.start === b.start &&
    a.end === b.end
  );
}

export function ChartWorkspace() {
  const [controls, setControls] = useState<ChartControlsValue>(DEFAULT_CONTROLS);
  const [state, setState] = useState<WorkspaceState>({ status: 'initial' });
  /**
   * The controls snapshot behind the last SUCCESSFUL load. The header and
   * series metadata always describe this snapshot (via the response), never the
   * live draft — editing a control must not relabel data it didn't produce.
   */
  const [loadedControls, setLoadedControls] = useState<ChartControlsValue | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  // Abort whatever is in flight when the workspace goes away, so a dropped page
  // does not leave a billed request running to completion.
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const submit = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const requestId = ++requestIdRef.current;
    /** Only the newest request may write state. */
    const isCurrent = () => requestId === requestIdRef.current;

    setState({ status: 'loading' });
    const requested: ChartControlsValue = { ...controls, symbol: controls.symbol.trim() };

    try {
      const response = await loadCandles(
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
      }
    } catch (error) {
      // A cancelled request is not a failure and must not paint an error over
      // whatever the user is now waiting for.
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
  // Stable identity when there is no response — `?? []` would allocate a fresh
  // array every render and defeat the memo below.
  const candles = response?.candles ?? NO_CANDLES;
  const summary = useMemo(() => summarizeCandles(candles), [candles]);
  const isEmpty = state.status === 'success' && candles.length === 0;
  /** Draft controls differ from what the chart is actually showing. */
  const isDirty =
    loadedControls !== null && state.status !== 'loading' && !sameRequest(controls, loadedControls);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h1 className="font-display text-2xl font-semibold tracking-tight">Chart</h1>
          {response ? (
            <span className="tabular text-sm text-muted-foreground">
              {response.symbol} · {response.timeframe}
            </span>
          ) : null}
        </div>
        {/*
          Provenance is only claimed once a response has actually arrived from
          the production API. Before that, the page says nothing about its data.
        */}
        <div className="flex items-center gap-2">
          {isDirty ? (
            <p
              role="status"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-muted-foreground"
            >
              <CircleDashed className="size-3.5" aria-hidden />
              Changes not loaded — press Load candles
            </p>
          ) : null}
          {response ? (
            <p className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
              <Database className="size-3.5" aria-hidden />
              Real historical market data ·{' '}
              {response.provider === 'databento' ? 'Databento' : response.provider}
            </p>
          ) : null}
        </div>
      </div>

      <ChartControls
        value={controls}
        onChange={setControls}
        onSubmit={submit}
        loading={state.status === 'loading'}
      />

      <div className="flex gap-4">
        <aside
          aria-label="Chart tools"
          className="hidden w-12 shrink-0 flex-col items-center gap-1 rounded-lg border border-border bg-card py-2 sm:flex"
        >
          {TOOLS.map((t) => (
            <span
              key={t.label}
              title={t.label}
              className="flex size-8 items-center justify-center rounded-md text-muted-foreground"
            >
              <t.icon className="size-4" aria-hidden />
              <span className="sr-only">{t.label}</span>
            </span>
          ))}
        </aside>

        <div className="min-w-0 flex-1">
          {state.status === 'initial' ? (
            <ChartInitial />
          ) : state.status === 'loading' ? (
            <ChartLoading />
          ) : state.status === 'error' ? (
            <ChartError
              message={`${CHART_ERROR_COPY[state.code].title}. ${
                state.detail ?? CHART_ERROR_COPY[state.code].hint
              }`}
            />
          ) : isEmpty ? (
            <ChartEmpty />
          ) : (
            <PriceChart
              candles={candles}
              watermark={response ? `${response.symbol} · ${response.timeframe}` : undefined}
            />
          )}
        </div>

        <aside aria-label="Series details" className="hidden w-64 shrink-0 lg:block">
          <Card>
            <CardContent className="space-y-3 p-4 text-sm">
              <h2 className="font-medium">Series</h2>
              <dl className="space-y-1.5 text-muted-foreground">
                <Row label="Contract" value={response?.symbol ?? '—'} />
                <Row label="Timeframe" value={response?.timeframe ?? '—'} />
                <Row label="Candles" value={response ? String(summary.count) : '—'} />
                <Row label="High" value={summary.high?.toFixed(2) ?? '—'} />
                <Row label="Low" value={summary.low?.toFixed(2) ?? '—'} />
                <Row
                  label="Volume"
                  value={response ? summary.totalVolume.toLocaleString('en-US') : '—'}
                />
              </dl>
              {response ? (
                <p className="border-t border-border pt-3 text-xs text-muted-foreground">
                  Requested range
                  <br />
                  <span className="tabular">{response.start}</span>
                  <br />
                  to <span className="tabular">{response.end}</span>
                </p>
              ) : null}
            </CardContent>
          </Card>
        </aside>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-4 py-2 text-xs text-muted-foreground">
        <span>
          {response
            ? `Source: ${response.provider === 'databento' ? 'Databento' : response.provider} · Real historical provider data · Replay and simulated orders are not enabled yet.`
            : 'Replay and simulated orders are not enabled yet.'}
        </span>
        {/*
          REQUIRED ATTRIBUTION (Apache-2.0, © 2023 TradingView). The licence
          requires naming TradingView as the creator and linking to
          tradingview.com from a user-visible page. The in-chart
          `attributionLogo` is also left enabled.
        */}
        <span>
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

      {response ? (
        <CandleSummaryPanel candles={candles} summary={summary} symbol={response.symbol} />
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt>{label}</dt>
      <dd className="tabular text-foreground">{value}</dd>
    </div>
  );
}

/** Nothing has been requested yet — say so plainly rather than showing a blank. */
function ChartInitial({ height = 460 }: { height?: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div
          className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border"
          style={{ height }}
        >
          <Database className="size-8 text-muted-foreground" aria-hidden />
          <p className="text-sm font-medium">No candles loaded</p>
          <p className="max-w-sm text-center text-sm text-muted-foreground">
            Choose a dated contract, timeframe and UTC range above, then select Load candles.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
