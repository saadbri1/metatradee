# MQL5 Article Brief — "How to Calculate R-Multiples Correctly From MT5 Trade History"

**Status:** READY_FOR_MANUAL_SUBMISSION · **Target:** <https://www.mql5.com/en/articles>

## Why this article and not an advert

MQL5's audience writes MQL and reads statements for a living. They will spot a
disguised product pitch in a paragraph, and the moderation will too. The article
has to stand alone as something a reader could act on **without ever visiting
MetaTradee** — that is also, incidentally, the only version that gets published.

MetaTradee appears once, in the author bio, as context for why the author cares
about the problem. Not in the body. Not in a comparison table. Not in a CTA.

## The problem the article solves

Most traders who compute R from an MT5 export get it wrong in one of a few
specific, correctable ways. That is a genuine, teachable gap.

## Outline

**1. What an R-multiple is, precisely**

R is the outcome of a trade expressed in units of the risk that was taken _at
entry_:

```
R = (exit price − entry price) × direction × quantity ÷ initial risk in currency
initial risk = |entry price − initial stop| × quantity × contract size
```

The word doing the work is **initial**. R is measured against the risk accepted
when the position was opened, not against whatever the stop became later.

**2. Getting the raw material out of MT5**

- Toolbox (Ctrl+T) → History → right-click → choose the period
- Right-click → Report → save as **CSV**, not the default HTML
- Which columns you get: Time, Symbol, Type, Volume, Price, S/L, T/P,
  Commission, Swap, Profit
- Note that MT5 statements use `YYYY.MM.DD HH:MM:SS` and may use
  locale-formatted numbers — both need handling before arithmetic

**3. Worked example, in full**

A gold trade with a $5 stop, 0.40 lots, contract size 100:

```
initial risk = 5.00 × 0.40 × 100 = $200
result       = +$620
R            = 620 ÷ 200 = 3.1R
```

Then the same trade with the stop moved to break-even after the fact, showing
the two different answers and why only one of them is R.

**4. The five mistakes**

1. **Using the final stop instead of the initial one.** Moving a stop to
   break-even does not make every winner infinite-R; it makes R undefined if you
   use the final value. Record the initial stop at entry or you cannot compute R
   later at all.
2. **Ignoring commission and swap.** MT5 reports them as separate columns.
   Net result means Profit + Commission + Swap; omitting them inflates R on
   every short-hold trade and materially on scalps.
3. **Mixing contract sizes.** 0.40 lots of gold and 0.40 lots of EURUSD are not
   comparable quantities. Risk must be converted to currency before dividing.
4. **Averaging R across instruments without checking currency.** On a
   non-USD account, a USD-quoted instrument's R is in the quote currency until
   converted.
5. **Computing R on partially closed positions from the closing rows alone.**
   A position closed in three pieces has one initial risk and three results;
   summing three separately-computed Rs double-counts the denominator.

**5. Doing it in MQL5**

A short function that walks `HistoryDealsTotal()`, pairs entry and exit deals by
`DEAL_POSITION_ID`, and returns R per position — including the partial-close
case, which is where naive implementations break.

**6. Limitations to state honestly**

- MT5 does not record the _intended_ stop if none was attached to the order; R
  is uncomputable for those trades and should be reported as missing rather than
  guessed.
- Netting accounts report position-level rows, so per-ticket R is unavailable.
- Slippage means realised R is not planned R; both are worth tracking, and they
  are different numbers.

**7. Why it matters**

Expectancy in R is the only figure that lets you compare a scalp to a swing
trade. Getting the denominator wrong makes every downstream statistic wrong in
the same direction, and it is invisible until you compare two systems.

## Author bio (the only mention)

> [Name] builds MetaTradee (metatradee.com), a trading journal that recomputes
> P&L, R and risk-reward server-side from imported statements. This article came
> out of handling the partial-close case correctly.

## Submission checklist

- [ ] MQL5 author account
- [ ] Article written in full from this brief — the brief is not the article
- [ ] Code sample compiles and is tested against a real MT5 history
- [ ] Screenshots are of MetaTrader, not of MetaTradee
- [ ] Exactly one mention, in the bio
- [ ] Read MQL5's current article requirements before submitting
