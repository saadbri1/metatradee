/**
 * `server-only` throws on import outside a Server Component. That guard is
 * correct in the app and must stay, but in Vitest the whole module graph is
 * resolved directly — so importing a client component that reaches a
 * `'use server'` action would fail on an architecture Next.js handles fine.
 *
 * This stub is TEST-ONLY. The real protection is unchanged in the build, and
 * tests/unit/billing/paypal-secrets.test.ts still asserts that the server
 * modules carry `import 'server-only'` and that no client component imports
 * them directly.
 */
export {};
