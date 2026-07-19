# Chart & Backtesting Design (Phase 12.4)

Three surfaces in this product draw or analyse trading data, and they are
routinely confused. This document fixes the boundary between them **before** a
charting library or market-data provider is chosen, so that decision is made
deliberately rather than inherited from an implementation detail.

This is a decision record, not a product specification. It authorizes nothing.

Audited state at HEAD `f0a9d2c`: no charting dependency exists (0 of 58
packages), no candle/OHLCV model exists, no replay or simulated-order engine
exists, and no backtest table exists. `ACCOUNT_TYPES` already includes
`'backtest'` (`src/lib/db/enums.ts:13`), but that is an account _label_ only —
there is no backtesting module behind it.

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
  sequence, not time-of-market; they are complete without any price data.

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

## 3. Price-chart replay — Tier 2 (future, unapproved)

Candle-by-candle review of historical price with simulated entries and exits.

This requires **two** things the repository does not have: a chart engine and
**licensed** historical market data. Both are cost and licensing decisions.

If it is ever built, the sequence is: provider adapter → normalized candle model
→ chart workspace → replay → simulated orders. Each stage is independently
reviewable; none may be skipped by inlining a vendor SDK into a component.

Constraints that apply from the first line of code:

- **No future-data leakage.** A replay positioned at time _t_ may never read a
  bar after _t_. This is a correctness property of the data layer, not a UI
  concern.
- **Provider keys stay server-only.** Never `NEXT_PUBLIC_*`, never in a client
  bundle. `POLYGON_API_KEY` and `DATABENTO_API_KEY` exist in `.env.example` but
  are wired to **no code** — placeholders imply no provider relationship and no
  approval.

## 4. Boundaries that hold across all three

- **Do not replace or duplicate the existing analytics SVG charts.** Extend the
  pattern; do not fork it into a parallel charting system.
- **Marketing SVG motifs are decorative and stay isolated.**
  `src/features/marketing/components/{dashboard-preview,sticky-showcase}.tsx`
  are `aria-hidden`, deliberately number-free illustrations. They must never
  share code with product charts in either direction — a decorative motif that
  began rendering real values would imply performance the product never claimed.
- **Any future chart library sits behind a feature component boundary.** Per
  `docs/PROJECT_STRUCTURE.md` rule 5, domain code never imports a vendor SDK.
  Swapping or removing the library must not touch calculations or types.
- **A canvas-based chart requires an accessible textual alternative.** Canvas
  exposes nothing to assistive technology, so the summary plus data-table
  contract already used by `equity-chart.tsx` becomes mandatory, not optional.
- **No arbitrary code execution, ever.** No `eval`, no `new Function`, no Pine
  Script or equivalent DSL evaluation, and no uploaded or user-authored strategy
  code executed on the server or client. A strategy is declarative data
  validated against a schema — never a program we run.

## 5. What is not authorized

As of this document: no migration, no package installation, no provider
connection, no pricing decision, and no entitlement change.

## 6. Stop conditions

Halt and obtain explicit approval before:

1. **Adding a charting library** — it would be the project's first, sets
   precedent for rendering model and accessibility, and carries licence and
   attribution obligations.
2. **Connecting a market-data provider** — cost, licensing, redistribution
   terms, and server-only key handling each require a decision.
3. **Creating a migration** for backtest definitions, runs, or candle storage —
   generate and review it; never apply it automatically.
4. **Assigning backtesting to a plan** — no entitlement key or plan assignment
   exists, and inventing one would fabricate a pricing decision.

Until each is approved, dependent routes stay fail-closed.
