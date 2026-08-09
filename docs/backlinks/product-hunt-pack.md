# Product Hunt Launch Pack

**Status:** READY_FOR_MANUAL_SUBMISSION · **Not submitted.**
Product Hunt requires an authenticated maker account, and a launch is a
single-use opportunity whose timing is a business decision, not an automated one.

## Listing

**Name:** MetaTradee

**Tagline** (60 char max)

> The trading journal where every number reconciles

Alternatives:

> A trading journal that recomputes your P&L, R and R:R
> Trading journal with server-computed P&L, R and risk-reward

**Short description** (260 char max)

> MetaTradee imports your MT4/MT5, cTrader or generic CSV statements and
> recomputes P&L, R multiple and risk-reward server-side — so your journal,
> analytics and reports can't disagree. Free plan, no card. AI reviews cite the
> trades behind them.

**Long description**

> Most trading journals store whatever the broker reported and recompute
> statistics in three different places. They drift. Your year-end total stops
> matching the sum of your trades, and you find out at the worst moment.
>
> MetaTradee computes P&L, R multiple and risk-reward **once, on the server**,
> from one definition — and every screen reads that result. Money is stored in
> exact-numeric types rather than floating point, so repeated arithmetic doesn't
> accumulate fractional-cent drift.
>
> **How trades get in.** Export a statement from your platform and upload it as
> CSV or JSON. Ready-made column mappings for MetaTrader 4 and 5, cTrader,
> DXtrade, Match-Trader and TradeLocker, plus a generic mapping for anything
> else. The preview is a dry run: it validates every row, flags duplicates by
> content hash, and writes nothing until you confirm.
>
> It's file import, not broker sync. We never ask for broker credentials or an
> API key, because we never connect to your account.
>
> **The AI coach** reviews the trades you actually took and links to the
> specific trades behind each observation, so you can check its reasoning. It
> issues no buy or sell calls, makes no price predictions and gives no financial
> advice — output is filtered for exactly that before you see it.
>
> **Also shipped:** performance calendar broken down by day, session and hour
> (timezone- and DST-correct); versioned playbooks that become immutable once
> used, so adherence is measured against the rules that actually applied;
> psychology tracking with a transparent discipline score; bar-by-bar replay of
> real recorded sessions; composable reports.
>
> **Not shipped, and not sold:** backtesting — manual or automated — and
> prop-firm rule monitoring. Replay is not a strategy tester.
>
> **Free plan:** 50 trades, one account, no credit card, no expiry. Import and
> AI reviews are on the paid plans, which are bought 30 or 365 days at a time
> and never auto-renew.

**Topics:** Fintech · Investing · SaaS · Analytics · Productivity

**Links:** metatradee.com · metatradee.com/pricing · metatradee.com/tools

## Maker's first comment

> Hi Product Hunt 👋
>
> I built MetaTradee after getting three different P&L figures for the same
> month out of the same journal — one on the trade, one on the dashboard, one in
> an export. All three were computed in different places, and all three were
> defensible. That's the bug this product exists to make impossible.
>
> Everything derives from one server-side engine. Imported and manually logged
> trades go through identical code, so they reconcile by construction rather
> than by luck.
>
> Two things I'd rather say up front than have you discover:
>
> **There's no automatic broker sync.** You export a statement and upload it. I
> chose that deliberately — it means there are no broker credentials to store,
> leak, or ask you to trust me with.
>
> **There's no backtesting.** Replay steps through real recorded sessions bar by
> bar, which is a different thing, and I'd rather say so than let the words blur.
>
> There's a free plan — 50 trades, one account, no card — and three calculators
> at metatradee.com/tools that need no account at all, with the formulas printed
> on the page.
>
> Happy to answer anything, including what it doesn't do.

## FAQ

**Does it connect to my broker automatically?**
No. File import only — export a CSV or JSON statement and upload it. No
credentials, no API keys.

**Which platforms?**
Ready-made mappings for MetaTrader 4 and 5, cTrader, DXtrade, Match-Trader and
TradeLocker, plus a generic mapping for any other CSV/JSON statement.

**Is it really free?**
The free plan is free with no card and no expiry: 50 trades, one account. Import
and AI reviews are paid.

**Does the AI give trading advice?**
No — and it can't. It reviews your past trades and cites them. Output is scanned
for trade calls, price predictions and guarantees before display.

**Can I backtest?**
No. That's not built. Replay of recorded sessions is.

**Will re-importing duplicate my trades?**
No. Content-hash de-duplication against both existing trades and rows within the
same file, shown in the preview before anything is written.

## Launch checklist

- [ ] Maker account with a filled-out profile
- [ ] Gallery: real screenshots only — `broker-import.png`,
      `performance-calendar.png`, `discipline-score.png`, `playbooks.png`,
      `workspaces.png`. **Do not use `landing/backtest-screen.png`** — it would
      imply a feature that is `COMING_SOON`.
- [ ] Thumbnail and social preview
- [ ] Launch 00:01 PT, Tue–Thu
- [ ] Maker available to answer comments for the full day
- [ ] Every claim re-checked against the live site the day before
- [ ] **Never ask for upvotes** — it is against PH rules and it is detectable
