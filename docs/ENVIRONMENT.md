# Environment Variables

All variables are declared in [`.env.example`](../.env.example). Copy it to
`.env.local` for development. **Never commit real secrets.**

Public variables are prefixed `NEXT_PUBLIC_` and are exposed to the browser —
put only non-secret values there. Everything else is server-only.

Public variables are **validated at startup** by `src/config/env.ts` (Zod);
a missing/invalid required value fails fast with a clear message.

## Required (app will not start without these)

| Variable                        | Scope  | Description                                |
| ------------------------------- | ------ | ------------------------------------------ |
| `NEXT_PUBLIC_APP_URL`           | public | Base URL of the app (redirects, metadata). |
| `NEXT_PUBLIC_SUPABASE_URL`      | public | Supabase project URL.                      |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Supabase anon key (RLS-protected).         |

## Optional / feature-gated

| Variable                                   | Scope           | Description                                                             |
| ------------------------------------------ | --------------- | ----------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_ENV`                      | public          | `development` \| `preview` \| `staging` \| `production`.                |
| `SUPABASE_SERVICE_ROLE_KEY`                | **server only** | Bypasses RLS. Never expose to the client.                               |
| `ANTHROPIC_API_KEY`                        | server          | AI provider (via Model Router).                                         |
| `OPENAI_API_KEY`                           | server          | AI provider.                                                            |
| `GOOGLE_AI_API_KEY`                        | server          | AI provider.                                                            |
| `OPENROUTER_API_KEY`                       | server          | AI provider aggregator.                                                 |
| `STRIPE_SECRET_KEY`                        | server          | Payments.                                                               |
| `STRIPE_WEBHOOK_SECRET`                    | server          | Stripe webhook verification.                                            |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`       | public          | Stripe.js publishable key.                                              |
| `PADDLE_API_KEY` / `PADDLE_WEBHOOK_SECRET` | server          | Paddle (merchant-of-record, tax).                                       |
| `RESEND_API_KEY` / `EMAIL_FROM`            | server          | Transactional email.                                                    |
| `DATABENTO_API_KEY`                        | server          | Historical candles for `/chart`. Optional; absent disables the feature. |
| `POLYGON_API_KEY`                          | server          | Placeholder — wired to no code.                                         |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`    | server/public   | Error tracking (optional).                                              |

## Rules

1. Feature code imports `env` from `@/config/env` — never reads `process.env` directly.
2. Server-only secrets are accessed via `serverEnv()` and never bundled to the client.
3. Add a new variable in three places: `.env.example`, the Zod schema in `src/config/env.ts` (if required), and this doc.
4. Rotate any leaked key immediately and purge it from history.
