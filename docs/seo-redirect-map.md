# Redirect Map

## Current state

**No application-level redirects are configured, and none are needed yet.**

`next.config.mjs` has no `redirects()` block. That is correct for now: no public
URL has been renamed, retired or consolidated, so every redirect that exists is
infrastructural.

## Redirects in force (infrastructure, not code)

| From                                          | To                             | Type | Where                                    |
| --------------------------------------------- | ------------------------------ | ---- | ---------------------------------------- |
| `https://metatradee.com/*`                    | `https://www.metatradee.com/*` | 308  | Vercel domain config                     |
| `http://*`                                    | `https://*`                    | 308  | Vercel + HSTS preload                    |
| `/path/`                                      | `/path`                        | 308  | Next.js default (`trailingSlash: false`) |
| `/dashboard`, `/journal`, … (unauthenticated) | `/login?next=…`                | 307  | `src/middleware.ts`                      |

All are **one hop**. Verified: apex → www resolves in a single redirect, and the
canonical on the destination is self-referencing.

## Rules for future redirects

1. **One hop, always.** If `/a` → `/b` exists and `/b` later moves to `/c`,
   update the `/a` rule too. Never chain.
2. **301/308 for permanent moves**, so equity transfers. Reserve 302/307 for
   genuinely temporary states — the auth bounce is correctly temporary.
3. **Never redirect to a page that redirects.** Canonicals must point at a 200.
4. **Never mass-redirect to the homepage.** An irrelevant destination is treated
   as a soft 404 and loses the equity anyway; prefer a 410 or a real 404.
5. **Update `src/config/seo.ts` in the same change.** The old path leaves the
   registry, the new one enters it, so the sitemap moves with the redirect.

## Anticipated, when the planned routes land

| From                       | To                       | Reason                                                              |
| -------------------------- | ------------------------ | ------------------------------------------------------------------- |
| `/resources#journal-guide` | `/learn/trading-journal` | Anchor → real page when the cluster ships                           |
| `/brokers`                 | _(keep)_                 | Stays the hub; `/integrations/*` will be children, not replacements |

None of these are live. Add them to `next.config.mjs` **at the same time** as the
destination page, never before.
