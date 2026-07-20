# Chart & Backtesting Design

Three surfaces in this product draw or analyse trading data, and they are
routinely confused. This document fixes the boundary between them, and records
the market-data architecture as **implemented**.

Status: the price chart is connected to **real historical market data**, and a
browser-session candle replay can reveal an already-loaded window one bar at a
time. The charting library (`lightweight-charts@5.2.0`) and the market-data
provider (Databento) were both approved and are both wired.

## 1. Analytics charts (exists today)

Journal-derived aggregate charts: equity curve, drawdown, and the KPI and
breakdown surfaces around them.

- Values come from the **canonical calculation engine** — `computeEquityCurve`
  and `computeDrawdownStats` (`src/features/analytics/equity.ts`), `computeKpis`
  (`src/features/analytics/kpis.ts`). Financial formulas are never
  re-implemented for a chart.
- Rendering follows `src/features/analytics/components/equity-chart.tsx`:
  token-driven inline SVG, downsampling for dense series, `role="img"` plus a
  text summary, and a keyboard-reachable table alternative. P&L is never
  conveyed by colour alone.
- **These charts must not depend on market candles.** Their x-axis is trade
  sequence, not time-of-market; they are complete without any price data. This
  remains true now that candles exist — the two systems stay separate.

They are not a stepping stone to a price chart. Nothing here should be
generalized "so it can also draw candles later".

## 2. Historical journal backtesting — Tier 1

Analysis of trades **already stored in MetaTradee**. Nothing else.

- Requires **no chart engine and no external market-data provider**. This is the
  only tier the current data model can support.
- Reuses the canonical engine above for every metric. A backtest is a filtered
  re-computation over journaled trades, not a second analytics implementation.
- May later support: saved definitions, immutable run snapshots, computed
  metrics, the exact set of included trades, rerun, archive, and export where
  entitled. Snapshots are immutable so a past run is never silently rewritten.
- It is explicitly **not** market simulation. Any surface must say so plainly:
  results derive from journaled trades, not exchange-level fills.

**No plan assignment is recorded here.** No entitlement decision exists for
backtesting, and this document does not create one.

## 3. Historical price chart — implemented

### 3.1 Data architecture

One direction of flow, with exactly one boundary crossing per hop:

```
Databento historical API  (GLBX.MDP3, ohlcv-1m / ohlcv-1h)
  → server-only Databento client   src/features/market-data/databento/client.ts
  → authenticated candles API      GET /api/market-data/candles
  → browser chart workspace        src/features/chart/components/chart-workspace.tsx
  → Lightweight Charts             src/features/chart/components/price-chart.tsx
```

Supporting pure modules, none of which touch the network or secrets:
`databento/symbols.ts` (contract validation), `databento/normalize.ts`
(fixed-point and timestamp conversion), `databento/aggregate.ts` (timeframe
derivation), `market-data/request.ts` (query schema and cost limits).

### 3.2 Instruments and timeframes

Supported roots: **ES, MES, NQ, MNQ**.

**Explicit dated contracts only** — for example `ESZ5`, `MESZ5`, `NQZ5`,
`MNQZ5`. Bare roots (`ES`), parent symbols (`ES.FUT`) and continuous symbols
(`ES.v.0`, `ES.n.0`, `ES.c.0`) are rejected. A parent is never silently mapped
to a contract: the caller names the exact instrument that traded, so there is no
synthetic rollover seam in the data.

Supported timeframes: **1m, 5m, 15m, 1h**.

- `1m` → provider schema `ohlcv-1m`, used natively.
- `1h` → provider schema `ohlcv-1h`, used natively.
- **`5m` and `15m` are aggregated from provider 1-minute bars.** GLBX.MDP3
  offers no native 5m or 15m schema. Aggregation is deterministic: bucket by
  `floor(time / interval) * interval` in UTC, open from the earliest minute,
  close from the latest, max high, min low, summed volume. Buckets are built
  only from the minutes actually present — a partial bucket yields a real bar
  over the minutes that exist rather than a padded or invented one.

Provider values are converted once, in `normalize.ts`: prices are fixed-point
and divided by `1e9`; `ts_event` is UTC nanoseconds and becomes UTC epoch
seconds. In the provider's JSON encoding the timestamp is nested at
`hd.ts_event`, confirmed against a live response.

### 3.3 Current chart capabilities

- Real historical candlesticks and volume
- Crosshair, zoom, pan, responsive resize
- Dated contract input, timeframe selection, UTC start/end range controls
- Explicit states: initial, loading, empty, validation failure, missing provider
  configuration, timeout, cancelled, rate limited, provider unavailable,
  session expired, connection failure, unexpected response
- Accessible text summary and a full candle data table
- Deterministic browser-session candle replay over an already-loaded response;
  replay never performs another provider request and every chart, summary, and
  table consumer receives only candles visible at the replay cursor
- TradingView Lightweight Charts attribution (see §4)

Replay domain state lives in `src/features/replay/engine.ts`. It is pure: the
immutable candle window, bounded cursor, status, and speed change only through
deterministic operations, with no clock, randomness, I/O, or candle mutation.
The client controller in `src/features/replay/use-replay.ts` owns an injected
scheduler and maintains at most one timer. Replay is intentionally ephemeral;
exiting restores the complete response already held by the chart workspace.

Backward cursor movement is safe only while replay has no dependent trading
state. Once simulated orders exist, moving backward must rebuild orders, fills,
positions, and P&L by replaying an event log from the beginning. Decrementing a
cursor must not be used to "undo" trading events.

### 3.4 Security architecture

- `DATABENTO_API_KEY` is **server-only**. Never `NEXT_PUBLIC_*`, never logged,
  never serialized into a response, never placed in a URL. It travels only in an
  `Authorization: Basic` header from the server.
- The **browser never contacts Databento**. It calls the MetaTradee API, which
  holds the credential.
- The candles API requires authentication and **fails closed** — an
  unauthenticated caller receives a 401 JSON envelope and never reaches the
  provider.
- **Auth runs before validation, and validation before any provider call**, so
  neither an anonymous caller nor a malformed range can trigger a billed request.
- No secret, raw provider payload, provider HTML, upstream URL, or stack trace
  appears in any response. Provider-credential failures surface as 502, never
  401, so a server misconfiguration is never reported as the user's session
  being rejected.
- Requests are bounded by three independent limits (span, output rows, and
  source rows fetched), the tightest of which binds.
- **No fixture fallback exists in production.** The `/chart` route and the chart
  workspace do not import the fixture module; on failure the UI shows the
  failure. Synthetic candles are never substituted for real ones.

### 3.5 Current limitations

Stated plainly so nothing here is mistaken for a capability:

- **No live streaming.** Historical data only.
- **No continuous-contract rollover logic.** Dated contracts only; rollover is
  not inferred or stitched.
- **No simulated orders.** No entries, exits, or fills of any kind.
- **No replay persistence or server execution.** Replay exists only for the
  current browser session over the currently loaded candle response.
- **No drawing-tool suite.** The tool rail is indicative, not interactive.
- **No strategy engine.**
- **No authenticated browser screenshot has been produced** in the current local
  environment. The live path was verified through an authenticated test harness
  invoking the real route handler and real provider client; browser visual
  confirmation remains outstanding.
- **A local production build requires the normal public Supabase environment
  variables** (`NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`). Without them the build fails while
  collecting page data.
- **Dev-only Vitest/Vite audit findings remain**, out of scope for this work.
  They are devDependencies and do not ship.

## 4. Boundaries that hold across all three

- **Do not replace or duplicate the existing analytics SVG charts.** Extend the
  pattern; do not fork it into a parallel charting system.
- **Marketing SVG motifs are decorative and stay isolated.**
  `src/features/marketing/components/{dashboard-preview,sticky-showcase}.tsx`
  are `aria-hidden`, deliberately number-free illustrations. They must never
  share code with product charts in either direction — a decorative motif that
  began rendering real values would imply performance the product never claimed.
- **The chart library sits behind a feature component boundary.** Per
  `docs/PROJECT_STRUCTURE.md` rule 5, domain code never imports a vendor SDK.
  `price-chart.tsx` is the only module importing `lightweight-charts`; swapping
  or removing the library must not touch calculations or types.
- **Attribution is required, not optional.** `lightweight-charts` is Apache-2.0,
  © 2023 TradingView. The licence requires naming TradingView and surfacing a
  link to tradingview.com. The in-chart `layout.attributionLogo` stays at its
  default `true` and must not be disabled; a visible text credit is additionally
  rendered by the workspace.
- **A canvas-based chart requires an accessible textual alternative.** Canvas
  exposes nothing to assistive technology, so the summary plus data-table
  contract already used by `equity-chart.tsx` is mandatory, not optional.
- **No future-data leakage.** When replay is built, a session positioned at time
  _t_ may never read a bar after _t_. This is a correctness property of the data
  layer, not a UI concern.
- **No arbitrary code execution, ever.** No `eval`, no `new Function`, no Pine
  Script or equivalent DSL evaluation, and no uploaded or user-authored strategy
  code executed on the server or client. A strategy is declarative data
  validated against a schema — never a program we run.

## 5. Roadmap

Delivered: provider adapter → normalized candle model → authenticated API →
chart workspace.

Delivered: candle replay over loaded historical bars under the
no-future-data-leakage rule in §4. Simulated orders follow replay and remain a
separate decision.

Provider connection is complete and is no longer a roadmap item.

## 6. Stop conditions

Halt and obtain explicit approval before:

1. **Creating a migration** for backtest definitions, runs, or candle storage —
   generate and review it; never apply it automatically.
2. **Assigning backtesting or charting to a plan** — no entitlement key or plan
   assignment exists for either, and inventing one would fabricate a pricing
   decision.
3. **Adding simulated orders, replay persistence, or a strategy engine** — each
   changes what the product claims to do.
4. **Adding a second market-data provider, live streaming, or continuous-contract
   symbology** — each carries fresh cost, licensing, and correctness decisions.
5. **Introducing caching or storage of provider data** — redistribution terms
   and staleness both require a decision.

Until each is approved, dependent routes stay fail-closed.
