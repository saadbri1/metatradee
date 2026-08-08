# SEO Measurement Plan

## Current state: nothing is measured

There is **no analytics in the repository**. No gtag, no `@vercel/analytics`, no
Plausible, no PostHog. Every event below is a **specification, not an
implementation** — none of it is wired up today.

This matters for reading any future SEO report: there is currently no way to tell
whether an organic visitor did anything at all after landing.

---

## Privacy constraints — these bound every event below

The product holds traders' financial records. Therefore:

- **Never** send a symbol, price, size, P&L, account balance, broker name or
  account number as an event parameter — including from the public calculators,
  where the inputs are a user's real account size and risk appetite.
- Calculator events record **that** a calculation happened and which tool, never
  the inputs or the result.
- No cross-site identifier. No advertising integration on public pages.
- Choose a tool that supports cookieless, IP-truncated collection. On a
  finance-adjacent site the consent banner is itself a conversion cost.

---

## Event specification

| Event                    | Trigger                                      | Parameters                                     | Funnel stage  | Priority |
| ------------------------ | -------------------------------------------- | ---------------------------------------------- | ------------- | -------- |
| `organic_landing`        | First page view, referrer is a search engine | `page_path`, `page_group`                      | Acquisition   | High     |
| `calculator_started`     | First input change on a tool page            | `tool_id`                                      | Activation    | High     |
| `calculator_completed`   | A valid result rendered                      | `tool_id`                                      | Activation    | High     |
| `calculator_error_shown` | A validation refusal rendered                | `tool_id`, `error_code`                        | Quality       | Medium   |
| `tool_related_click`     | Click on a related-tool link                 | `tool_id`, `destination`                       | Engagement    | Medium   |
| `signup_cta_click`       | Click a register CTA                         | `page_path`, `page_group`                      | Consideration | High     |
| `signup_started`         | Register form first interaction              | `source_page_group`                            | Conversion    | High     |
| `signup_completed`       | Account created                              | `source_page_group`                            | Conversion    | Critical |
| `pricing_viewed`         | `/pricing` view                              | `source_page_group`                            | Consideration | High     |
| `broker_connected`       | Import source selected                       | `adapter_id` _(no account data)_               | Activation    | High     |
| `first_trade_imported`   | First successful import                      | `trade_count_bucket` _(bucketed, never exact)_ | Activation    | Critical |
| `first_report_viewed`    | First report render                          | —                                              | Retention     | Medium   |
| `subscription_purchased` | Provider confirms                            | `tier`, `interval`                             | Revenue       | Critical |

`page_group` is a coarse bucket — `home`, `product`, `pricing`, `tool`,
`support` — so reporting can compare page types without a per-URL explosion.

## Funnel to watch

```
organic_landing (page_group = tool)
  → calculator_started
  → calculator_completed
  → signup_cta_click
  → signup_completed
  → first_trade_imported
```

The `calculator_completed → signup_cta_click` step is the one that tells you
whether the free-tool strategy converts or merely attracts. If it stays near
zero, the tools are working as tools and failing as acquisition, and the CTA
placement is the thing to change — not the tool.

---

## Search Console — external actions, none performed

These require dashboard access and **have not been done**:

1. **Verify the property.** Prefer the domain property (`metatradee.com`) via DNS
   TXT so `www`, apex and both protocols report together.
2. **Submit** `https://www.metatradee.com/sitemap.xml`.
3. **Inspect and request indexing** for the three new tool pages — they have no
   inbound links yet, so discovery would otherwise be slow.
4. **Check the Removals and Pages reports for `/login` and `/register`.** They
   were in the sitemap and may already be indexed. They now serve `noindex` and
   are _not_ robots-blocked, so Google can read the directive and drop them. If
   they persist beyond a few weeks, use a temporary removal.
5. **Confirm the canonical fix landed.** Any page still reporting
   `metatradee.vercel.app` as canonical is a stale cache.
6. Set up **brand vs non-brand** reporting by filtering queries containing
   "metatradee".
7. Watch the **Core Web Vitals** report once real traffic exists — field data,
   not Lighthouse.

## Core Web Vitals — unverified

The brief sets LCP ≤ 2.5s, INP < 200ms, CLS < 0.1, Lighthouse SEO 100 /
A11y ≥ 95 / Perf ≥ 90.

**No Lighthouse or field measurement was run in this pass.** The public pages are
statically prerendered and use `next/font` and `next/image`, which is the
structural groundwork, but structure is not a measurement. Treat every target
above as **untested** until a run against `https://www.metatradee.com` exists —
on a quiet machine, twice, warm run.
