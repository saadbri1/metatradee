# MQL5 submission package

**Status:** READY_FOR_MANUAL_SUBMISSION · **Target:** <https://www.mql5.com/en/articles>
**Prepared:** 2026-08-09 · **Not submitted.** No MQL5 account exists in this
environment, no submission has been made, and no backlink exists.

The article itself is [mql5-r-multiple-article.md](mql5-r-multiple-article.md).
This file is everything around it: what to send first, what to send with it, and
what the owner has to capture by hand.

**Send the outline first.** MQL5 asks for a plan before a finished article, and
that order protects the work — a moderator who wants a different emphasis says so
before three thousand words are committed to it, rather than after.

---

## 1. Moderator outline

Paste from here to the end of section 1. It is deliberately short; the proposal
stage is not the place for the full argument.

---

**Title:** How to Calculate R-Multiples Correctly From MT5 Trade History

**The problem**

Traders export their MT5 history, divide profit by risk, and get a number that
looks like an R-multiple but is not one. The failures are specific and
repeatable: using the stop as it stood at the close rather than at entry, so a
trade moved to break-even reports an infinite R; omitting commission and swap,
which MT5 reports in separate columns; multiplying a price distance by lots
instead of by lots × contract size; and computing R per fill on a position closed
in pieces, then summing three numbers that share one denominator. Each produces a
plausible figure, so nothing signals the error, and every statistic built on top
of it is wrong in the same direction.

**Why it is useful to MQL5 readers**

This audience already has the raw material — deal history, `DEAL_POSITION_ID`,
`DEAL_SL`, tick values — and already writes code against it. What is thin in the
existing material is a precise treatment of the awkward cases: what R means when
a position was scaled into, what to do when no stop was ever attached, and why
grouping by position rather than by deal is not a stylistic choice. The article
is about interpreting the terminal's own data model correctly, which is a
programming problem before it is a trading one.

**Section outline**

1. Introduction — what the Profit column cannot tell you
2. What an R-multiple means, and why "initial" carries the definition
3. Why raw P&L is not comparable across instruments or sizes
4. The core formula: direction, units, contract size, signed costs
5. Which MT5 trade-history fields are required, and which do not exist
6. Exporting the history — report formats, timestamps, locale numbers
7. Worked examples: a winner and a loser, gross versus net R
8. Partial exits and multiple fills — one position, one denominator
9. Fees, commission and swap, including sign conventions
10. Seven mistakes that survive review, and what to do about missing stops
11. Turning deal history into journal-ready records (pseudocode + MQL5 API calls)
12. Limitations and conclusion

(Twelve headings here; the draft splits several of them further, currently
running to seventeen. Happy to merge or split to whatever the editor prefers.)

**Practical examples included**

Three fully worked numeric examples, each computed line by line and each labelled
fictional: a gold long showing the gap between gross R (3.10R) and net R (3.05R);
a EURUSD short filled through its stop, returning −1.07R rather than the planned
−1R; and a three-fill partial exit worked correctly at 1.18R, shown alongside the
two wrong answers it commonly produces — 2.80R from summing per-slice R, 0.93R
from averaging them. A fourth case, a stop moved to break-even, is treated in
prose rather than arithmetic, because the point is that the division has no
denominator at all. Plus a language-neutral algorithm for computing R per
position from deal history, and the list of MQL5 API calls needed to implement
it.

**What readers will learn**

To compute a realised R-multiple correctly from MT5 deal history; to distinguish
it from the planned reward-to-risk ratio, which is a forecast and not a result;
to group deals by position before dividing; to handle scaled entries, partial
exits, commission charged on both sides, and signed swap; to recognise when the
initial risk cannot be reconstructed and to report those trades as missing rather
than imputing a number; and to convert an export into one record per position
with the fields a journal or an analysis script needs.

**Why this is technical rather than promotional**

The article is written to be acted on by a reader who never visits any product
site. It contains no comparison table, no feature list and no call to action. The
one product reference sits in a single section that spends more words on what the
software does not do — it does not compute a realised R-multiple, and its risk
fallback ignores contract size — than on what it does, and that section can be
removed without affecting anything else in the piece. Author affiliation is
disclosed in one line at the end. Every claim about MT5 behaviour is stated at the
level of the API and the export format, and where terminal builds differ the
article says so rather than asserting a single menu path.

---

## 2. Synopsis for the editor

162 words.

---

An MT5 export tells you what each trade made in currency. It does not tell you
whether the trade was worth taking. This article derives the realised R-multiple —
net result divided by the risk accepted at entry — directly from MT5 trade
history, and concentrates on the cases where the derivation is not obvious.

It covers reading the deal model rather than the summary rows; the difference
between a realised R and the planned reward-to-risk ratio, which is a forecast
made before the outcome and not interchangeable with it; positions closed in
several fills, where one initial risk serves every exit; commission charged on
both sides of a trade and swap that can legitimately be positive; and trades
opened without a stop, where R does not exist and should be reported as absent
rather than estimated.

It closes with an algorithm for turning deal history into one record per
position, with the fields a journal or an analysis script actually needs.

---

## 3. Author disclosure

One line, placed at the end of the article.

---

> _Disclosure: the author is involved in building MetaTradee, a trading journal
> and performance analytics platform._

---

Keep it exactly this length. It states the affiliation and nothing else — no
description of features, no link. If a moderator asks for the disclosure to move
to a byline or an author profile instead, move it; do not drop it.

## 4. MetaTradee citation

|            |                                                        |
| ---------- | ------------------------------------------------------ |
| **Target** | `https://www.metatradee.com/integrations/metatrader-5` |
| **Anchor** | MetaTradee's MT5 import documentation                  |
| **Count**  | Exactly one, in section 15                             |
| **Status** | Optional — the article must survive its removal        |

The link sits inside the sentence that describes which fields the importer maps
and what it derives, which is the only place a reader would want it. Do not
request exact-match anchor text, do not add a second link if the first is
removed, and do not re-add it in the author bio if a moderator strips it from the
body.

**Removal test.** If the editor deletes both the link and the whole product
section, the article still contains: the definition, the formula, the required
fields, the export procedure, the worked examples, the mistakes, the missing-stop
policy, the algorithm and the limitations. Checked, not assumed: no later section
refers back to it, and the only other mention of the product anywhere in the
piece is the disclosure line, which stands on its own.

## 5. Screenshot checklist — owner must capture these

**Four screenshots. All from a real MetaTrader 5 terminal, taken by the owner.**

The article is publishable with none of them — it references no figure by number,
so nothing breaks if they are omitted. They are worth taking because MQL5
articles with terminal captures read better, not because the text depends on
them.

**Rules for all four:**

- Real terminal, real window. **No AI-generated or mocked-up MetaTrader images.**
- **Do not** use `public/images/features/broker-import.png`. It is a marketing
  mock-up showing file types and result counters the product does not support; it
  was removed from the MetaTradee site on 2026-08-09 for exactly that reason.
- Hide before capturing, in every shot: **account number, account holder name,
  broker/server name, account balance, equity, free margin, and the terminal's
  title bar** (which carries the login). A demo account with a round starting
  balance is the cleanest way to satisfy all of this at once.
- Crop to the panel being discussed. A full-desktop capture leaks more and shows
  less.
- Light or dark theme is fine; be consistent across all four.

---

**Screenshot 1 — the History tab**

|             |                                                                                                                                                           |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Screen**  | Toolbox (`Ctrl+T`) → History tab                                                                                                                          |
| **Visible** | The tab strip with History selected; several closed positions; the column headers (Time, Symbol, Type, Volume, Price, S/L, T/P, Commission, Swap, Profit) |
| **Hidden**  | Account number, balance/equity summary row, broker name, title bar                                                                                        |
| **Goes in** | Section 6, "How to export MT5 trade history", after step 1                                                                                                |
| **Caption** | "The History tab in the MetaTrader 5 Toolbox. The S/L column is the one that decides whether R can be computed at all."                                   |

**Screenshot 2 — the Report submenu**

|             |                                                                                                                           |
| ----------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Screen**  | Right-click inside the History tab → Report submenu open                                                                  |
| **Visible** | The context menu with the available export formats legible                                                                |
| **Hidden**  | Any account data behind the menu; blur or scroll the grid first                                                           |
| **Goes in** | Section 6, after step 4                                                                                                   |
| **Caption** | "The export formats this build offers. There is no direct CSV option, so a spreadsheet format has to be re-saved as CSV." |

Note: this capture is also the **verification** for the one open factual item in
the article — that MT5 offers HTML, Open XML and OpenDocument and no CSV. Take
this one first and check the article's wording against what the menu actually
says on the current build.

**Screenshot 3 — Deals versus Positions**

|             |                                                                                                                                                                               |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Screen**  | History tab right-click menu showing the Positions / Orders / Deals view options                                                                                              |
| **Visible** | The view selector, ideally with Deals chosen                                                                                                                                  |
| **Hidden**  | Same as above                                                                                                                                                                 |
| **Goes in** | Section 6, beside step 2                                                                                                                                                      |
| **Caption** | "Deals rather than Positions. A position closed in three pieces appears as one row under Positions and four rows under Deals; the partial-close arithmetic needs the latter." |

**Screenshot 4 — a partially closed position (optional but the most useful)**

|             |                                                                                                                                              |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Screen**  | History tab, Deals view, filtered to one position closed in several fills                                                                    |
| **Visible** | The entry deal and each exit deal, with Volume, Price, Commission and Swap readable; the shared position identifier if the column is enabled |
| **Hidden**  | Account number, symbol optional, balance                                                                                                     |
| **Goes in** | Section 9, "Partial exits and multiple fills", before the worked arithmetic                                                                  |
| **Caption** | "One position, four deals, one initial risk. Summing an R computed separately for each exit triple-counts the denominator."                  |

If a real partially-closed position is not available on the demo account, **omit
this one** rather than staging something misleading. The worked example in the
text already carries the point.

## 6. Final submission checklist

Process:

- [ ] MQL5 account created and logged in
- [ ] Author access / article-submission permission confirmed on that account
- [ ] MQL5's current article requirements read (they change)
- [ ] **Outline from section 1 submitted first**
- [ ] Moderator feedback received and incorporated
- [ ] Full article submitted only after the outline is accepted

Content:

- [ ] Terminal screenshots captured (up to 4 — see section 5)
- [ ] Account numbers, balances, broker names and title bars hidden in every image
- [ ] Screenshot 2 used to confirm the export-format wording in section 6
- [ ] Article formatting adapted to the MQL5 editor (its own code-block and table
      syntax; the source is Markdown)
- [ ] Disclosure line present at the end
- [ ] Exactly one MetaTradee link, anchor unchanged, not re-added if removed

Truthfulness — verified against the repository on 2026-08-09, re-check if the
product changes:

- [ ] No automatic-sync claim — import is file-based, `liveSync: 'seam'`
- [ ] No backtesting claim — `COMING_SOON`, not built
- [ ] No direct MT5→CSV export claim — the conversion step is stated
- [ ] No automatic realised-R claim — the product computes gross P&L, net P&L, a
      **planned** reward-to-risk ratio and duration; not a realised R-multiple
- [ ] No unsupported file-format claim — `.csv`, `.json`, `.txt`, 20 MB
- [ ] No executable code presented as tested — section 14 is pseudocode plus a
      list of API calls, and claims nothing about compiling
- [ ] All four numeric examples labelled fictional

After publication:

- [ ] Record the **public article URL** in
      [submission-status.md](submission-status.md), under verified backlinks
- [ ] Confirm the link to metatradee.com survived moderation and is present in
      the live page
- [ ] Re-check it still resolves after 90 days

Until that first line is filled in with a real URL, there is no backlink, and
nothing should say otherwise.
