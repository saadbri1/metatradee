/**
 * Path → coarse page bucket. PURE.
 *
 * BUCKETS, NOT PATHS, ON PURPOSE — reporting wants "how do tool pages convert
 * versus product pages", which a per-URL breakdown answers badly and a bucket
 * answers directly.
 *
 * There is a privacy reason too. Authenticated paths in this product can carry
 * identifiers (`/journal/<id>`, `/playbook/<id>`), and a page-view parameter is
 * exactly the sort of place a raw path gets pasted without much thought. Nothing
 * here can emit one: the return type is a fixed union, and an unrecognised path
 * falls back to `product` rather than leaking what it was.
 */
import type { PageGroup } from './events';

/** Longest prefix wins, so `/tools/x` beats `/` without ordering games. */
const PREFIXES: readonly [string, PageGroup][] = [
  ['/tools', 'tool'],
  ['/pricing', 'pricing'],
  ['/support', 'support'],
  ['/contact', 'support'],
  ['/resources', 'resources'],
  ['/products', 'product'],
  ['/solutions', 'product'],
  ['/brokers', 'product'],
  ['/login', 'auth'],
  ['/register', 'auth'],
  ['/forgot-password', 'auth'],
  ['/reset-password', 'auth'],
  ['/verify-email', 'auth'],
];

export function pageGroupFor(pathname: string | null | undefined): PageGroup {
  if (!pathname) return 'product';
  if (pathname === '/') return 'home';

  let best: PageGroup = 'product';
  let bestLength = -1;
  for (const [prefix, group] of PREFIXES) {
    if ((pathname === prefix || pathname.startsWith(`${prefix}/`)) && prefix.length > bestLength) {
      best = group;
      bestLength = prefix.length;
    }
  }
  return best;
}
