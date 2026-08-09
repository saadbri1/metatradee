# SEO & Product Measurement Plan

**Status: implemented.** The typed analytics layer ships in `src/lib/analytics`.
This document is now a description of what runs, not a proposal.

## What is installed

| Aspect          | Choice                                                                                                                     |
| --------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Provider        | **Vercel Analytics** (`@vercel/analytics`) — already the hosting platform, so no new vendor, account or third-party domain |
| Cookies         | **None.** Cookieless and storing nothing on the device                                                                     |
| Consent banner  | **None implemented.** See "Consent — technical facts only" below. This document makes no legal determination               |
| Call sites      | `trackEvent(name, props)` from `@/lib/analytics` — the only entry point                                                    |
| Vendor coupling | Behind a swappable `AnalyticsSink`, matching the `lib/observability/report-error.ts` seam                                  |

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

## Consent — technical facts only

**A correction.** An earlier version of this document stated that no consent was
legally required. That was a legal conclusion, it was not mine to make, and it
has been removed. What follows describes technical behaviour only. **Whether
consent is required is a legal question and remains an open business task.**

| Question                                | Answer                                                                                                                                                                                                        |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Are cookies set by analytics?           | **No.** Vercel Analytics is cookieless                                                                                                                                                                        |
| Is an identifier written to the device? | **No** localStorage, sessionStorage or device identifier is written by analytics. (The chatbot separately stores a language preference — a UI setting, unrelated to analytics)                                |
| Is a cross-site identifier used?        | **No**                                                                                                                                                                                                        |
| What does Vercel receive?               | Page path, referrer and coarse request metadata for page views. For custom events: the event name plus the sanitised enum-only properties in the matrix below                                                 |
| Does Vercel receive an IP address?      | An IP is necessarily visible to any server receiving a request. Vercel documents that Web Analytics does not store it. **Verify against Vercel's current DPA before relying on this**                         |
| Is personal data deliberately sent?     | **No.** Enforced by the three-layer model above, and tested                                                                                                                                                   |
| Is there a consent gate?                | **No gate exists.** If one is later required, `setAnalyticsSink` is the single place to make collection conditional — the sink defaults to a no-op, so "consent not given" is already the natural inert state |

**Open business task, not an engineering one:** privacy-policy review, a DPA
check against Vercel's current terms, and a jurisdiction-specific determination
on whether a consent mechanism is needed. Engineering has made that cheap to add
— one function — but has not decided whether it is required.

## Privacy constraints on every event

Never sent, under any event: account balance · risk amount or percentage · stop
distance · lot size · entry/exit price · P&L · trade symbol · journal contents ·
chatbot message text · email · phone · name · broker credentials · API keys ·
checkout tokens · PayPal order ids · Supabase auth tokens · raw paths · user ids
(pseudonymous or otherwise).

## Event matrix — complete

| Event                      | Fires when                               | Properties (all closed enums)           | Wired |
| -------------------------- | ---------------------------------------- | --------------------------------------- | ----- |
| `organic_landing`          | First view with a search-engine referrer | `page_group`                            | ✅    |
| `calculator_viewed`        | Calculator page mounts                   | `calculator`                            | ✅    |
| `calculator_started`       | First input change, once per mount       | `calculator`                            | ✅    |
| `calculator_completed`     | A valid result renders                   | `calculator`                            | ✅    |
| `calculator_rejected`      | A validation refusal renders             | `calculator`, `reason`                  | ✅    |
| `calculator_related_click` | Related link clicked                     | `calculator`, `destination_type`        | ✅    |
| `signup_cta_click`         | A register CTA is clicked                | `page_group`                            | ✅    |
| `signup_started`           | First interaction with the register form | `source_page`, `source_component`       | ✅    |
| `signup_completed`         | Server **confirms** the account          | `source_page`                           | ✅    |
| `pricing_viewed`           | `/pricing` mounts                        | —                                       | ✅    |
| `plan_selected`            | A plan CTA is clicked                    | `plan`, `billing_period`, `source_page` | ✅    |
| `support_form_submitted`   | Contact or escalation submitted          | `category`, `outcome`                   | ✅    |
| `contact_channel_click`    | A public mailbox link is clicked         | `channel`, `source_page`                | ✅    |
| `chat_opened`              | Chatbot launcher opened                  | `page_group`                            | ✅    |
| `chat_message_sent`        | A chat turn is sent                      | `locale`                                | ✅    |
| `chat_escalation_opened`   | Escalation form opened                   | `locale`                                | ✅    |

`source_page` is a **page GROUP**, never a path — the same bucketing used
everywhere else, so an authenticated route carrying a record id can never be
reported.

`contact_channel_click` has no separate `purpose` property: `PUBLIC_EMAIL_PURPOSE`
maps one-to-one from `channel`, so it would be the same dimension twice.
`admin@` cannot be instrumented — it is not a `PublicEmailKey`.

## Funnels

### Organic tool funnel

```
organic_landing (page_group = tool)
  → calculator_viewed
  → calculator_started
  → calculator_completed
  → calculator_related_click | signup_cta_click
  → signup_started
  → signup_completed
```

The step that answers the strategy question is
`calculator_completed → signup_cta_click`. If it stays near zero the calculators
work as tools and fail as acquisition, and the CTA placement is what to change —
not the tool.

### Pricing funnel

```
pricing_viewed
  → plan_selected            (plan + billing_period)
  → signup_cta_click | signup_started
  → signup_completed
```

**There is deliberately no checkout-success event.** On the public site,
selecting a plan navigates to `/register`; PayPal checkout lives in the
authenticated billing area and is driven by a webhook. Inventing a client-side
"purchase" event would report revenue the payment provider had not confirmed.
The reliable server-confirmed point is the existing PayPal webhook, and wiring
an event there is a separate task with its own review — it was not done here.

## Core Web Vitals — Speed Insights

`@vercel/speed-insights` is installed and mounted once, in the same client leaf
as Analytics. Both inject a script and render no DOM, so neither adds layout
shift, and every public page stays statically prerendered.

**No field data exists yet.** The project reported `hasData: false` before this
change, and Speed Insights collects from real visitors over time — a successful
deploy starts collection, it does not produce measurements. Check the Vercel
Speed Insights dashboard after real traffic has accumulated.

Lab measurement (Lighthouse) has still not been run in any pass. The CWV targets
in `docs/seo-audit.md` remain **unverified**.

## What records on the current Vercel plan

|                                                    | Hobby (current)     | Pro |
| -------------------------------------------------- | ------------------- | --- |
| Web Analytics page views                           | ✅ records          | ✅  |
| **Custom events** (everything in the matrix above) | ❌ **not recorded** | ✅  |
| Speed Insights                                     | ✅ collects         | ✅  |

Every event above is wired, sanitised and tested, and **none of them is being
recorded today** — custom events require Pro. Nothing breaks meanwhile: the
beacon is dropped. On upgrade they begin recording with no code change, which is
why the vendor sits behind a swappable sink.

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
