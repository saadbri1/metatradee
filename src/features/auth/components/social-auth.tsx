'use client';

/**
 * Social sign-in. Today that means Google; the registry keeps the shape for
 * the rest.
 *
 * IT STARTS THE FLOW FROM THE BROWSER, on purpose. `signInWithOAuth` needs to
 * put the PKCE verifier somewhere the CALLBACK can read it back, and the
 * `@supabase/ssr` browser client writes it to a cookie that the server callback
 * then uses to exchange the code. Starting the flow in a server action would
 * strand the verifier and every exchange would fail.
 *
 * NO TOKEN IS EVER HANDLED HERE. The browser is sent to Google, Google returns
 * a one-time code to `/auth/callback`, and the server exchanges it for a
 * session cookie. This component never sees an access token, an id token or a
 * refresh token, and stores none of them.
 *
 * THE REDIRECT TARGET IS SANITISED BEFORE IT LEAVES. `next` is attacker-
 * reachable (it comes from a query string), so it is passed through the same
 * `sanitizeRedirect` the server uses. Belt and braces: the callback sanitises
 * it again on the way back, because anything that travelled through a third
 * party is untrusted on return.
 */
import { useState } from 'react';
import type { Provider } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { sanitizeRedirect } from '../lib/redirect';
import { AUTH_ROUTES, DEFAULT_AUTHED_REDIRECT, OAUTH_PROVIDERS } from '../config';
import type { OAuthProviderConfig } from '../types';
import { FormAlert } from './form-alert';

/**
 * Google's mark, drawn rather than fetched.
 *
 * A remote image would be a third-party request on an auth page and would break
 * behind a strict CSP. The four brand colours are inline because they are the
 * brand's, not the theme's — recolouring them with design tokens would make it
 * not the Google mark. `aria-hidden` because the button already says "Continue
 * with Google"; announcing the logo too would repeat it.
 */
function GoogleMark() {
  return (
    <svg className="size-4 shrink-0" viewBox="0 0 18 18" aria-hidden focusable="false">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

/**
 * Our registry id -> Supabase's provider name.
 *
 * They are not the same vocabulary: Supabase calls Microsoft `azure`. Mapping
 * explicitly beats casting, because a cast would compile and then fail at the
 * provider with an error nobody could trace back to a spelling.
 */
const SUPABASE_PROVIDER: Record<OAuthProviderConfig['id'], Provider> = {
  google: 'google',
  github: 'github',
  apple: 'apple',
  microsoft: 'azure',
};

export function SocialAuth({ next }: { next?: string }) {
  const enabled = OAUTH_PROVIDERS.filter((p) => p.enabled);
  const [pending, setPending] = useState<OAuthProviderConfig['id'] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Nothing configured: render nothing at all, including the divider.
  if (enabled.length === 0) return null;

  async function startOAuth(provider: OAuthProviderConfig['id']) {
    // Guard against a double press: the second one would abandon the first
    // flow's PKCE verifier and the callback would then fail to exchange.
    if (pending) return;
    setPending(provider);
    setError(null);

    try {
      const supabase = createClient();
      const safeNext = sanitizeRedirect(next, DEFAULT_AUTHED_REDIRECT);
      const callback = new URL(AUTH_ROUTES.callback, window.location.origin);
      callback.searchParams.set('next', safeNext);

      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: SUPABASE_PROVIDER[provider],
        options: { redirectTo: callback.toString() },
      });

      if (oauthError) {
        // The provider's own message is not shown: it is third-party text and
        // can echo the address that was attempted.
        setError('We could not start Google sign-in. Please try again.');
        setPending(null);
      }
      // On success the browser navigates away; leaving `pending` set keeps the
      // button disabled for the moment before the page unloads.
    } catch {
      setError('We could not reach Google. Check your connection and try again.');
      setPending(null);
    }
  }

  return (
    <div className="space-y-4">
      {error ? <FormAlert tone="error">{error}</FormAlert> : null}

      <div className="grid gap-2">
        {enabled.map((provider) => (
          <button
            key={provider.id}
            type="button"
            onClick={() => void startOAuth(provider.id)}
            disabled={pending !== null}
            aria-busy={pending === provider.id}
            className="inline-flex h-10 w-full items-center justify-center gap-2.5 rounded-md border border-input bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-60 motion-reduce:transition-none"
          >
            <GoogleMark />
            {pending === provider.id
              ? `Connecting to ${provider.label}…`
              : `Continue with ${provider.label}`}
          </button>
        ))}
      </div>

      {/*
       * The divider is decorative: `aria-hidden` on the rule, and the word is
       * inside the same hidden container, so a screen reader hears two
       * sign-in options rather than a stray "or".
       */}
      <div className="relative" aria-hidden>
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase tracking-wider">
          <span className="bg-card px-2 text-muted-foreground">or</span>
        </div>
      </div>
    </div>
  );
}
