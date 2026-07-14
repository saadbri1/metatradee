# MetaTradee

**AI Trading Journal & Performance Analytics SaaS.**
_Journal the past. Guard the present._

This repository contains the production foundation for MetaTradee. Product
features are built incrementally per the Phase 10 roadmap; this scaffold
contains **no product features** — only the engineering foundation.

## Stack

| Layer        | Technology                                           |
| ------------ | ---------------------------------------------------- |
| Framework    | Next.js 15 (App Router)                              |
| UI           | React 19 · TypeScript (strict)                       |
| Styling      | Tailwind CSS + design tokens (CSS variables)         |
| Components   | shadcn/ui (owned in-repo) · Lucide icons             |
| Server state | TanStack Query                                       |
| Client state | Zustand (ephemeral UI only)                          |
| Forms        | React Hook Form + Zod                                |
| Motion       | Framer Motion                                        |
| Backend/Auth | Supabase (SSR)                                       |
| Testing      | Vitest + Testing Library · Playwright                |
| Quality      | ESLint · Prettier · Husky · lint-staged · commitlint |

## Quick start

```bash
pnpm install          # install dependencies
cp .env.example .env.local   # then fill in Supabase values
pnpm dev              # http://localhost:3000
```

## Scripts

| Script                         | Purpose                       |
| ------------------------------ | ----------------------------- |
| `pnpm dev`                     | Start dev server              |
| `pnpm build`                   | Production build              |
| `pnpm start`                   | Run production build          |
| `pnpm lint`                    | ESLint                        |
| `pnpm typecheck`               | TypeScript, no emit           |
| `pnpm format` / `format:check` | Prettier                      |
| `pnpm test` / `test:watch`     | Unit tests (Vitest)           |
| `pnpm test:e2e`                | End-to-end tests (Playwright) |

## Documentation

- [`docs/PROJECT_STRUCTURE.md`](docs/PROJECT_STRUCTURE.md) — folder architecture
- [`docs/DEVELOPMENT_SETUP.md`](docs/DEVELOPMENT_SETUP.md) — local setup
- [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md) — environment variables

## Conventions

- **Design tokens only** — never hardcode colors/spacing/radius. `--profit` / `--loss` are reserved for P&L, never decoration.
- **Feature-driven** — features own their code; shared UI lives in `components/`.
- **State model** — server state → TanStack Query; URL state → the URL; ephemeral UI → Zustand.
- **Conventional Commits** enforced via commitlint.
