# SEO & Product Measurement Plan

**Status: implemented.** The typed analytics layer ships in `src/lib/analytics`.
This document is now a description of what runs, not a proposal.

## What is installed

| Aspect          | Choice                                                                                                                                                                                                                      |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Provider        | **Vercel Analytics** (`@vercel/analytics`) — already the hosting platform, so no new vendor, account or third-party domain                                                                                                  |
| Cookies         | **None.** Cookieless and storing nothing on the device                                                                                                                                                                      |
| Consent banner  | **Not required, and deliberately avoided.** Nothing is stored on the device and no personal data is collected, so there is nothing to consent to under ePrivacy. A banner on a finance site is a measurable conversion cost |
| Call sites      | `trackEvent(name, props)` from `@/lib/analytics` — the only entry point                                                                                                                                                     |
| Vendor coupling | Behind a swappable `AnalyticsSink`, matching the `lib/observability/report-error.ts` seam                                                                                                                                   |

### The limit you need to know about

This project is on Vercel's **Hobby** plan. Page views are collected today;
**custom events require Pro and are not being recorded yet.** Nothing breaks in
the meantime — the beacon is simply dropped — and every event below starts
recording the moment the plan is upgraded, with no code change. That is the
reason the sink is a seam rather than a direct vendor call.

## How the privacy rule is enforced

Not by review discipline. Structurally, in three layers:

1. **Types.** Every event declares a closed payload in `events.ts`. There is no
   `Record<string, unknown>` and **no numeric field anywhere**. Passing a
   balance is a compile error.
2. **Runtime allowlist.** `sanitize.ts` strips any key the event's schema does
   not declare, and refuses numbers, objects, arrays and long strings
   categorically. Types are erased at runtime; this is not.
3. **Forbidden-key guard.** A substring denylist (`balance`, `risk`, `stop`,
   `lot`, `price`, `pnl`, `email`, `symbol`, `message`, …) fails the test suite
   if a schema is ever edited to allow such a key.

A test hands every event a full set of financial values and asserts none of them
appears in the serialised output.

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

## Events implemented

| Event                    | Trigger                                  | Properties                                  | Wired in                         |
| ------------------------ | ---------------------------------------- | ------------------------------------------- | -------------------------------- |
| `organic_landing`        | First view with a search-engine referrer | `page_group`                                | `analytics-provider`             |
| `calculator_started`     | First input change, once per mount       | `calculator`                                | both calculator forms            |
| `calculator_completed`   | A valid result rendered                  | `calculator`                                | both calculator forms            |
| `calculator_rejected`    | A validation refusal rendered            | `calculator`, `reason` (our own error code) | both calculator forms            |
| `signup_cta_click`       | Register CTA clicked                     | `page_group`                                | `SignupCta`                      |
| `pricing_viewed`         | `/pricing` mounted                       | —                                           | `TrackOnMount`                   |
| `support_form_submitted` | Contact or escalation submitted          | `category`, `outcome`                       | contact form, chatbot escalation |
| `chat_opened`            | Chatbot launcher opened                  | `page_group`                                | `support-chat`                   |
| `chat_message_sent`      | A turn is sent                           | `locale`                                    | `use-support-chat`               |
| `chat_escalation_opened` | Escalation form opened                   | `locale`                                    | `chatbot-panel`                  |

Declared and available, not yet wired (they need the flows they describe):
`signup_started`, `signup_completed`, `plan_selected`, `contact_channel_click`,
`calculator_related_click`.

**Note what is absent from every row:** no amount, no price, no lot size, no
message text, no email, no symbol, no user id, no raw path.

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
