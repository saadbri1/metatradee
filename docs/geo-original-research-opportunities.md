# Original Research Opportunities

**Last updated:** 2026-08-14
**Status:** planning only. **Nothing described here is implemented, and none of
it may be implemented without explicit written authorisation from the operator
and a privacy review.**

---

## Why this document exists

Answer engines cite sources for facts they cannot get elsewhere. Every
explanatory page MetaTradee publishes — what expectancy is, how to size a
position — is a fact a hundred other sites also state, and there is no reason to
prefer ours. Aggregate statistics drawn from real trading behaviour would be
different: nobody else has them, and they are the kind of claim an answer cites
by name.

MetaTradee holds the raw material. That is exactly why this document is mostly a
list of constraints.

---

## The rule that governs all of it

**Individual trading data is the user's, not ours.** It is stored under
row-level security, users were never told it would become published research,
and trading performance is financially sensitive personal information. No
dataset below may be produced by reading user rows under current terms.

Three conditions must ALL hold before any item here becomes work:

1. **Explicit, informed, opt-in consent**, collected separately from the terms
   of service, revocable, and defaulting to off. Silence is not consent.
2. **k-anonymity with a floor high enough that no cohort identifies anyone.**
   A "traders on prop-firm accounts trading XAUUSD in the Tokyo session" cohort
   can easily be one person. Suppress any cell below the threshold rather than
   rounding it.
3. **No per-user figure ever leaves the aggregate.** No minimums, no maximums,
   no "our best trader" — extremes identify individuals and invite the exact
   guaranteed-returns framing the rest of the site refuses.

If any condition fails, the item does not ship. There is no reduced version.

---

## Candidate datasets

Ordered by value-to-risk. Each states what would make it publishable.

### 1. Journalling behaviour, not trading results — _lowest risk, do first_

**Claim shape:** "Traders who tag a mistake on a losing trade review that trade
N× more often than traders who do not."

**Why it is the safest:** it measures use of the product, not financial
outcomes. No P&L leaves the system. Even so it needs consent under condition 1,
because it is still derived from individual behaviour.

**What it would need:** event counts already collected by the analytics layer
(see `seo-measurement-plan.md` for the privacy rules those events follow), a
consent flag, and a cohort floor.

### 2. Distribution of planned reward-to-risk ratios

**Claim shape:** "Across consenting accounts, the median planned reward-to-risk
on logged trades is X:1, and Y% of trades are planned below 1:1."

**Why it is valuable:** it is a genuinely uncollected number, and it is
descriptive rather than prescriptive — it reports what traders plan, and makes
no claim about what they should plan.

**Risk:** moderate. Combined with symbol and session it narrows quickly. Publish
the distribution shape only, never joined to instrument or account type.

### 3. Frequency of self-tagged mistake categories

**Claim shape:** "The most frequently self-tagged mistake among consenting
traders is _moved my stop_, appearing on X% of tagged losing trades."

**Why it is valuable:** it is first-party, it is interesting, and it maps
directly onto questions people actually ask an assistant ("what mistakes do
traders make").

**Risk:** moderate. Free-text tags must be excluded entirely — only fixed
taxonomy values can be counted, because free text carries identifying detail.

### 4. Import-format reality

**Claim shape:** "Of statement files uploaded, X% are MetaTrader 5, Y% MetaTrader
4," and so on.

**Why it is the least sensitive of the useful ones:** it describes tooling
choice, not performance, and the cohorts are large. Still requires consent, and
must report platform share only — never file contents, never per-account counts.

### 5. Anything joining P&L to a trader attribute — _do not build_

Win rates by experience level, returns by instrument, profitability by session.
Every one of these is a financial-performance claim about identifiable cohorts,
and every one invites being quoted as "traders using MetaTradee earn…". That is
a claim this product must never make. **Rejected, not deferred.**

---

## Publication requirements, if any of the above ever ships

- **State the method in the page.** Sample size, date range, cohort definition,
  what was excluded, and the consent basis. A statistic without a method is the
  kind of unsourced number this codebase refuses everywhere else.
- **Date it, and re-run it.** A statistic with no date is quoted forever. Give
  each figure a visible `updated` date and a scheduled refresh.
- **No `aggregateRating`, ever.** Aggregate research is not a review score, and
  `structured-data.test.ts` currently fails the build if rating markup appears.
- **Say what it does not mean.** Descriptive, not predictive; no reader should
  come away thinking the numbers forecast their own results.
- **Legal review before the first publication**, covering the consent wording,
  the jurisdiction's rules on financial-performance statements, and the privacy
  notice.

---

## What is safe to publish today, with no user data at all

These need no consent and no review, because they are facts about the product
rather than about people — and they are still things no competitor can copy:

- The exact calculation definitions the engine uses, including the cases where
  MetaTradee shows an em dash instead of a number, and why.
- The de-duplication rule (content hash, not broker ticket) and what it catches.
- The full list of statement column names each importer recognises.
- Why planned reward-to-risk and realised R-multiple are different figures.

Three of the four are already on the site. They are the correct place to spend
effort until consent infrastructure exists.
