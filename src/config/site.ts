/** Static site metadata. No secrets. */
export const siteConfig = {
  name: 'MetaTradee',
  description:
    'The AI trading journal that coaches you before the mistake, protects your funded accounts in real time, and proves your edge with verified data.',
  tagline: 'Journal the past. Guard the present.',
  url: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
} as const;

export type SiteConfig = typeof siteConfig;
