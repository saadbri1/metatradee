/** Static site metadata. No secrets. */
export const siteConfig = {
  name: 'MetaTradee',
  /**
   * THE one-sentence definition of the product, and the most widely copied
   * string in the codebase. It is the meta description on every page that does
   * not override it, the `og:` and `twitter:` description, the homepage hero
   * paragraph, AND the `description` of both the `Organization` and
   * `SoftwareApplication` JSON-LD. Structured data is what answer engines and
   * AI search quote back verbatim, so anything false here is repeated as fact
   * by systems we do not control and cannot correct.
   *
   * IT USED TO CLAIM SOMETHING THE PRODUCT DOES NOT DO. The previous wording —
   * "coaches you before the mistake, protects your funded accounts in real
   * time" — described `propFirmTools`, which `plans.ts` marks NOT IMPLEMENTED
   * with the explicit rule that "no surface may sell it", and implied a live
   * broker connection that `/brokers` correctly states does not exist ("Live
   * API synchronisation is designed for but not built"). The site's own facts
   * pages contradicted its own structured data.
   *
   * So this sentence is now restricted to what ships today: file-based import,
   * and server-side computation of the derived figures. Capability claims here
   * must be checkable against `ADAPTERS` and `PLANS`, never aspirational.
   *
   * SAY "PLANNED REWARD-TO-RISK", NEVER "R". The engine computes gross P&L, net
   * P&L and the PLANNED reward-to-risk ratio; a realised R-multiple is a
   * different figure and is not computed at all. `/trading-journal` spells that
   * distinction out, and a bare "R" here would quietly contradict it.
   */
  description:
    'A trading journal and performance-analytics app. Import MT4, MT5 and cTrader statements as CSV or JSON, and get P&L and planned reward-to-risk computed server-side.',
  tagline: 'Journal the past. Guard the present.',
  url: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
} as const;

export type SiteConfig = typeof siteConfig;
