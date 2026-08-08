# Keyword → URL Map

**One cluster, one canonical URL.** Enforced by a test: `registry.test.ts`
asserts no two indexable pages declare the same `cluster` in `src/config/seo.ts`.

Status legend — **LIVE**: built and indexable · **PLANNED**: URL reserved, not
built, deliberately absent from the sitemap · **BLOCKED**: cannot ship honestly
without data we do not have.

---

## Live today

| Primary keyword cluster                   | Canonical URL                       | Intent                     | Status |
| ----------------------------------------- | ----------------------------------- | -------------------------- | ------ |
| trading journal software                  | `/`                                 | Commercial                 | LIVE   |
| trading journal app / product tour        | `/products`                         | Commercial                 | LIVE   |
| trading performance analytics             | `/solutions`                        | Commercial                 | LIVE   |
| metatrader trading journal, broker import | `/brokers`                          | Commercial                 | LIVE   |
| trading journal pricing                   | `/pricing`                          | Transactional              | LIVE   |
| trading journal guide                     | `/resources`                        | Informational              | LIVE   |
| trading calculators                       | `/tools`                            | Informational hub          | LIVE   |
| position size calculator                  | `/tools/position-size-calculator`   | Informational, high intent | LIVE   |
| xauusd lot size calculator                | `/tools/xauusd-lot-size-calculator` | Informational, high intent | LIVE   |
| risk reward calculator                    | `/tools/risk-reward-calculator`     | Informational              | LIVE   |

## Planned — commercial hubs

| Cluster                               | Canonical URL         | Blocking dependency                     |
| ------------------------------------- | --------------------- | --------------------------------------- |
| trading journal, best trading journal | `/trading-journal`    | Content + screenshots                   |
| ai trading journal                    | `/ai-trading-journal` | Must describe the shipped AI coach only |
| trade analytics software              | `/trading-analytics`  | Content                                 |
| trading backtesting software          | `/backtesting`        | **See note below**                      |

> **Backtesting is a naming trap.** `plans.ts` lists manual and automated
> backtesting under `COMING_SOON`. What ships is **trade replay** — bar-by-bar
> playback of recorded history. A `/backtesting` page must describe replay
> honestly and say backtesting is not built, or it is a false claim about the
> product. Prefer `/replay` as the canonical and treat backtesting as a
> comparison topic.

## Planned — markets

`/markets/forex-trading-journal` · `/markets/futures-trading-journal` ·
`/markets/stock-trading-journal` · `/markets/options-trading-journal` ·
`/markets/crypto-trading-journal` · `/markets/xauusd-trading-journal`

Each needs a market-specific reason to exist beyond the keyword — the metrics
that differ, the import quirks, the instrument specs. Otherwise it is one
template with a word swapped, which is what the brief forbids.

## Planned — prop firms

`/prop-firms/prop-firm-trading-journal` · `/prop-firms/funded-account-tracker` ·
`/prop-firms/daily-loss-management` · `/prop-firms/drawdown-management` ·
`/prop-firms/consistency-rule-tracker`

> **Firm-named pages (FTMO, FundedNext, Topstep, FundingPips) are BLOCKED.**
> Their rules change without notice. A page stating a stale daily-loss rule is
> worse than no page — it will cost a reader a funded account. These ship only
> with a verified source, a visible "last reviewed" date, and an owner.

## Planned — integrations

`/integrations/mt4` · `/integrations/mt5` · `/integrations/ctrader` ·
`/integrations/tradelocker` · `/integrations/dxtrade` · `/integrations/match-trader`

**Only these six**, because `src/features/import/adapters.ts` declares exactly
these adapters. TradingView, NinjaTrader, Tradovate and Interactive Brokers have
**no adapter** — pages for them would advertise integrations that do not exist.

## Planned — remaining tools

Priority order in `docs/seo-content-roadmap.md`. Each needs the same standard as
the three that shipped: exact formula, unit tests, stated assumptions, no gate.

`prop-firm-daily-loss-calculator` · `trailing-drawdown-calculator` ·
`drawdown-recovery-calculator` · `consistency-rule-calculator` ·
`trading-expectancy-calculator` · `profit-factor-calculator` ·
`risk-of-ruin-calculator` · `challenge-probability-calculator`

> **Challenge-probability is BLOCKED as specified.** A "probability of passing"
> figure requires assumptions about a trader's edge that we cannot observe. It
> would be a fabricated statistic. Ship only as an explicit Monte-Carlo tool
> where the user supplies win rate and R, and the output is labelled a model.

## Planned — comparison

`/compare/trading-journal-vs-spreadsheet` is the only one shippable now: it
compares against a category, not a company, so nothing needs verifying.

`tradezella-alternative`, `platform-vs-tradersync`, `platform-vs-tradervue`,
`platform-vs-edgewonk` are **BLOCKED** pending verified, dated pricing and
feature data with a named reviewer. Competitor facts invented or recalled from
training data are exactly the failure mode the brief prohibits.

## Explicitly not targeted

- Any "guaranteed profit", "become profitable", "best signals" phrasing
- Firm-specific rule pages without a verified source
- Keywords implying features in `COMING_SOON`
