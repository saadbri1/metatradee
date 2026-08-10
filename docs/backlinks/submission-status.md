# Backlink Submission Status

**Last updated:** 2026-08-09

## Verified external backlinks

**None.**

No submission has been made from this environment, and therefore no external
link to MetaTradee has been created or verified. Every prospect below is
`READY_FOR_MANUAL_SUBMISSION`.

This section stays empty until someone can paste a **public external URL that
contains a link to metatradee.com**. A prepared pitch is not a backlink; a
submitted form is not a backlink; only a live, publicly reachable page is.

| External URL | Anchor text | Target | Follow/nofollow | Date verified | Verified by |
| ------------ | ----------- | ------ | --------------- | ------------- | ----------- |
| _(none)_     |             |        |                 |               |             |

## Why nothing was submitted

Every prospect requires an authenticated account on a third-party platform.
This environment has no such credentials, and creating accounts on someone
else's service — or submitting content under the project's name — is not
something to do unattended. Each one also needs a human decision about timing
(Product Hunt launches are a single shot) and about tone in communities where
promotion is unwelcome.

## Status

| Prospect            | Status                      | Blocking on                                    |
| ------------------- | --------------------------- | ---------------------------------------------- |
| MQL5 Articles       | READY_FOR_MANUAL_SUBMISSION | Author account; compile the script (see below) |
| Tradeciety          | READY_FOR_MANUAL_SUBMISSION | Send via the site's own contact form           |
| HARO / Connectively | READY_FOR_MANUAL_SUBMISSION | Source account; must answer a live query       |
| Product Hunt        | READY_FOR_MANUAL_SUBMISSION | Maker account; launch date decision            |
| AlternativeTo       | READY_FOR_MANUAL_SUBMISSION | User account                                   |
| G2                  | READY_FOR_MANUAL_SUBMISSION | Vendor verification                            |
| Crunchbase          | READY_FOR_MANUAL_SUBMISSION | Company profile creation                       |
| Capterra            | READY_FOR_MANUAL_SUBMISSION | Vendor verification                            |
| Forex Factory       | READY_FOR_MANUAL_SUBMISSION | Account with genuine posting history           |
| NexusFi             | READY_FOR_MANUAL_SUBMISSION | Account with genuine posting history           |

## MQL5 — article drafted, not submitted

**Status: READY_FOR_MANUAL_SUBMISSION.** No submission has been made and no
backlink exists.

The full publication-ready article now lives at
[mql5-r-multiple-article.md](mql5-r-multiple-article.md) — "How to Calculate
R-Multiples Correctly From MT5 Trade History", ~2,960 words, one contextual link
to `/integrations/metatrader-5`, one disclosure line. The brief in
[mql5-pitch.md](mql5-pitch.md) is what it was written from; the article
supersedes it for submission purposes.

The submission package — moderator outline, editor synopsis, disclosure, citation
policy, screenshot specification and the final checklist — is at
[mql5-submission-package.md](mql5-submission-package.md). **Send the outline
first**: MQL5 asks for a plan before a finished article, and a moderator who
wants a different emphasis should say so before the full piece is committed to
it.

**The article contains no executable code.** An earlier draft carried an
`RExport.mq5` script that had never been compiled or run; presenting it as
working code was a rejection risk, since MQL5 reviewers run what they are sent.
It is now language-neutral pseudocode plus the list of MQL5 API calls needed to
implement it, and nothing in the article claims to compile.

One thing must still happen before a human submits it: **confirm the Report
submenu labels** in section 6 against the current terminal build. The article
states MT5 offers HTML, Open XML and OpenDocument with no direct CSV, and
`/integrations/metatrader-5` now says the same — the two must not diverge.

No screenshot in this repository may be used with it. The article names the real
MetaTrader captures the author must take instead.

### Site corrections shipped alongside it (2026-08-09)

Preparing the article surfaced three defects on the live site, all fixed before
submission so the article and the pages agree:

1. `broker-import.png` was a mock-up advertising `.zip`, `.xlsx` and a 2 GB cap
   against a real `.csv`/`.json`/`.txt` at 20 MB, with invented result counters.
   Removed from both integration pages, `/trading-journal` and the product
   sections; the integration pages now state the real limits in text.
2. Six public surfaces claimed MetaTradee computes an "R multiple". It computes
   gross P&L, net P&L, a **planned** reward-to-risk ratio and duration. Corrected
   everywhere, with the distinction stated explicitly on the integration pages.
3. Both integration pages described a direct CSV export from MetaTrader, which
   neither terminal offers. They now describe the conversion step.

## Rules for whoever picks this up

1. **Never buy a link.** Never exchange links for payment, and never ask for
   one in those terms.
2. **Never fabricate a review** or ask for one in exchange for anything.
3. **Disclose affiliation** in every community post. Both forums here will spot
   an undisclosed vendor immediately, and the cost is the account.
4. **Do not link cold in a forum.** Contribute for a while first; link only
   where it genuinely answers the question asked.
5. **Only claim what the product does.** File import, not broker sync. No
   backtesting. The landing pages state the limits; the pitches must match.
6. **Record the public URL here** once a link is live — and check it still
   resolves 90 days later.
