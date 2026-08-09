# Development Setup

## Prerequisites

- **Node.js** ≥ 20.11 (LTS recommended)
- **pnpm** 9 (`corepack enable` then `corepack prepare pnpm@9 --activate`)
- A **Supabase** project (free tier is fine for local dev)

## First-time setup

```bash
# 1. Install dependencies
pnpm install

# 2. Create your local env file
cp .env.example .env.local

# 3. Fill in the required public Supabase values in .env.local:
#    NEXT_PUBLIC_SUPABASE_URL
#    NEXT_PUBLIC_SUPABASE_ANON_KEY
#    (see docs/ENVIRONMENT.md for the full list)

# 4. Start the dev server
pnpm dev
# -> http://localhost:3000
```

Git hooks are installed automatically via the `prepare` script (Husky).

## Verifying the foundation (quality gates)

Run each before pushing; CI runs all of them on every PR:

```bash
pnpm format:check   # Prettier
pnpm lint           # ESLint (zero errors required)
pnpm typecheck      # TypeScript strict (zero errors required)
pnpm test           # Vitest unit tests
pnpm build          # Production build must succeed
```

A one-shot check:

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

## End-to-end tests

```bash
pnpm exec playwright install --with-deps chromium   # first time
pnpm test:e2e
```

## Production verification (required to call anything "live")

Every user-facing Production task ends with:

```bash
pnpm verify:production --wait
```

**A task may not be reported as live unless this exits 0.** Passing gates, a
created commit, a successful `next build`, a Preview deployment, or a returned
Vercel URL are none of them evidence that the production domain is serving your
work.

The script ([scripts/verify-production.mjs](../scripts/verify-production.mjs))
selects the deployment by **exact Git SHA** and proves this chain:

```
local HEAD == origin/main
  == meta.githubCommitSha of the chosen Production deployment
  == a deployment in state READY
  == the deployment the alias endpoint says the domain serves right now
  == the build whose asset hashes the domain actually returns
```

Any break exits non-zero. There is no flag that skips a link.

### Why not just check the newest deployment

An older commit can be redeployed at any time — from the dashboard, from a
rollback, from a promote. The result is a deployment on `main`, target
`production`, state `READY`, **newer** than the one you were waiting for, and
built from the _previous_ commit. Every attribute a naive wait-loop tests is
true of it. This has happened on this project.

Two traps the script encodes, both measured here:

- `vercel ls` and `vercel inspect` do **not** print Git SHAs, so any selection
  made from their output is selection by recency. The SHA lives in
  `meta.githubCommitSha` on `GET /v6/deployments`.
- A deployment's own `alias` array is **stale**. A superseded deployment kept
  `www.metatradee.com` with `aliasAssigned: true` after the domain had moved to
  a newer build. The authoritative answer is `GET /v4/aliases/{domain}` →
  `deploymentId`.

### Options and credentials

|                       |                                                           |
| --------------------- | --------------------------------------------------------- |
| `--wait`              | poll until the expected commit is live (use after a push) |
| `--timeout=<seconds>` | wait budget, default 900                                  |
| `--path=/pricing`     | page used for the build fingerprint, default `/`          |
| `--no-fetch`          | skip `git fetch origin main`                              |

Project and team come from `.vercel/project.json`, falling back to
`VERCEL_PROJECT_ID` / `VERCEL_ORG_ID` — `.vercel/` is gitignored, so CI needs
those. Credentials come from the Vercel CLI login or `VERCEL_TOKEN`; set
`VERCEL_AUTOMATION_BYPASS_SECRET` if Deployment Protection is enabled. No token
or response body is ever printed.

## Git workflow

- Branches: `feat/*`, `fix/*`, `chore/*`, `docs/*` (see Phase 9 Git standard).
- Commits: **Conventional Commits** (enforced by commitlint on `commit-msg`).
- Pre-commit runs `lint-staged` (ESLint + Prettier on staged files).
- Pre-push runs `typecheck`.

## Adding shadcn/ui components

```bash
pnpm dlx shadcn@latest add button
```

Components install into `src/components/ui/` and are owned in-repo (styled with our tokens).

## Troubleshooting

- **Env validation error on start:** a required `NEXT_PUBLIC_*` value is missing — check `.env.local` against `.env.example`.
- **Type errors after dependency change:** delete `.next` and re-run `pnpm typecheck`.
- **Husky hooks not running:** run `pnpm prepare` once.
