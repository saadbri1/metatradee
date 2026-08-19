# GEO Query Map

**Last updated:** 2026-08-14
**Purpose:** one authoritative MetaTradee URL per question an answer engine might
ask. Companion to `seo-keyword-map.md`, which maps _keywords_; this maps
_questions_, because that is the unit an AI answer is built from.

> **This document promises nothing.** Being the best page for a question does not
> make an engine cite it. See `ai-search-discovery-plan.md` §7 for what cannot be
> guaranteed. What this map controls is the part that is ours: that exactly one
> page answers each question, and that the answer is extractable.

## Rules

1. **One question, one primary URL.** Two pages answering the same question split
   the signal and give a retriever an arbitrary choice. `registry.test.ts`
   already enforces this for keyword clusters via the `cluster` field.
2. **The answer must be in the server-rendered HTML**, in prose, near a heading
   that resembles the question. A fact only present in a chart, an image, or a
   client-rendered component cannot be quoted.
3. **Coverage is graded honestly.** `STRONG` = a direct, self-contained answer
   exists today. `PARTIAL` = the fact is on the page but buried or split across
   paragraphs. `NONE` = no page answers it; the row is a backlog item, not a
   claim.
4. **A `NONE` row is never fixed by adding a thin page.** It is fixed by adding
   the answer to the page that already owns the topic, or not at all.

---

## Product and entity questions

| Query                                     | Intent        | Primary URL             | Supporting URLs         | Coverage | Required improvement                                                  |
| ----------------------------------------- | ------------- | ----------------------- | ----------------------- | -------- | --------------------------------------------------------------------- |
| What is MetaTradee?                       | Informational | `/about`                | `/`, `/products`        | STRONG   | None — added 2026-08-14, answer-first.                                |
| Is MetaTradee free?                       | Commercial    | `/free-trading-journal` | `/pricing`              | STRONG   | None.                                                                 |
| How much does MetaTradee cost?            | Transactional | `/pricing`              | `/free-trading-journal` | STRONG   | None — prices derive from `PLANS`.                                    |
| Does MetaTradee connect to my broker?     | Informational | `/brokers`              | `/about`, `/`           | STRONG   | None — stated as unsupported in three places.                         |
| Does MetaTradee do backtesting?           | Informational | `/` (FAQ)               | `/products#chart`       | STRONG   | None — answered "no", with replay distinguished.                      |
| Is my trading data private in MetaTradee? | Trust         | `/about#privacy`        | `/resources#security`   | PARTIAL  | Needs a dedicated `/security` page; see P1.                           |
| Who operates MetaTradee?                  | Trust         | `/about`                | `/contact`              | NONE     | **Blocked** — no legal entity recorded in repo. Operator must supply. |

## Trading journal questions

| Query                                  | Intent        | Primary URL                | Supporting URLs                 | Coverage | Required improvement                                                            |
| -------------------------------------- | ------------- | -------------------------- | ------------------------------- | -------- | ------------------------------------------------------------------------------- |
| What is a trading journal?             | Informational | `/trading-journal`         | `/resources#journal-guide`      | PARTIAL  | Add an answer-first definition paragraph under an H2 phrased as the question.   |
| What should a trading journal contain? | Informational | `/resources#journal-guide` | `/trading-journal`              | PARTIAL  | Steps exist; promote to an ordered list with a lead answer.                     |
| How do I keep a trading journal?       | Informational | `/resources#journal-guide` | —                               | PARTIAL  | Same as above.                                                                  |
| Trading journal vs spreadsheet         | Comparison    | `/trading-journal`         | `/about#problem`                | STRONG   | None — the exact-numeric argument is stated on both.                            |
| Best trading journal software          | Commercial    | `/`                        | `/products`, `/pricing`         | PARTIAL  | Legitimately hard: this is a list query. Do not fake a "best" claim.            |
| Best AI trading journal                | Commercial    | `/ai-trading-journal`      | `/`                             | STRONG   | None.                                                                           |
| Best trading journal for forex         | Commercial    | `/trading-journal`         | `/integrations/metatrader-5`    | NONE     | Needs `/forex-trading-journal` — only if genuinely distinct. See §Market pages. |
| How do I review my trades?             | Informational | `/resources#journal-guide` | `/solutions#performance-review` | PARTIAL  | Add a weekly-review ordered list.                                               |

## Analytics and metric questions

| Query                                             | Intent        | Primary URL                     | Supporting URLs              | Coverage | Required improvement                                                            |
| ------------------------------------------------- | ------------- | ------------------------------- | ---------------------------- | -------- | ------------------------------------------------------------------------------- |
| How do I calculate trading expectancy?            | Informational | `/resources#analytics-guide`    | —                            | PARTIAL  | Formula is present in prose; needs its own H2 + worked example. Candidate tool. |
| What is profit factor?                            | Informational | `/resources#analytics-guide`    | —                            | PARTIAL  | Same.                                                                           |
| What is a good win rate?                          | Informational | —                               | `/resources#analytics-guide` | NONE     | **Do not answer.** Any number would be an invented benchmark.                   |
| How do I calculate maximum drawdown?              | Informational | `/resources#analytics-guide`    | —                            | PARTIAL  | Definition present; add the calculation.                                        |
| What is R-multiple / reward-to-risk?              | Informational | `/tools/risk-reward-calculator` | `/integrations/metatrader-5` | STRONG   | None — planned vs realised distinction is explicit.                             |
| How do I analyze my trading performance?          | Informational | `/solutions#performance-review` | `/resources#analytics-guide` | PARTIAL  | Needs an ordered method, not a feature list.                                    |
| How many trades before performance is meaningful? | Informational | —                               | —                            | NONE     | **Blocked** — needs a sourced statistical claim, not a guess.                   |

## Risk and sizing questions

| Query                                         | Intent        | Primary URL                         | Supporting URLs                   | Coverage | Required improvement                                                                    |
| --------------------------------------------- | ------------- | ----------------------------------- | --------------------------------- | -------- | --------------------------------------------------------------------------------------- |
| How do I calculate position size?             | Informational | `/tools/position-size-calculator`   | `/tools`                          | STRONG   | None — formula, worked example and 6 FAQs.                                              |
| What lot size should I use for gold / XAUUSD? | Informational | `/tools/xauusd-lot-size-calculator` | `/tools/position-size-calculator` | STRONG   | None.                                                                                   |
| How many dollars is a pip on gold?            | Informational | `/tools/xauusd-lot-size-calculator` | —                                 | STRONG   | None — answered in FAQ.                                                                 |
| What win rate does a 2:1 setup need?          | Informational | `/tools/risk-reward-calculator`     | —                                 | STRONG   | None — breakeven formula and table.                                                     |
| How much should I risk per trade?             | Informational | `/tools/position-size-calculator`   | —                                 | NONE     | **Do not answer prescriptively.** That is financial advice. Explain the mechanics only. |

## Import and platform questions

| Query                                              | Intent        | Primary URL                  | Supporting URLs      | Coverage | Required improvement            |
| -------------------------------------------------- | ------------- | ---------------------------- | -------------------- | -------- | ------------------------------- |
| How do I import MT5 history into a journal?        | Informational | `/integrations/metatrader-5` | `/brokers`           | STRONG   | None.                           |
| How do I import MT4 history into a journal?        | Informational | `/integrations/metatrader-4` | `/brokers`           | STRONG   | None.                           |
| What platforms does MetaTradee support?            | Informational | `/brokers`                   | `/about#data-import` | STRONG   | None — derives from `ADAPTERS`. |
| Can I import from cTrader / DXtrade / TradeLocker? | Informational | `/brokers`                   | —                    | STRONG   | None.                           |

## Competitor questions — all currently unanswerable

| Query                  | Intent     | Primary URL        | Coverage | Required improvement                                                                                                               |
| ---------------------- | ---------- | ------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| TradeZella alternative | Commercial | —                  | NONE     | **Blocked pending verification.** See `geo-comparison-requirements` below.                                                         |
| TraderSync alternative | Commercial | —                  | NONE     | Blocked, same reason.                                                                                                              |
| TradesViz alternative  | Commercial | —                  | NONE     | Blocked, same reason.                                                                                                              |
| Edgewonk alternative   | Commercial | —                  | NONE     | Blocked, same reason.                                                                                                              |
| MetaTradee vs Excel    | Comparison | `/trading-journal` | PARTIAL  | The only comparison we can make honestly today — both sides are first-party facts. Promote to `/compare/trading-journal-vs-excel`. |

### Why the competitor rows stay empty

A comparison page requires current, verifiable facts about a product we do not
control. Competitor pricing and feature sets change without notice, and a stale
comparison is both a trust problem and, for pricing claims, a legal one. No
competitor data exists anywhere in this repository, and none may be inferred
from memory. Each of those pages ships only when someone records the competitor
facts, dated and sourced, and commits to re-checking them.

The template exists as a plan, not as code: a comparison page is one registry
entry plus one route file, exactly like every other page here.

---

## Market pages — decision rule

`/forex-trading-journal`, `/futures-trading-journal`, `/stock-trading-journal`,
`/crypto-trading-journal`, `/day-trading-journal` and
`/prop-firm-trading-journal` are all plausible URLs. Ship one only when all four
hold:

1. MetaTradee genuinely supports the use case, checkable against `ADAPTERS`.
2. The page can say something the generic `/trading-journal` page cannot.
3. The search intent is distinct rather than a synonym.
4. It will not duplicate `/solutions`, which already segments by trader type.

`/crypto-trading-journal` currently fails (1) — no crypto adapter exists.
`/forex-trading-journal` passes (1) and (3) and is the strongest candidate.
