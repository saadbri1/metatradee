# Project Structure

Feature-driven architecture with strict layering (Phase 6 / Engineering Bible).

```
metatradee/
├── src/
│   ├── app/               # Next.js App Router: routes, layouts, route handlers
│   │   ├── layout.tsx     #   root layout: fonts, <Providers>, tokens
│   │   ├── page.tsx       #   foundation placeholder (replaced by features)
│   │   ├── not-found.tsx  #   404
│   │   └── globals.css    #   Tailwind entry + token import
│   ├── components/        # Shared design-system components (dumb, tokenized, a11y)
│   │   └── ui/            #   shadcn/ui primitives (owned in-repo)
│   ├── features/          # Feature modules (auth, journal, analytics, ...)
│   │                      #   each owns components/hooks/services/types/tests
│   ├── hooks/             # Cross-feature reusable hooks (state/effects only)
│   ├── lib/               # Framework glue & clients
│   │   ├── supabase/      #   browser / server / middleware clients
│   │   └── utils.ts       #   cn() and small pure helpers
│   ├── services/          # I/O layer behind interfaces (no vendor in features)
│   ├── providers/         # Client providers (theme, query) + composition
│   ├── contexts/          # React contexts (only when the tree needs it)
│   ├── store/             # Zustand — ephemeral UI state only
│   ├── types/             # Shared types (domain types ship with features)
│   ├── utils/             # Pure, framework-agnostic utilities
│   ├── config/            # env (zod-validated) + site config
│   ├── constants/         # App-wide constants, routes, query-key roots
│   ├── styles/            # Design tokens (CSS variables)
│   └── middleware.ts      # Supabase session refresh
├── tests/
│   ├── unit/              # Vitest unit tests
│   ├── e2e/               # Playwright end-to-end tests
│   └── setup.ts           # Testing Library setup
├── docs/                  # Engineering docs (this folder)
├── public/                # Static assets
├── .github/workflows/     # CI (lint/typecheck/test/build) + E2E
├── .husky/                # Git hooks (pre-commit, commit-msg, pre-push)
└── [config files]         # tsconfig, next.config, tailwind, eslint, prettier, ...
```

## Layering rules (strict)

1. **Design-system components** (`components/`) render only — never fetch data.
2. **Feature components** (`features/`) are data-aware and compose design-system components.
3. **Routes** (`app/`) arrange layouts + data boundaries; never contain raw styling.
4. **Services** own all I/O behind interfaces; features depend on abstractions, not vendors.
5. **Domain code never imports UI or vendor SDKs** (Clean Architecture — dependencies point inward).

## Import alias

`@/*` → `src/*` (configured in `tsconfig.json`).
