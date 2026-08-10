# AI Search Discovery Plan

**Last updated:** 2026-08-10
**Scope:** eligibility for retrieval and citation in ChatGPT Search and comparable
AI answer engines (Perplexity, Google AI Overviews, Bing Copilot, Claude with
search).

> **This document promises no rankings and no citations.** Nothing here can make
> an answer engine recommend MetaTradee. What follows is the part that is
> actually in our control: being crawlable, being unambiguous about what the
> product is, and being described accurately somewhere other than our own site.
> Anyone who reads this as a forecast is reading it wrong.

---

## 1. How an answer engine ends up citing a product

Worth stating plainly, because it determines what is worth doing:

1. **Retrieval, not memory.** ChatGPT Search answers a query by fetching and
   reading pages at query time, then citing what it read. Being in a model's
   training data is a separate thing and is not what produces a citation.
2. **The crawler must be allowed.** OpenAI states that sites opted out of
   `OAI-SearchBot` "will not be shown in ChatGPT search answers". This is a gate,
   not a ranking factor — passing it earns eligibility and nothing more.
3. **The claim must be extractable.** An engine quotes sentences. A fact that
   only exists inside a client-rendered component, an image, or a diagram is a
   fact it cannot cite.
4. **Corroboration decides trust.** Where independent sources exist, they
   influence what the engine says about a product far more than the vendor's own
   page does. This is where MetaTradee is currently weakest — see §4.

Consequence: §2 and §3 are largely **done**; §4 is **entirely manual** and is the
real constraint.

---

## 2. Crawler eligibility — verified 2026-08-10

Measured against production (`https://www.metatradee.com`) by sending each
user-agent and recording the status code. Not inferred from configuration.

| Crawler         | Purpose                                | Result on 10 public pages |
| --------------- | -------------------------------------- | ------------------------- |
| `OAI-SearchBot` | ChatGPT Search inclusion               | **200 on all**            |
| `GPTBot`        | Model training (independent of search) | 200 on all                |
| `Googlebot`     | Google index, feeds AI Overviews       | 200 on all                |
| `bingbot`       | Bing index, feeds Copilot              | 200 on all                |
| `PerplexityBot` | Perplexity                             | 200 on all                |
| `ClaudeBot`     | Anthropic                              | 200 on all                |

`robots.txt` uses a single `User-agent: *` / `Allow: /` rule, so every crawler
above is allowed by inheritance. **Do not "improve" this by adding per-bot
`Allow` blocks.** A named group replaces the wildcard for that agent rather than
adding to it, so an incomplete named block is a way to accidentally narrow access
that currently works. The wildcard is the safer construction.

`Disallow` covers only `/api/`, `/auth/`, `/share/` and the authenticated app.
Auth screens are deliberately _not_ disallowed — they carry `noindex`, and a
crawler has to fetch a page to see that.

**OAI-SearchBot and GPTBot are separate controls.** Blocking GPTBot to opt out of
training does _not_ remove the site from ChatGPT Search, and blocking
`OAI-SearchBot` does. If an opt-out of training is ever wanted, disallow GPTBot
alone and leave `OAI-SearchBot` allowed.

### Re-verification

Re-run after any change to `robots.txt`, hosting, WAF, or bot-protection
settings. OpenAI reports roughly 24 hours for a `robots.txt` change to take
effect for search.

```bash
curl -sS -o /dev/null -w "%{http_code}\n" \
  -A "OAI-SearchBot/1.0; +https://openai.com/searchbot" \
  https://www.metatradee.com/
```

---

## 3. On-site readiness

Done, and re-checkable in the repository rather than taken on trust:

- **Server-rendered answers.** The acquisition pages have no client island at
  all; the FAQ text an engine would quote is in the initial HTML.
- **One entity.** `Organization` and `SoftwareApplication` carry stable `@id`
  values (`/#organization`, `/#software`), so the homepage, `/pricing` and
  `/products` describe one product rather than three same-named ones.
- **Machine-readable pricing.** `/pricing` emits `Offer` nodes built from the
  same `PLANS` object the entitlement gates enforce. Paid tiers carry **no**
  `availability` while checkout is closed, rather than a false `InStock`.
- **`FAQPage` only where a visible FAQ exists**, always generated from the same
  array the page renders.
- **`BreadcrumbList` on every public page** below the root.
- **No `aggregateRating`, no `reviewCount`, no user counts, no awards.** There
  are no real ones. An invented rating is both a manual-action risk and the
  fastest way to be quoted saying something false.

### The failure mode this project has already hit twice

Both times, the vendor's own marketing contradicted the vendor's own facts page:

- `siteConfig.description` claimed MetaTradee "protects your funded accounts in
  real time" — describing `propFirmTools`, which `plans.ts` marks NOT
  IMPLEMENTED, and implying the broker connection `/brokers` says does not exist.
  That string was the meta description on every page _and_ the `description` in
  both JSON-LD blocks.
- Several surfaces claimed a computed **R-multiple**. The engine computes gross
  P&L, net P&L and the **planned reward-to-risk ratio**; a realised R-multiple is
  not computed at all.

An answer engine repeating either of those would have been our error, not its
hallucination — and unlike a page, a citation cannot be edited after the fact.
**Any capability sentence must be checkable against `ADAPTERS`, `PLANS` or
`COMING_SOON`.**

---

## 4. External authority — the actual gap

**Verified external backlinks: none.** No third-party page is known to link to or
describe MetaTradee. Every item below is prepared and unsent.

This is not a formality. With no independent source, an answer engine asked to
compare trading journals has nothing to corroborate our claims against, and will
tend to name products that reviewers, directories and forums have written about.

### Status vocabulary

| Status                        | Means                                                                                                          |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `READY_FOR_MANUAL_SUBMISSION` | Material drafted. Nothing sent. No link exists.                                                                |
| `SUBMITTED`                   | Sent on a date, by a named person. Outcome unknown.                                                            |
| `PUBLISHED`                   | Live third-party page exists. **Record the URL.**                                                              |
| `BACKLINK_VERIFIED`           | That URL was fetched and confirmed to contain a link to `metatradee.com`. Record follow/nofollow and the date. |

A pitch is not a submission. A submission is not a publication. A publication
without a verified link is not a backlink. Do not advance a status without the
evidence that tier requires.

### Targets, in priority order

Priority reflects _relevance to the target intents_ and _likelihood of being
retrieved_, not ease.

| #   | Target                  | Type                          | Status                        | Blocking on                            |
| --- | ----------------------- | ----------------------------- | ----------------------------- | -------------------------------------- |
| 1   | **MQL5 Articles**       | Trading-authority publication | `READY_FOR_MANUAL_SUBMISSION` | Author account; send outline first     |
| 2   | **AlternativeTo**       | Software directory            | `READY_FOR_MANUAL_SUBMISSION` | User account                           |
| 3   | **Capterra**            | Review directory              | `READY_FOR_MANUAL_SUBMISSION` | Vendor verification                    |
| 4   | **G2**                  | Review directory              | `READY_FOR_MANUAL_SUBMISSION` | Vendor verification                    |
| 5   | **Product Hunt**        | Launch directory              | `READY_FOR_MANUAL_SUBMISSION` | Maker account; launch date is one shot |
| 6   | **Crunchbase**          | Company database              | `READY_FOR_MANUAL_SUBMISSION` | Company profile                        |
| 7   | **Tradeciety**          | Trading education             | `READY_FOR_MANUAL_SUBMISSION` | Send via site contact form             |
| 8   | **Forex Factory**       | Trading community             | `READY_FOR_MANUAL_SUBMISSION` | Account with genuine history           |
| 9   | **NexusFi**             | Trading community             | `READY_FOR_MANUAL_SUBMISSION` | Account with genuine history           |
| 10  | **HARO / Connectively** | Journalist sourcing           | `READY_FOR_MANUAL_SUBMISSION` | Source account; answer a live query    |

Why MQL5 is first: it is the MetaTrader ecosystem's own publication, which makes
it the most topically credible place for an MT5-journal claim to be corroborated,
and its article pages are indexed and retrieved. The drafted article is at
[backlinks/mql5-r-multiple-article.md](backlinks/mql5-r-multiple-article.md); the
submission package is at
[backlinks/mql5-submission-package.md](backlinks/mql5-submission-package.md).

Why directories rank above communities: a directory listing is a durable,
indexed, structured description of the product that answer engines retrieve when
asked to compare tools. A forum post is a single dated thread and is frequently
worth less than the account risk of posting it badly.

### Rules that override any of the above

1. **Never buy a link**, and never trade one for payment or product.
2. **Never write, solicit, or incentivise a fake review.** A review must come
   from a real user describing real use.
3. **Disclose affiliation** in every community post. Both forums listed will spot
   an undisclosed vendor, and the cost is the account.
4. **Never link cold into a forum.** Contribute first; link only where it
   genuinely answers what was asked.
5. **Every pitch must match the live site**: file import, not broker sync; no
   backtesting; no prop-firm monitoring; planned reward-to-risk, not R-multiple.
   An external page describing a feature we do not ship is worse than no page —
   it is a false claim we no longer control.

---

## 5. Top 10 actions, in order

Ranked by expected effect on AI-search eligibility per unit of effort. Items
1–3 are shipped in this change; 4–10 are manual and need a human with accounts.

| #   | Action                                                                                             | Owner | State                   |
| --- | -------------------------------------------------------------------------------------------------- | ----- | ----------------------- |
| 1   | Remove the real-time / funded-account claim from the site-wide description and both JSON-LD blocks | code  | **Done**                |
| 2   | Answer the seven high-intent questions explicitly in server-rendered text and `FAQPage`            | code  | **Done**                |
| 3   | Emit `Offer`, `SoftwareApplication` and `BreadcrumbList` on `/pricing`, `/products`, `/brokers`    | code  | **Done**                |
| 4   | Submit the MQL5 outline, then the article                                                          | human | Blocked on account      |
| 5   | Create the AlternativeTo listing                                                                   | human | Blocked on account      |
| 6   | Complete Capterra and G2 vendor verification                                                       | human | Blocked on verification |
| 7   | Create the Crunchbase company profile                                                              | human | Blocked on account      |
| 8   | Decide a Product Hunt launch date and launch once                                                  | human | Blocked on decision     |
| 9   | Begin genuine participation on Forex Factory / NexusFi                                             | human | Blocked on account age  |
| 10  | Answer live HARO/Connectively queries on trading-journalling topics                                | human | Blocked on account      |

Record every outcome in
[backlinks/submission-status.md](backlinks/submission-status.md), which remains
the single register of what has actually happened.

---

## 6. `/llms.txt` — audited, and deliberately not added

**Decision: do not add `/llms.txt` to MetaTradee. Revisit only if OpenAI, Google
or Anthropic documents production support for it.**

It was evaluated because it is widely recommended, not because anything about
this project called for it. The evidence does not support adding it:

- **No official requirement or support.** OpenAI's crawler documentation
  describes `robots.txt` and its published IP ranges as the mechanism for
  controlling and enabling ChatGPT Search inclusion. It sets out no `llms.txt`
  requirement for publishers. Google's Search guidance states `llms.txt` is not
  needed for AI Overviews or AI Mode, and Google has said it does not support it
  and does not plan to. As of Q1 2026 no major AI provider has publicly committed
  to reading it in production.
- **The crawlers do not fetch it.** Published log analysis across a large sample
  of AI-bot traffic found requests for `/llms.txt` to be a negligible fraction of
  it; `OAI-SearchBot`, `GPTBot`, `ClaudeBot` and `PerplexityBot` overwhelmingly
  request HTML directly.
- **It is not a standard.** No W3C or IETF backing, no enforcement, no agreed
  schema.
- **It would be a third copy of our facts.** This codebase already went to
  considerable trouble to have exactly one source per fact — the sitemap derives
  from the SEO registry, `/brokers` derives from `ADAPTERS`, pricing derives from
  `PLANS`. A hand-maintained `llms.txt` restating the product summary, plan
  prices and supported platforms is a file that drifts silently and, when it
  does, is wrong in a format specifically intended for machine consumption. That
  is the exact failure this project has already been bitten by twice (§3).

**What actually delivers the benefit `llms.txt` promises** — a clean, extractable
statement of what the product is — is already in place: server-rendered FAQ text,
a consistent entity with stable `@id`s, and structured data generated from the
enforcing config. That content is fetched on every crawl, by every engine, and
cannot drift from the product.

If it is ever added, generate it from the SEO registry and `PLANS` in the same
way the sitemap is generated. Never hand-write it.

---

## 7. What cannot be guaranteed

State these plainly to anyone who asks what this work buys:

- **No ranking or citation can be guaranteed.** Answer engines choose sources by
  undisclosed, changing criteria. Eligibility is winnable; selection is not.
- **Crawlability is necessary, not sufficient.** Every crawler returning 200
  means we are allowed to compete, nothing more.
- **Structured data is a hint.** It is not a ranking factor and does not
  guarantee a rich result or a citation.
- **No timeline.** There is no published SLA for a page entering ChatGPT Search,
  and no way to force a recrawl.
- **Third parties decide.** MQL5 moderators, directory editors and forum
  communities can reject anything here for their own reasons.
- **We cannot see most of it.** AI-search referrals are poorly attributed in
  analytics; absence of measured traffic is not proof of absence of citation.
- **A verified backlink can disappear.** Re-check each one 90 days on.

The honest summary: this work makes MetaTradee **eligible, unambiguous and
accurately described**. Whether an engine cites it depends on parties we do not
control, and no part of it should be reported as a ranking outcome.
