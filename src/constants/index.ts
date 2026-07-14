/** App-wide constants. No magic values scattered in features. */

export const APP_ROUTES = {
  home: '/',
  login: '/login',
  signup: '/signup',
  today: '/today',
} as const;

export const QUERY_KEYS = {
  // Query-key factory root; features extend this namespace.
  session: ['session'] as const,
} as const;
