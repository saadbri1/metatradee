/**
 * OpenAPI surface (Phase 11.2) — the SOURCE OF TRUTH for `/api/v1`. Docs, SDK
 * types, and Swagger UI generate from this; a test asserts the implemented
 * routes match `API_ROUTES` so the spec never drifts. Minimal, deliberate
 * surface — additive-only within v1.
 *
 * Each entry declares the scope it requires. Personal-data endpoints use
 * `:self` scopes that no delegated/workspace token can hold; psychology
 * additionally requires the owner's opt-in (see api/auth.ts).
 */

export interface ApiRoute {
  method: 'GET' | 'POST';
  path: string; // under /api/v1
  scope: string;
  summary: string;
  sensitive?: boolean;
}

/** The v1 surface. Keep in lockstep with the app/api/v1 route files. */
export const API_ROUTES: readonly ApiRoute[] = [
  {
    method: 'GET',
    path: '/trades',
    scope: 'trades:read:self',
    summary: 'List your trades (cursor-paginated).',
  },
  {
    method: 'GET',
    path: '/analytics',
    scope: 'analytics:read:self',
    summary: 'Analytics summary (engine outputs; reconciles with the app).',
  },
  { method: 'GET', path: '/reports', scope: 'reports:read:self', summary: 'List your reports.' },
  {
    method: 'GET',
    path: '/playbooks',
    scope: 'strategies:view',
    summary: 'List workspace-shared strategies you can access.',
  },
  {
    method: 'GET',
    path: '/workspace',
    scope: 'members:view',
    summary: 'Workspace + your membership.',
  },
  {
    method: 'GET',
    path: '/billing',
    scope: 'billing:view',
    summary: 'Read-only subscription/entitlement state.',
  },
  {
    method: 'GET',
    path: '/psychology',
    scope: 'psychology:read:self',
    summary: 'Your psychology entries — requires the dedicated scope AND your opt-in.',
    sensitive: true,
  },
] as const;

/** Personal (self) scope vocabulary + workspace grant scopes (from 11.0/11.1). */
export const SCOPE_VOCABULARY = {
  self: ['trades:read:self', 'analytics:read:self', 'reports:read:self', 'psychology:read:self'],
  note: 'Workspace scopes are the 11.0 permission grants (e.g. strategies:view). A token’s effective scopes are always intersected with the owner’s CURRENT authority.',
} as const;

export function buildOpenApiSpec() {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const r of API_ROUTES) {
    paths[`/api/v1${r.path}`] ??= {};
    paths[`/api/v1${r.path}`]![r.method.toLowerCase()] = {
      summary: r.summary,
      security: [{ bearerAuth: [r.scope] }],
      'x-scope': r.scope,
      'x-sensitive': r.sensitive ?? false,
    };
  }
  return {
    openapi: '3.1.0',
    info: { title: 'MetaTradee API', version: '1.0.0' },
    servers: [{ url: 'https://metatradee.vercel.app' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'mtt_ token' },
      },
    },
    paths,
  };
}
