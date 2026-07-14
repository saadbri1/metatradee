'use client';

/**
 * Provider-agnostic social sign-in SEAM. Renders a button per ENABLED OAuth
 * provider from the registry. Nothing is enabled this phase, so this returns
 * null — but the abstraction (and the divider) already exist, so wiring Google/
 * GitHub/Apple/Microsoft later is config + a handler, not a UI refactor.
 */
import { OAUTH_PROVIDERS } from '../config';
import type { OAuthProviderConfig } from '../types';

function startOAuth(_provider: OAuthProviderConfig['id']): void {
  // TODO(oauth): call a provider-agnostic sign-in action, e.g.
  //   signInWithProviderAction(provider) -> supabase.auth.signInWithOAuth(...)
  // Intentionally unimplemented this phase.
}

export function SocialAuth() {
  const enabled = OAUTH_PROVIDERS.filter((p) => p.enabled);
  if (enabled.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="relative">
        <div className="absolute inset-0 flex items-center" aria-hidden>
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
        </div>
      </div>
      <div className="grid gap-2">
        {enabled.map((provider) => (
          <button
            key={provider.id}
            type="button"
            onClick={() => startOAuth(provider.id)}
            className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            Continue with {provider.label}
          </button>
        ))}
      </div>
    </div>
  );
}
