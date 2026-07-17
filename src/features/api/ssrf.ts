/**
 * SSRF egress guard (Phase 11.2) — the critical new risk class for OUTBOUND
 * webhooks to user-supplied URLs. Pure + exhaustively tested.
 *
 * Policy (fail closed): HTTPS only; reject any URL whose host is a private,
 * loopback, link-local, or cloud-metadata address — checked both as a literal
 * IP in the URL AND, at delivery time, against every address DNS resolves to
 * (guarding DNS-rebinding). Redirects must be re-checked with this same guard;
 * a redirect to a blocked target is refused. No raw-IP allowlist bypass.
 */

/** CIDR-free range checks on a parsed IPv4/IPv6 address. */
export function isBlockedIp(ip: string): boolean {
  const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if ([a, Number(v4[3]), Number(v4[4])].some((n) => n > 255) || a > 255) return true; // malformed → block
    if (a === 0) return true; // 0.0.0.0/8 "this network"
    if (a === 127) return true; // loopback 127/8
    if (a === 10) return true; // private 10/8
    if (a === 172 && b >= 16 && b <= 31) return true; // private 172.16/12
    if (a === 192 && b === 168) return true; // private 192.168/16
    if (a === 169 && b === 254) return true; // link-local incl. 169.254.169.254 metadata
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
    if (a >= 224) return true; // multicast/reserved 224+/
    return false;
  }
  const addr = ip.toLowerCase().replace(/^\[|\]$/g, '');
  if (addr === '::1' || addr === '::' || addr === '::ffff:127.0.0.1') return true; // loopback
  if (addr.startsWith('fe80')) return true; // link-local
  if (addr.startsWith('fc') || addr.startsWith('fd')) return true; // unique-local fc00::/7
  if (addr.startsWith('fec0')) return true; // deprecated site-local
  if (addr.startsWith('::ffff:')) {
    // IPv4-mapped IPv6 → re-check the embedded v4.
    const mapped = addr.slice('::ffff:'.length);
    if (/^\d+\.\d+\.\d+\.\d+$/.test(mapped)) return isBlockedIp(mapped);
  }
  return false;
}

/** Hostnames that never leave the machine, independent of DNS. */
export function isBlockedHostname(host: string): boolean {
  const h = host.trim().toLowerCase().replace(/\.$/, '');
  if (h === 'localhost' || h.endsWith('.localhost')) return true;
  if (h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (h === 'metadata.google.internal') return true; // GCP metadata
  return false;
}

export interface UrlVerdict {
  ok: boolean;
  reason?: 'not_https' | 'invalid_url' | 'blocked_host' | 'blocked_ip';
}

/**
 * Validate a user-supplied webhook URL BEFORE any request. This is the
 * pre-DNS gate; `assertResolvedIpsAllowed` is the post-DNS gate the delivery
 * worker must also call on every resolved address (and after any redirect).
 */
export function validateWebhookUrl(raw: string): UrlVerdict {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: 'invalid_url' };
  }
  if (url.protocol !== 'https:') return { ok: false, reason: 'not_https' };
  const host = url.hostname;
  if (isBlockedHostname(host)) return { ok: false, reason: 'blocked_host' };
  // If the host is a literal IP, block private/metadata ranges up front.
  if (/^[\d.]+$/.test(host) || host.includes(':')) {
    if (isBlockedIp(host)) return { ok: false, reason: 'blocked_ip' };
  }
  return { ok: true };
}

/** Post-DNS / post-redirect gate: EVERY resolved address must be public. */
export function assertResolvedIpsAllowed(ips: readonly string[]): UrlVerdict {
  if (ips.length === 0) return { ok: false, reason: 'blocked_ip' }; // no address → refuse
  for (const ip of ips) if (isBlockedIp(ip)) return { ok: false, reason: 'blocked_ip' };
  return { ok: true };
}
