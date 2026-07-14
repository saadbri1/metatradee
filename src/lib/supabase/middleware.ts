import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/config/env';
import {
  AUTH_ROUTES,
  AUTH_PAGES,
  PROTECTED_PREFIXES,
  DEFAULT_AUTHED_REDIRECT,
  NEXT_PARAM,
} from '@/features/auth/config';
import { sanitizeRedirect } from '@/features/auth/lib/redirect';

type CookieToSet = { name: string; value: string; options: CookieOptions };

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Carry any refreshed auth cookies from `source` onto a redirect response. */
function withCookies(redirect: NextResponse, source: NextResponse): NextResponse {
  source.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

/**
 * Refreshes the Supabase session on every request AND enforces route protection:
 *   - unauthenticated + protected path → redirect to login (with sanitized ?next)
 *   - authenticated + public auth page → redirect to the app
 * Runs on the Edge; only imports pure/edge-safe helpers.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Touch the user to trigger token refresh when needed (also our auth check).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  // Guard: unauthenticated access to a protected path.
  if (!user && isProtected(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = AUTH_ROUTES.login;
    const next = sanitizeRedirect(`${pathname}${search}`, DEFAULT_AUTHED_REDIRECT);
    url.search = `${NEXT_PARAM}=${encodeURIComponent(next)}`;
    return withCookies(NextResponse.redirect(url), response);
  }

  // Guard: authenticated user on a public auth page → send to the app.
  if (user && AUTH_PAGES.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = DEFAULT_AUTHED_REDIRECT;
    url.search = '';
    return withCookies(NextResponse.redirect(url), response);
  }

  return response;
}
