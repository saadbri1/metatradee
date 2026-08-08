# SEO Audit — MetaTradee

**Audited:** 2026-08-06 · **Commit at audit:** `09d8f6b` · **Auditor:** engineering

This audits the repository as it actually is. Where something was fixed during
this pass it is marked **FIXED**; where it is still open it is marked **OPEN**
with the reason.

---

## 1. Current architecture

| Aspect          | Finding                                                                                                                                                        |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework       | Next.js **15.5.20**, App Router, React 19, TypeScript strict                                                                                                   |
| Package manager | pnpm                                                                                                                                                           |
| Rendering       | Public marketing pages are **statically prerendered** (`○` in build output). Authenticated app is dynamic (`ƒ`). This is the right split and needed no change. |
| Styling         | Tailwind + semantic CSS-variable tokens                                                                                                                        |
| Fonts           | `next/font` — Inter + IBM Plex Mono, self-hosted, `display: swap`                                                                                              |
| Images          | `next/image`, AVIF/WebP configured in `next.config.mjs`                                                                                                        |
| i18n            | **None at the site level.** Only the support chatbot is multilingual (en/fr/ar) and it is scoped to the widget. No localized routes exist.                     |
| CMS / blog      | **None.** No MDX, no content directory, no post model.                                                                                                         |
| Analytics       | **None.** No gtag, no `@vercel/analytics`, no Plausible, no PostHog.                                                                                           |
| Redirects       | **None configured** in `next.config.mjs`. `trailingSlash` unset → Next's default 308 from `/path/` to `/path`, which is consistent.                            |
| Error pages     | `not-found.tsx`, `error.tsx`, `global-error.tsx` all present                                                                                                   |
| Domain          | Apex 302 → `www.metatradee.com`, both alias the same Vercel deployment                                                                                         |

### Route inventory

**Public (8 at audit):** `/`, `/products`, `/solutions`, `/brokers`, `/pricing`,
`/resources`, `/contact`, `/support`
**Auth (5):** `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`
**Standalone:** `/session-expired`, `/unauthorized`, `/share/report/[token]`
**Authenticated app:** 23 pages under `(protected)` — dashboard, journal,
analytics, chart, calendar, playbook, reports, goals, ai-coach, billing, help,
settings/\*
**API:** 6 route handlers under `/api`

---

## 2. Critical issues

### 2.1 The sitemap advertised auth pages and omitted real ones — **FIXED**

`src/app/sitemap.ts` listed exactly five URLs: `/`, `/contact`, `/support`,
**`/login`** and **`/register`**.

Two defects in one file:

- **`/login` and `/register` were being actively submitted for indexing.** The
  file's own comment claimed _"Public, indexable routes only. Authenticated app
  routes are intentionally excluded"_ while doing the opposite.
- **Five real marketing pages were missing** — `/products`, `/solutions`,
  `/brokers`, `/pricing`, `/resources`. The commercially important ones. Google
  had no sitemap signal for the pricing page.

Root cause: the sitemap was a hand-maintained list, kept separately from the
pages it described. Two hand-kept lists of the same thing always drift.

**Fix:** `src/config/seo.ts` is now a single registry; the sitemap is derived
from `indexablePages()`, which is the same predicate that decides the page's own
`robots` meta tag. They cannot disagree. Asserted in `tests/unit/seo/registry.test.ts`.

### 2.2 No `noindex` on any private surface — **FIXED**

Only `/share/report/[token]` carried `robots: { index: false }`. The five auth
pages, all 23 authenticated pages, onboarding, `/session-expired` and
`/unauthorized` had no directive at all.

**Fix:** `noindex, nofollow` applied at the **layout** level for `(auth)`,
`(protected)` and `(onboarding)` — so a route added later inherits it rather
than needing to be remembered — plus the two standalone pages.

### 2.3 robots.txt covered 4 of 23 authenticated segments — **FIXED**

Disallowed only `/dashboard`, `/journal`, `/analytics`, `/settings`, `/api/`,
`/share/`. Left crawlable: `/chart`, `/calendar`, `/playbook`, `/reports`,
`/goals`, `/ai-coach`, `/billing`, `/help`, `/onboarding`, `/auth/`.

**Fix:** all authenticated segments enumerated from one list.

Deliberately **not** added to the disallow list: `/login` and `/register`. A
crawler must be able to fetch a page to read its `noindex`; blocking a URL
Google already knows preserves exactly the indexing the directive removes.
Asserted by a test.

### 2.4 `NEXT_PUBLIC_APP_URL` pointed at the `.vercel.app` domain — **FIXED (earlier)**

Canonical, `og:url`, `og:image`, robots `Host`, and every sitemap URL advertised
`https://metatradee.vercel.app` instead of the real domain. Fixed by correcting
the Production environment variable and redeploying.

---

## 3. High-impact opportunities

| #   | Opportunity                                                                                                                           | Status                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1   | **No free tools.** The single largest gap. Calculator keywords are high-volume, high-intent, and reachable without content authority. | **3 built** — see §6                                                    |
| 2   | **No breadcrumbs on public pages.** Breadcrumbs existed only in the authenticated shell, with no `BreadcrumbList` anywhere.           | **FIXED**                                                               |
| 3   | **No topical hubs.** Eight flat pages, no `/markets`, `/prop-firms`, `/integrations`, `/compare`, `/learn`.                           | **OPEN** — needs content                                                |
| 4   | **No blog or editorial surface.** No mechanism to publish a guide.                                                                    | **OPEN**                                                                |
| 5   | **No analytics.** Nothing measures whether any of this works.                                                                         | **OPEN** — plan written                                                 |
| 6   | Homepage carries `Organization`, `SoftwareApplication`, `FAQPage`. No `WebSite`, no `BreadcrumbList`, none on inner pages.            | **Partially fixed** — `BreadcrumbList` + `WebApplication` on tool pages |

---

## 4. Indexation risks

| Risk                             | Status                                                                                                                       |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Auth pages in sitemap            | **Resolved**                                                                                                                 |
| Private routes without `noindex` | **Resolved**                                                                                                                 |
| Shared report tokens crawlable   | Already had `noindex`; `/share/` also disallowed                                                                             |
| Thin pages diluting the site     | **Avoided by policy** — registry `index: false` keeps a route out of the sitemap and out of the index until content-complete |
| Parameter/filter duplicates      | Not applicable — no public faceted URLs exist                                                                                |

---

## 5. Duplicate-content and cannibalization risks

No duplicate targeting exists today, because there are only eight public
content pages and each addresses a distinct intent.

The **real** risk is forward-looking: the requested architecture has
`/trading-journal` and `/` and `/products` all plausibly targeting _"trading
journal software"_. The registry now carries a `cluster` field and a test asserts
**one cluster maps to exactly one canonical URL**, so this is caught at build
time rather than in Search Console six months later.

---

## 6. What was built

| Route                               | Content status                                                              |
| ----------------------------------- | --------------------------------------------------------------------------- |
| `/tools`                            | Hub. Lists only the three calculators that exist.                           |
| `/tools/position-size-calculator`   | Complete — working calculator, formula, worked example, assumptions, limits |
| `/tools/xauusd-lot-size-calculator` | Complete — gold contract size, dollar/pip stop entry                        |
| `/tools/risk-reward-calculator`     | Complete — ratio plus breakeven win rate                                    |

All three are **server-rendered documents with a small client island**: the H1,
explanation, formula, worked example, internal links and JSON-LD are in the HTML;
only the form is client-side. Results are never gated behind an email.

Formulas are covered by **34 unit tests** of hand-checkable arithmetic, including
every rejection path — a zero stop distance divides to `Infinity` and would
render as a position size no account could take.

---

## 7. Performance risks

Public pages were already statically prerendered with `next/font` and
`next/image`, which is the bulk of the work. Remaining, unquantified:

- **No Lighthouse run was performed in this pass.** The CWV targets in the brief
  are therefore **unverified**. See `docs/seo-measurement-plan.md`.
- The support chatbot mounts on every public page. It is already lazy — the panel
  does not render until opened — but the launcher is a client component on every
  route, and its cost has not been measured.
- Marketing screenshots are the most likely LCP element on `/products`; not audited.

---

## 8. Recommended route architecture

See `docs/seo-route-architecture.md`. The principle: **a route exists when its
content does.** Registering a path in `src/config/seo.ts` before the page is
written makes the build fail — deliberately.

---

## 9. Implementation priorities

1. ~~Fix indexation (sitemap, robots, `noindex`)~~ — done
2. ~~Centralize SEO configuration~~ — done
3. ~~Ship the first free tools~~ — done (3 of 12)
4. **Analytics** — nothing is currently measurable
5. **`/trading-journal` commercial hub** — the primary non-brand target
6. Remaining calculators, in the order in `docs/seo-content-roadmap.md`
7. Market and integration hubs, each gated on real content
8. Comparison pages — **blocked** on verifiable competitor data
