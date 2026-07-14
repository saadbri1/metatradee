/** @type {import('next').NextConfig} */

/**
 * Production-grade HTTP security headers, applied to every route.
 *
 * The Content-Security-Policy ships as **Report-Only** first: it never blocks a
 * request, it only reports violations, so we can observe real traffic and tune
 * the policy before switching to an enforcing `Content-Security-Policy` header.
 * `'unsafe-inline'`/`'unsafe-eval'` are required by Next.js' runtime today; they
 * are tolerable under Report-Only and are the first thing to tighten (via nonces)
 * once a violation baseline exists.
 */
const cspReportOnly = [
  "default-src 'self'",
  "base-uri 'self'",
  "font-src 'self' data:",
  "img-src 'self' data: blob: https:",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self' https:",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "object-src 'none'",
  'upgrade-insecure-requests',
].join('; ');

const securityHeaders = [
  // Report CSP violations without blocking; promote to enforcing later.
  { key: 'Content-Security-Policy-Report-Only', value: cspReportOnly },
  // Force HTTPS for two years, including subdomains; eligible for preload.
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  // Send only the origin cross-site; full path same-origin.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Deny powerful features by default; features opt in explicitly later.
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
  },
  // Block MIME-type sniffing.
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Clickjacking protection (legacy header + CSP frame-ancestors above).
  { key: 'X-Frame-Options', value: 'DENY' },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [],
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
