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
