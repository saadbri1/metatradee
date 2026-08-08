# SEO Route Architecture

## The governing rule

**A route is registered in `src/config/seo.ts` when its content exists.**

Registering a path before building it makes `tests/unit/seo/registry.test.ts`
fail ("has no route file"). That is deliberate: it makes shipping a thin page the
harder path, and it is how the brief's "do not create empty pages" is enforced by
the build rather than by discipline.

`index: false` is the second lever — a route can exist and be reachable while
staying out of the sitemap and carrying `noindex`, which is how auth screens and
any not-yet-complete page are handled.

## Live

```
/                                   Home · trading journal software
├── /products                       Product tour
├── /solutions                      Workflows
├── /brokers                        Import + platform support
├── /pricing                        Plans
├── /resources                      Guides
├── /contact
├── /support
└── /tools                          Free calculators hub
    ├── /tools/position-size-calculator
    ├── /tools/xauusd-lot-size-calculator
    └── /tools/risk-reward-calculator
```

## Non-indexable but live

`/login` · `/register` · `/forgot-password` · `/reset-password` ·
`/verify-email` · `/session-expired` · `/unauthorized`

Registered, canonical, `noindex, nofollow`, absent from the sitemap, **and not
disallowed in robots.txt** — a crawler must fetch them to read the directive.

## Excluded from search entirely

`(protected)/*` (23 pages) · `/onboarding` · `/share/report/[token]` · `/api/*` ·
`/auth/*` — `noindex` at the layout, plus a robots.txt disallow to save crawl
budget on routes that only redirect.

## Planned

```
/trading-journal                    Primary non-brand commercial hub
/markets/{forex,futures,stock,options,crypto,xauusd}-trading-journal
/prop-firms/{prop-firm-trading-journal,funded-account-tracker,…}
/integrations/{mt4,mt5,ctrader,tradelocker,dxtrade,match-trader}
/tools/…                            9 further calculators
/templates/…                        Downloadable journal templates
/compare/trading-journal-vs-spreadsheet
/learn/…                            Educational cluster
```

## Deliberately NOT planned

| Route                                           | Why                                                                          |
| ----------------------------------------------- | ---------------------------------------------------------------------------- |
| `/integrations/tradingview`                     | No adapter in `src/features/import/adapters.ts`                              |
| `/integrations/ninjatrader`                     | No adapter                                                                   |
| `/integrations/tradovate`                       | No adapter                                                                   |
| `/integrations/interactive-brokers`             | IBKR Flex exists as a **connection-check seam only**, not a shipped import   |
| `/prop-firms/ftmo-*` and other firm-named pages | Rules change without notice; a stale rule can cost a reader a funded account |
| `/backtesting` as a product claim               | Backtesting is `COMING_SOON`. Replay ships.                                  |
| Per-firm or per-broker programmatic fan-out     | Would be one template with a keyword swapped                                 |

## Internal linking

Hub-and-spoke, all real `<a href>` elements rendered on the server.

```
/tools ──┬── /tools/position-size-calculator ──┬── /tools/xauusd-lot-size-calculator
         │                                     ├── /tools/risk-reward-calculator
         ├── /tools/xauusd-lot-size-calculator ┤   └── /brokers
         └── /tools/risk-reward-calculator ────┴── /products · /pricing · /register
```

Every tool page links to: its parent hub (breadcrumb), two sibling tools, one
product page, and one conversion target (`/register`). `/tools` is reachable from
the header **Resources** menu, so it is not an orphan — asserted by the existing
navigation tests.
