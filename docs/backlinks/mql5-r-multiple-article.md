# MQL5 Article — publication draft

**Status:** READY_FOR_MANUAL_SUBMISSION · **Target:** <https://www.mql5.com/en/articles>
**Prepared:** 2026-08-09 · Not submitted. No account exists in this environment.

Everything below the `---` is the article as it should be submitted. The blocks
above and the checklist at the end are internal and must not be pasted.

## SEO / submission metadata

| Field                    | Value                                                                                                                                                                                                                                                                             |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Final title**          | How to Calculate R-Multiples Correctly From MT5 Trade History                                                                                                                                                                                                                     |
| **Short description**    | An MT5 export gives you profit in currency. Turning that into a correct R-multiple takes more care than it looks — here is the arithmetic, the edge cases, and the algorithm.                                                                                                     |
| **Excerpt**              | R-multiples let you compare a scalp with a swing trade, but only if the denominator is right. This article derives R from MT5 deal history: initial versus final stop, commissions and swap, partial closes, missing stops, and the cases where R simply cannot be reconstructed. |
| **Suggested slug**       | `calculate-r-multiples-mt5-trade-history`                                                                                                                                                                                                                                         |
| **Primary topic**        | Trade performance measurement from MT5 history                                                                                                                                                                                                                                    |
| **Secondary topics**     | R-multiple / expectancy, MT5 deal and position model, statement export and parsing, commission and swap handling, partial closes, trade journaling                                                                                                                                |
| **Internal link target** | `https://www.metatradee.com/integrations/metatrader-5`                                                                                                                                                                                                                            |
| **Suggested anchor**     | MetaTradee's MT5 import documentation                                                                                                                                                                                                                                             |
| **Link count in body**   | 1                                                                                                                                                                                                                                                                                 |

---

# How to Calculate R-Multiples Correctly From MT5 Trade History

## Introduction

Every MT5 account already knows what it made. Open the Toolbox, look at the
History tab, and the Profit column tells you the number in account currency.

That number is almost useless for comparing one trade with another.

A +$400 scalp on a 1-lot EURUSD position with a five-pip stop and a +$400 swing
trade on 0.1 lots with a 200-pip stop are not the same event, and averaging them
tells you nothing about either. The R-multiple exists to solve exactly this: it
expresses each result in units of the risk that was accepted when the position
was opened, so trades of wildly different size and duration land on one scale.

The arithmetic is a single division. Getting the denominator right from an MT5
export is where it goes wrong, and it goes wrong quietly — the result is still a
plausible-looking number, so nothing alerts you. This article covers the
definition, the fields you actually need, the export, four worked examples, the
mistakes that survive review, and the cases where R cannot be reconstructed and
should be reported as missing rather than guessed.

All numbers in the examples are fictional and constructed to illustrate the
arithmetic. They are not the performance of any account, product, or person.

## What R-multiple means

An R-multiple is the result of a trade divided by the risk taken on it:

> **R = net result of the trade ÷ initial risk, both in account currency.**

A trade that made twice what it stood to lose is +2R. One that lost exactly what
was planned is −1R. The unit is deliberately dimensionless: once a result is in
R, position size drops out and a scalp and a swing become comparable.

The word carrying all the weight is **initial**. R is measured against the risk
accepted at the moment the position was opened — not the risk after the stop was
trailed, not the risk after a partial close reduced exposure. Change the
denominator mid-trade and the metric stops meaning anything, because two trades
with the same R no longer describe the same decision.

This also makes R a _planning_ number as much as a _result_ number. If the
initial stop was never defined, there is no denominator, and no amount of
post-processing invents one.

## Why raw P&L alone is insufficient

Consider two fictional trades on the same account in the same week:

| Trade | Instrument | Size      | Stop distance | Result |
| ----- | ---------- | --------- | ------------- | ------ |
| A     | EURUSD     | 1.00 lot  | 10 pips       | +$300  |
| B     | XAUUSD     | 0.20 lots | $12.00        | +$300  |

Identical in the Profit column. Trade A risked $100 and returned +3R. Trade B
risked $240 and returned +1.25R. Ranked by currency they are tied; ranked by
decision quality they are not close.

The problem compounds. Average P&L per trade, win rate, profit factor and
expectancy in currency are all dominated by whichever trades happened to be
largest. A single oversized position can carry a quarter's statistics and hide
the fact that the underlying approach is flat. Expressed in R, size is
normalised out and the statistics describe the _method_ rather than the
sizing.

There is a second, subtler benefit. Expectancy in R has a direct operational
meaning: an expectancy of +0.25R says that, on average, each trade returns a
quarter of what it risked. That figure survives a change in account size,
whereas expectancy in dollars does not.

## Core R-multiple formula

Written out in full:

```
direction   = +1 for a long, −1 for a short
units       = volume in lots × contract size
gross       = (exit price − entry price) × direction × units
net         = gross + commission + swap + fees     (all cost terms signed)
initial risk = |entry price − initial stop| × units

R = net ÷ initial risk
```

Three details in that block are where most implementations diverge.

**`units`, not lots.** Volume in an MT5 export is in lots. A price distance
multiplied by lots is meaningless; it has to be multiplied by lots × contract
size. One standard FX lot is typically 100,000 units of base currency; XAUUSD is
commonly 100 troy ounces per lot; index and futures CFDs vary per broker and per
symbol. Read `SYMBOL_TRADE_CONTRACT_SIZE` rather than assuming.

**Sign convention on costs.** MT5 reports commission and swap as negative
numbers when they are costs. If your source data follows that convention you
**add** them; if you have already flipped them to positive magnitudes you
subtract. Both conventions are defensible. Mixing them within one dataset is not,
and it is a common source of an R that is slightly, consistently wrong.

**Currency of the result.** `|entry − stop| × units` is in the instrument's quote
currency. For a USD account trading EURUSD or XAUUSD that is already USD. For a
USD account trading EURGBP the risk comes out in GBP and must be converted at the
rate in force, or every R on that symbol is wrong by the exchange rate. In MQL5
the robust way to avoid this entirely is to work in ticks:

```
risk = (|entry − stop| ÷ SYMBOL_TRADE_TICK_SIZE) × SYMBOL_TRADE_TICK_VALUE × lots
```

`SYMBOL_TRADE_TICK_VALUE` is already expressed in account currency, so contract
size and cross-rate conversion are both handled for you.

## Required MT5 trade-history fields

To compute R for one position you need, at minimum:

| Field                  | Why                                                 |
| ---------------------- | --------------------------------------------------- |
| Symbol                 | Contract size and tick value lookup                 |
| Type / direction       | Sign of the result                                  |
| Volume                 | Converted to units                                  |
| Entry price            | Numerator and denominator                           |
| **Initial** stop price | The denominator — nothing else substitutes for it   |
| Exit price(s)          | Numerator                                           |
| Commission             | Net result                                          |
| Swap                   | Net result                                          |
| Open / close time      | Ordering, session analysis, and duplicate detection |

Two of those deserve a warning.

The **initial stop** is not a field MT5 stores under that name. What the history
holds is `DEAL_SL`: the stop-loss attached at the moment of each deal. On the
_entry_ deal that is the closest available proxy for the initial stop, and it is
correct whenever the stop was attached with the entry order. If the stop was
added a few seconds later, or the position was opened without one, the entry
deal records `0.0` and the initial risk is genuinely unknown.

The **exit price** is frequently plural. A position closed in three pieces has
three exit deals, three prices, three volumes, and one initial risk. Section 10
covers this, because it is the case where naive implementations produce numbers
that look reasonable and are not.

## How to export MT5 trade history

In the terminal:

1. Open the Toolbox (`Ctrl+T`) and select the **History** tab.
2. Right-click inside the tab, choose the period, and set the view to **Positions**
   if you want one row per position, or **Deals** if you want the raw fills. Deals
   are the safer source for anything involving partial closes.
3. Right-click again and choose **Report**.
4. Save the file. Recent MT5 builds offer HTML, Open XML (`.xlsx`) and Open
   Document (`.ods`); the exact submenu labels shift between builds. There is no
   direct CSV option, so if you need CSV, save the `.xlsx` and re-save it as CSV
   from a spreadsheet application.

Two format details that break parsers downstream:

- MT5 writes timestamps as `YYYY.MM.DD HH:MM:SS`. Dots, not dashes. Most
  date libraries reject it without a format hint.
- Numbers follow the machine's locale. `1 234,56` and `1.234,56` both appear in
  the wild, and a naive `parseFloat` on `1.234,56` silently returns `1.234`.

If you would rather not touch a spreadsheet at all, the script in section 14
reads the history directly through the MQL5 API and writes exactly the columns
you need.

## Worked examples

Everything in this section is fictional and built to make the arithmetic legible.

## Winning trade example

A long gold position, opened with a stop and closed in one piece.

```
Instrument      XAUUSD, contract size 100 oz
Direction       long
Volume          0.40 lots            → units = 0.40 × 100 = 40 oz
Entry           2000.00
Initial stop    1995.00
Exit            2015.50
Commission      −8.00
Swap            −2.40
```

```
initial risk = |2000.00 − 1995.00| × 40   = 5.00 × 40  = $200.00
gross        = (2015.50 − 2000.00) × 40   = 15.50 × 40 = $620.00
net          = 620.00 − 8.00 − 2.40                    = $609.60

R = 609.60 ÷ 200.00 = 3.05R
```

Note the gap between the gross figure (3.10R) and the net one (3.05R). On a
single swing trade that is cosmetic. On a scalping record where costs are a
double-digit percentage of the average result, ignoring them shifts every R in
the same direction and inflates expectancy systematically.

## Losing trade example

A short EURUSD position that gapped through its stop.

```
Instrument      EURUSD, contract size 100,000
Direction       short
Volume          1.00 lot             → units = 100,000
Entry           1.08500
Initial stop    1.08900
Exit            1.08920              (filled past the stop)
Commission      −7.00
Swap            −1.20
```

```
initial risk = |1.08500 − 1.08900| × 100,000 = 0.00400 × 100,000 = $400.00
gross        = (1.08500 − 1.08920) × 100,000 = −0.00420 × 100,000 = −$420.00
net          = −420.00 − 7.00 − 1.20                              = −$428.20

R = −428.20 ÷ 400.00 = −1.07R
```

This is the example worth internalising. The trade was planned as a 1R risk and
cost 1.07R. Slippage and costs mean a "1R loss" is routinely worse than −1R, and
a system modelled on clean −1R losses will overstate its expectancy. Keeping the
losing tail honest is most of the value of measuring R at all.

## Partial exits and multiple fills

Same fictional gold setup, closed in three pieces:

```
Entry           0.60 lots at 2000.00, initial stop 1990.00
                → units = 60 oz, initial risk = 10.00 × 60 = $600.00

Exit 1          0.30 lots (30 oz) at 2012.00  → (2012 − 2000) × 30 = +$360.00
Exit 2          0.20 lots (20 oz) at 2020.00  → (2020 − 2000) × 20 = +$400.00
Exit 3          0.10 lots (10 oz) at 1996.00  → (1996 − 2000) × 10 =  −$40.00
                                                          gross  = +$720.00
Commission      −12.00 total
Swap            −3.00 total
                                                          net    = +$705.00

R = 705.00 ÷ 600.00 = 1.18R
```

**One position, one initial risk, one R.** The money from every fill is summed
first; the division happens once.

Two wrong answers are common enough to name. The first computes an R for each
slice against that slice's own notional risk — 1.20R, 2.00R, −0.40R — and adds
them, reporting **2.80R**. The second averages the same three figures and reports
**0.93R**, weighting a 0.10-lot exit exactly as heavily as a 0.30-lot one.
Neither is 1.18R, and neither error is visible in the output.

The rule that prevents both: R is a property of a **position**, never of a fill.
In MQL5 terms, group deals by `DEAL_POSITION_ID` before dividing by anything.

If the position was also _scaled into_, the entry price is the volume-weighted
average of the entry deals and the initial risk uses the total volume — with the
honest caveat that a position built in stages has no single moment at which risk
was accepted, so its R is an approximation. Flag those trades rather than
pretending otherwise.

## Fees and commissions

MT5 separates the money into columns that must all be included:

- **Profit** — the price result of the deal.
- **Commission** — usually charged per side, so a round turn appears across the
  entry and exit deals.
- **Swap** — accrued per rollover; on a position held over a weekend this can
  exceed the commission.
- **Fee** — present in some builds and broker configurations for exchange or
  clearing charges.

Net result is all four combined, respecting their signs. Two failure modes to
watch:

**Half the commission.** Commission is charged on the entry deal _and_ the exit
deal. Reading only the closing deal captures half the cost. On a strategy with a
0.3R average win, missing half the round turn is not a rounding error.

**Swap on the wrong side.** Swap can be positive. A carry-positive position held
for weeks can accrue meaningful credit, and treating swap as unconditionally a
cost understates those results. Add the signed value; do not take its absolute
value.

## Common R-multiple calculation mistakes

1. **Using the final stop instead of the initial one.** Move a stop to
   break-even and the final stop distance is zero, so R evaluates to a division
   by zero — infinite on winners and undefined on the rest. Some tools silently
   substitute a small number and produce enormous R values that look like a
   discovery. Record the initial stop at entry, or accept that R is
   unreconstructable later.
2. **Ignoring commission and swap,** or mixing sign conventions between them.
3. **Multiplying a price distance by lots** instead of by lots × contract size.
4. **Ignoring the currency of the result** on instruments not quoted in the
   account currency.
5. **Computing R per fill on partially closed positions,** then summing or
   averaging.
6. **Confusing planned R with realised R.** The reward-to-risk ratio of a plan —
   target distance over stop distance — is a forecast made before the trade.
   Realised R is what happened. Both are worth tracking; the gap between them is
   often more informative than either, and reporting one under the other's name
   makes a record that cannot be audited.
7. **Averaging R across accounts in different currencies** without conversion.

## Handling missing stop-loss information

Some positions will have no recorded stop. Discretionary exits, stops held
mentally, stops attached after entry, and positions opened by a script that did
not set `sl` all produce an entry deal with `DEAL_SL == 0.0`.

For those trades, **R does not exist**. The honest options, in order of
preference:

1. **Report it as missing.** Exclude the trade from R-based statistics and count
   how many were excluded. If 40% of a record has no initial stop, the R-based
   expectancy describes a filtered subset, and the reader deserves to know that.
2. **Impute from a documented policy** — for instance, an account that always
   risks a fixed percentage. Mark those trades as estimated, keep them in a
   separate bucket, and never merge the two figures into one headline number.
3. **Reconstruct from the modification history** if you have it. The stop that
   appears a few seconds after entry is usually the intended one. This is
   defensible, and it is still an inference; label it.

What to avoid is substituting the _exit_ price for the stop. That guarantees
every loss is exactly −1R, which produces a beautifully consistent distribution
that describes nothing.

## Converting MT5 history into journal-ready data

The target shape is one row per position, with the fields from section 5 already
resolved: fills aggregated, entry volume-weighted, costs summed, initial stop
taken from the entry deal.

Rather than a script you have to take on trust, here is the algorithm. It is
written as language-neutral pseudocode so it can be implemented in MQL5, Python
or a spreadsheet — and so you can check it against your own data before relying
on it.

```text
ALGORITHM  realised R per closed position

INPUT   the deal history for a period
OUTPUT  one record per closed position

1. GROUP every deal by its position identifier.
   In MT5 terms that is DEAL_POSITION_ID. This step is the whole point:
   R is a property of a position, never of an individual fill.

2. FOR each position:

   a. ENTRY DEALS (those that open or add to the position)
        direction    <- from the first entry deal (buy -> +1, sell -> -1)
        entry_volume <- sum of volume
        entry_price  <- sum(price x volume) / entry_volume    [weighted average]
        initial_stop <- the stop recorded on the FIRST entry deal
                        (MT5: DEAL_SL; 0.0 means none was attached)

   b. EXIT DEALS (those that reduce or close it)
        exit_volume  <- sum of volume
        exit_price   <- sum(price x volume) / exit_volume      [weighted average]

   c. MONEY - over ALL deals, entries and exits alike, because commission
      is charged on both sides:
        net <- sum(profit + commission + swap + fee)           [signs preserved]

   d. RISK - in account currency:
        IF initial_stop is missing OR zero:
             risk <- UNKNOWN
        ELSE:
             risk <- |entry_price - initial_stop| x entry_volume x contract_size

        The tick form avoids contract size and cross-rate conversion entirely,
        because tick value is already quoted in account currency:
             risk <- |entry_price - initial_stop| / tick_size
                       x tick_value x entry_volume

   e. RESULT:
        IF risk is UNKNOWN or risk = 0:
             R <- BLANK        [not 0, not infinity - absent]
        ELSE:
             R <- net / risk

3. EMIT one row: symbol, direction, volume, entry_price, initial_stop,
   exit_price, net, risk, R, opened_at, closed_at.
```

Three decisions in that algorithm are where most implementations diverge:

- **Grouping by position, not by deal.** A position closed in five pieces
  produces one row and one R. Step 2c sums the money across every fill before
  step 2e divides once.
- **The initial stop comes from the _first_ entry deal** — not the last, and not
  whatever the stop had become by the time the position closed.
- **A missing stop yields a blank R, never a zero.** A blank propagates as
  missing data through any aggregation you do later; a zero propagates as a
  fact, and it is not one. The same applies to the risk column.

To implement this in MQL5, the pieces you need are `HistorySelect()`,
`HistoryDealsTotal()` and `HistoryDealGetTicket()`, then the deal properties
`DEAL_POSITION_ID`, `DEAL_ENTRY`, `DEAL_TYPE`, `DEAL_PRICE`, `DEAL_VOLUME`,
`DEAL_SL`, `DEAL_PROFIT`, `DEAL_COMMISSION` and `DEAL_SWAP` — with
`SYMBOL_TRADE_TICK_SIZE` and `SYMBOL_TRADE_TICK_VALUE` read per symbol rather
than from the chart.

However you build it, verify it the same way: take one position you remember,
compute its R by hand from the terminal, and confirm the tool agrees before
trusting it across a thousand rows.

## How MetaTradee handles supported imports

Disclosure: I am involved in building MetaTradee, so treat this section as
context rather than a recommendation.

It is worth describing what a file-based journal can and cannot do with the CSV
above, because the constraints are the same for any tool of this kind.

MetaTradee imports MT5 history **from files** — CSV or JSON. There is no
automatic synchronisation, no investor password, and no broker API connection;
you export a statement and upload it. XLSX is rejected with a message telling you
to export CSV instead, and files are capped at 20 MB. The column mapping is
auto-detected from the header names MT5 emits and every field can be reassigned
by hand before anything is written. The preview step is a genuine dry run:
nothing is stored until it is confirmed, and rows that fail validation are listed
with their row number and the reason rather than dropped.

Duplicates are detected by a content hash over account, symbol, direction, time,
volume and entry price, checked both against existing trades and against other
rows in the same file, so re-importing an overlapping period flags the overlap in
the preview instead of doubling the history. Near-matches — same account, symbol,
direction and time but a different fill — are flagged separately rather than
merged.

Two things it does **not** do, which matter for this article specifically. It
derives gross P&L, net P&L after costs, a planned reward-to-risk ratio and trade
duration at write time — but reward-to-risk is a property of the plan, and a
realised R-multiple is not among the figures it computes. The `R` column from the
algorithm above is therefore data you carry yourself. Its risk fallback is also
`|entry − stop| × quantity` with no contract-size multiplier, so the quantity
column must already be in units rather than lots for that figure to be correct in
currency terms. The accepted formats, limits and field semantics are listed in
[MetaTradee's MT5 import documentation](https://www.metatradee.com/integrations/metatrader-5).

One practical note that applies to any importer, not just this one: cost columns
arrive from MT5 signed negative, and importers differ in what they expect. Decide
your convention once and normalise the signs in one place, before the file leaves
your machine — mixing conventions inside a single dataset is the quiet version of
this mistake.

## Limitations

Stated plainly, because a metric whose limits are unstated gets over-trusted:

- **MT5 does not record an intended stop.** If none was attached, R is
  unavailable for that trade and no post-processing recovers it.
- **Netting accounts report at position level.** Per-ticket R is unavailable
  where several orders net into a single position; hedging accounts preserve the
  per-position detail this article assumes.
- **Realised R is not planned R.** Slippage, partial fills and gapped stops mean
  the two differ, usually in the same direction. Track both.
- **Tick value is read at export time.** For symbols whose tick value depends on
  a cross rate, a historical R computed with today's rate carries a small error.
- **R says nothing about correlation.** Ten simultaneous +1R trades on
  correlated symbols are one bet, not ten, and no per-trade metric shows that.
- **Backtested R and live R are different populations.** A backtest fills at
  prices a live account frequently would not.

## Conclusion

R-multiples are worth the effort because they are the only common unit that lets
a scalp, a swing trade and a position trade be compared honestly, and because
expectancy in R survives changes in account size in a way that expectancy in
currency does not.

The effort is almost entirely in the denominator. Use the stop that existed at
entry, convert lots to units, include both sides of the commission and the signed
swap, group fills by position before dividing, and leave R blank when the initial
stop is unknown rather than filling it with a plausible number. Get those five
right and the resulting distribution is something you can act on. Get any one of
them wrong and every downstream statistic is wrong in the same direction, which
is the hardest kind of error to notice.

---

_Disclosure: the author is involved in building MetaTradee, a trading journal and
performance analytics platform._

---

## Internal notes — do not submit

### Images

**No screenshot from this repository is usable in this article.**

- `public/images/features/broker-import.png` — **do not use, and it is no longer
  on the site.** It was a marketing mock-up rather than a product screenshot:
  `.zip`/`.xlsx` support and a 2 GB limit against a real `.csv`/`.json`/`.txt`
  at 20 MB, plus invented counters ("18,742 trades imported"). It was removed
  from `/integrations/metatrader-4`, `/integrations/metatrader-5`,
  `/trading-journal` and the product sections on 2026-08-09. The file remains in
  `/public` but is referenced by nothing.
- `public/images/platforms/metatrader-5.png` — a logo, not illustrative content.

The article stands without images. If MQL5 formatting benefits from them, the
author must capture **real MetaTrader 5 terminal screenshots** on their own
machine:

1. Toolbox → History tab with the period selector open — place in section 6,
   caption: "The History tab in MetaTrader 5, set to show Deals rather than
   Positions."
2. The Report submenu showing available export formats — place in section 6,
   caption: "MT5 offers HTML, Open XML and Open Document report formats; there is
   no direct CSV export."

No AI-generated terminal images. No MetaTradee screenshots.

### Pre-submission checklist

- [ ] **No executable code remains, by design.** Section 14 carried an
      `RExport.mq5` script that had never been compiled or run. It was replaced
      with language-neutral pseudocode plus the list of MQL5 API calls needed to
      implement it. Nothing in the article now claims to compile. If you later
      choose to add a working script, compile it in MetaEditor and run it against
      a real history first — MQL5 reviewers run submitted code, and an
      article-length example that fails to build is a rejection.
- [ ] Confirm the MT5 Report submenu labels against the current terminal build
      before publishing the export steps. The article states MT5 offers HTML,
      Open XML and OpenDocument and **no** direct CSV, which matches what
      `/integrations/metatrader-5` now says; the two must not diverge.
- [ ] MQL5 author account exists; read MQL5's current article requirements.
- [ ] Exactly one outbound link, unchanged; do not add a second on request.
- [ ] Disclosure line retained.

### Site alignment (2026-08-09)

The article and the public MT4/MT5 pages were made to agree in the same pass.
Corrected on the site, not in the article:

- The mock-up screenshot was removed from both integration pages,
  `/trading-journal` and the product sections; the integration pages now state
  accepted formats and limits in text, read from `IMPORT_LIMITS`.
- Six public surfaces claimed MetaTradee computes an "R multiple". They now say
  gross P&L, net P&L and the **planned reward-to-risk ratio**, and the
  integration pages state explicitly that a realised R-multiple is a different
  figure and is not computed.
- Both integration pages claimed a direct CSV export from the terminal. They now
  describe the conversion step, matching section 6 of this article.

If any of those pages change again, re-check section 15 of this article before
submitting — the two must not diverge.

### Claims verified against the repository (2026-08-09)

| Claim in the article                                         | Source                                                 |
| ------------------------------------------------------------ | ------------------------------------------------------ |
| CSV / JSON import, no automatic sync                         | `src/features/import/adapters.ts` — `liveSync: 'seam'` |
| Accepts `.csv`, `.json`, `.txt`; XLSX rejected; 20 MB cap    | `src/features/import/components/import-wizard.tsx`     |
| Auto-detected mapping, user-overridable                      | `adapters.ts` `autoDetectMapping`                      |
| Preview is a dry run; invalid rows captured with row number  | `src/features/import/pipeline.ts`                      |
| Duplicate hash = account+symbol+direction+time+qty+entry     | `src/features/journal/dedupe.ts`                       |
| Partial-match key = account+symbol+direction+time            | `src/features/journal/dedupe.ts`                       |
| Derives P&L, net P&L, RR ratio, duration — **no R-multiple** | `src/features/journal/derived.ts`                      |
| Risk fallback `                                              | entry − stop                                           | × quantity`, no contract size | `src/features/journal/derived.ts` |
| Commission/fees validated non-negative; swap signed          | `src/features/journal/schemas.ts`                      |
| `YYYY.MM.DD HH:MM:SS` and locale numbers handled             | `src/features/import/parse.ts`                         |
| No backtesting on any plan                                   | `src/features/billing/plans.ts` — `COMING_SOON`        |

### Quality audit

- **Promotional tone** — one section of 5 paragraphs out of 17 sections; it
  spends more words on what the product does not do than on what it does.
- **Unsupported product claims** — none; every claim traces to the table above.
- **Mathematical errors** — all four examples recomputed independently; the two
  wrong partial-exit answers (2.80R, 0.93R) are stated as errors, not results.
- **Ambiguous R definitions** — "initial" is defined in section 2 and enforced in
  sections 4, 12 and 13.
- **Fake statistics** — none. All examples labelled fictional in section 7.
- **Financial-advice language** — none; no return, edge or profit is promised.
- **Duplicated sections** — sections 9 and 10 share a setup deliberately, to
  isolate the partial-close variable.
- **MetaTradee mentions** — 4 in the body, all inside section 15, plus the
  disclosure line. One link.
- **Banned phrases** — "best trading journal", "guaranteed edge", "improve
  profits", "guaranteed performance", "automated MT5 sync": zero occurrences.
