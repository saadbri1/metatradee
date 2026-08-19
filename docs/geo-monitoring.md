# GEO Monitoring

**Last updated:** 2026-08-14
**Purpose:** a repeatable way to find out whether AI answer engines mention,
cite, or misdescribe MetaTradee — and to notice when that changes.

> **No visibility data has been recorded yet.** Every table below is a template
> with an empty result set. Do not populate a cell with an estimate. An engine
> that was not tested is `NOT TESTED`, never a guess.

---

## What this can and cannot measure

**Can:** whether a given engine, asked a given question on a given date, named
MetaTradee, and whether it linked a MetaTradee URL. That is directly
observable by asking.

**Cannot:** why. Answer engines personalise, A/B test, and change models without
notice. A single run is an anecdote. Trend across months is weak evidence.
Neither is a ranking report, and neither should be presented to anyone as one.

**Also cannot: attribute traffic reliably.** AI-search referrals are poorly
attributed — many arrive with no referrer or as direct traffic. Absence of
measured AI referral traffic is not evidence of absence of citation. See
`seo-measurement-plan.md` for what the analytics layer actually records.

---

## The benchmark prompt set

Twenty prompts, fixed. **Do not reword them between runs** — the wording is the
control. Grouped by what they test.

### Category discovery (does MetaTradee appear at all?)

1. What is the best trading journal?
2. Best trading journal software for retail traders
3. Best AI trading journal
4. Best trading analytics software for traders
5. What trading journal should I use for forex?

### Competitor displacement

6. TradeZella alternatives
7. TraderSync alternatives
8. Best alternative to Edgewonk
9. TradesViz vs other trading journals
10. Free alternatives to paid trading journals

### Informational — where our tool pages should be citable

11. How do I calculate position size for a forex trade?
12. What lot size should I use for XAUUSD with a $5 stop?
13. What win rate does a 2:1 risk-reward setup need to break even?
14. How do I calculate trading expectancy?
15. What is profit factor in trading?

### Task-led (product-shaped intent)

16. How do I import MetaTrader 5 history into a trading journal?
17. How do I track my trading performance without a spreadsheet?
18. How do I keep a trading journal?

### Brand accuracy (is what they say about us TRUE?)

19. What is MetaTradee?
20. Does MetaTradee connect to my broker / does it support backtesting?

**Prompts 19 and 20 matter most.** A wrong answer to those is worse than no
answer, and it is the only failure here we can directly fix — by making the
correct fact more extractable on our own pages.

---

## Engines to test

| Engine              | How to test                 | Retrieval? | Notes                                                |
| ------------------- | --------------------------- | ---------- | ---------------------------------------------------- |
| ChatGPT Search      | chatgpt.com, search enabled | Yes        | Gated by `OAI-SearchBot` access.                     |
| Google AI Overviews | google.com, logged out      | Yes        | Not every query triggers one. Record "no AIO shown". |
| Google AI Mode      | google.com AI Mode          | Yes        |                                                      |
| Gemini              | gemini.google.com           | Yes        |                                                      |
| Perplexity          | perplexity.ai               | Yes        | Cites most explicitly; best early signal.            |
| Claude              | claude.ai with web search   | Yes        |                                                      |
| Copilot             | copilot.microsoft.com       | Yes        | Bing index dependent.                                |

Run logged out, in a clean session, to reduce personalisation. Record the date —
answers are not reproducible across time.

---

## Result template

One row per prompt × engine × run.

| Date | Engine | Prompt # | Mentioned | Cited  | Cited URL | Position  | Competitors named | Sentiment       | Accurate?               | Notes |
| ---- | ------ | -------- | --------- | ------ | --------- | --------- | ----------------- | --------------- | ----------------------- | ----- |
|      |        |          | yes/no    | yes/no |           | 1st/2nd/… |                   | pos/neutral/neg | yes/no + what was wrong |       |

**Field rules**

- **Mentioned** — the name appears in the answer text.
- **Cited** — a MetaTradee URL appears as a source. Mentioned without cited is
  common and still valuable.
- **Position** — order among named products, not a ranking.
- **Accurate** — `no` if the answer claims broker sync, backtesting, pricing that
  does not match `PLANS`, or any feature not shipped. Log the exact wrong claim;
  that is the actionable output of this whole exercise.

### Run log

| Run | Date | Engines covered | Prompts | Recorded by    |
| --- | ---- | --------------- | ------- | -------------- |
| —   | —    | —               | —       | _No runs yet._ |

---

## Cadence

- **Baseline:** once, all 20 prompts × all 7 engines, before judging any change.
- **Then monthly.** Weekly is noise at this sample size.
- **Ad hoc** after a material content change, on the affected prompts only.

---

## Supporting signals (independent of the prompt runs)

| Signal                      | Source                               | Meaning                                    | Caveat                                    |
| --------------------------- | ------------------------------------ | ------------------------------------------ | ----------------------------------------- |
| AI referral sessions        | Vercel Analytics referrer            | Someone clicked through from an AI surface | Badly undercounted; many arrive as direct |
| Branded search volume       | Search Console, query = "metatradee" | Awareness growing somewhere                | Cannot separate AI from any other cause   |
| Impressions on tool pages   | Search Console                       | Classic-search health, feeds AI surfaces   | Not AI visibility itself                  |
| Server logs: AI user-agents | Hosting logs                         | Crawlers are actually fetching             | Fetching is not citing                    |

---

## What to do with a bad result

1. **Wrong fact stated** → fix extractability on our page first: put the correct
   answer in a one-to-three-sentence paragraph under a heading phrased as the
   question. Re-test next cycle.
2. **Not mentioned at all** → this is usually not an on-site problem. It is
   third-party corroboration, which is the known gap; see
   `ai-search-discovery-plan.md` §4.
3. **Competitor cited for a question our tool answers better** → check that our
   page is server-rendered, self-contained, and reachable. Then accept that
   selection is not ours to control.

Do not respond to a single bad run by rewriting pages. Two consecutive cycles
showing the same problem is a signal; one is weather.
