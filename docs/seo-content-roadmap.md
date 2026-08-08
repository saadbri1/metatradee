# SEO Content Roadmap

**Nothing ships thin.** Every item below is a page that must be genuinely
complete before it is registered in `src/config/seo.ts`. A page that is not ready
stays unregistered, which keeps it out of the sitemap and out of the index.

---

## Done

| Page                                | Notes                                                      |
| ----------------------------------- | ---------------------------------------------------------- |
| `/tools`                            | Hub. Lists only what exists.                               |
| `/tools/position-size-calculator`   | Formula, worked example, assumptions, 34 shared unit tests |
| `/tools/xauusd-lot-size-calculator` | Gold contract size, dual-unit stop entry                   |
| `/tools/risk-reward-calculator`     | Ratio + breakeven win rate                                 |

---

## Priority 1 — highest ROI next

| #   | Page                                     | Dependency                                                                              | Effort |
| --- | ---------------------------------------- | --------------------------------------------------------------------------------------- | ------ |
| 1   | **Analytics instrumentation**            | None — pure engineering                                                                 | S      |
| 2   | `/trading-journal` commercial hub        | Copy + 3 real screenshots                                                               | M      |
| 3   | `/tools/prop-firm-daily-loss-calculator` | Formula agreed; **must not name firms or state their rules**                            | S      |
| 4   | `/tools/trailing-drawdown-calculator`    | Needs a decision: high-water-mark vs. end-of-day trailing — they give different answers | M      |
| 5   | `/tools/drawdown-recovery-calculator`    | Pure maths: `gain = 1/(1−dd) − 1`                                                       | S      |
| 6   | `/markets/xauusd-trading-journal`        | Must say something true and specific about gold beyond the keyword                      | M      |

## Priority 2

| #   | Page                                         | Dependency                                                                                     |
| --- | -------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 7   | `/tools/trading-expectancy-calculator`       | `(W × avgWin) − (L × avgLoss)`                                                                 |
| 8   | `/tools/profit-factor-calculator`            | Must match the engine in `src/features/analytics` exactly, or the site contradicts the product |
| 9   | `/tools/consistency-rule-calculator`         | Rule varies per firm — must be user-parameterised, never hardcoded                             |
| 10  | `/integrations/mt5` then `/integrations/mt4` | Real setup steps + export screenshots                                                          |
| 11  | `/markets/forex-trading-journal`             | Content                                                                                        |
| 12  | `/prop-firms/prop-firm-trading-journal`      | Content, no firm-specific rules                                                                |

## Priority 3

| #   | Page                                      | Dependency                                                                  |
| --- | ----------------------------------------- | --------------------------------------------------------------------------- |
| 13  | `/learn/*` educational cluster            | Requires a blog/MDX surface — **none exists**, this is a build, not a write |
| 14  | `/templates/trading-journal-template`     | A real downloadable file must exist first                                   |
| 15  | `/compare/trading-journal-vs-spreadsheet` | Compares a category, not a company — shippable without competitor data      |
| 16  | Trading-metrics glossary                  | Definitions must match `src/features/analytics`                             |

## Blocked, with the blocker named

| Page                                                                    | Blocker                                                                                                                                         |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `/compare/tradezella-alternative` and all named-competitor comparisons  | Requires verified, dated pricing and feature data plus a named reviewer. Competitor facts recalled rather than checked are fabrication.         |
| Any firm-named prop page (FTMO, FundedNext, Topstep, FundingPips)       | Rules change without notice. Needs a verified source, a visible review date, and an owner who re-checks it.                                     |
| `/tools/challenge-probability-calculator`                               | A pass-probability number needs an assumed edge we cannot observe. Shippable only as an explicit user-parameterised model, labelled as a model. |
| `/backtesting` as a product claim                                       | Backtesting is `COMING_SOON` in `plans.ts`. Replay ships. A page claiming otherwise is false.                                                   |
| `/integrations/{tradingview,ninjatrader,tradovate,interactive-brokers}` | No import adapter exists.                                                                                                                       |

---

## Editorial standard

Every content page carries: one unique H1 · unique title and description ·
canonical · breadcrumbs · structured data matching visible content · a named
author or reviewer where facts can age · a visible last-reviewed date where
facts can change · a risk disclaimer · real screenshots of the real product ·
no invented statistics, ratings, counts or competitor claims.

## What is required before Priority 3 is even startable

There is **no blog, MDX pipeline, or content model** in the repository. The
`/learn` cluster is an engineering project before it is a writing project.
Decide: MDX in-repo (versioned, PR-reviewed, no runtime cost) versus a headless
CMS (non-technical editing, added infrastructure). Recommendation: **MDX**, given
the team shape and that every page needs code review for factual accuracy anyway.
