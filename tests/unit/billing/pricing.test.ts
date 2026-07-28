import { describe, it, expect } from 'vitest';
import {
  amountFor,
  annualSavingPercent,
  formatPrice,
  isFree,
  monthlyEquivalent,
  monthsFree,
  priceFor,
  ANNUAL_LABEL,
  RECOMMENDED_TIER,
  TIER_ORDER,
  TIER_TAGLINE,
} from '@/features/billing/pricing';
import { PLANS, type PlanTier } from '@/features/billing/plans';

/**
 * Prices are configuration, not content. These lock the agreed numbers and — more
 * importantly — prove the advertised discount is DERIVED from them, so the badge
 * can never claim a saving the prices do not actually give.
 */
describe('agreed public prices', () => {
  it.each([
    ['free', 0, 0],
    ['trader', 1900, 19000],
    ['pro', 3900, 39000],
    ['funded', 5900, 59000],
  ] as [PlanTier, number, number][])('%s is priced as agreed', (tier, monthly, annual) => {
    expect(priceFor(tier)).toEqual({ monthly, annual, currency: 'usd' });
  });

  it('renders whole-dollar prices without stray decimals', () => {
    expect(formatPrice(1900)).toBe('$19');
    expect(formatPrice(39000)).toBe('$390');
    expect(formatPrice(1583)).toBe('$15.83');
  });

  it('charges the right amount for the chosen interval', () => {
    expect(amountFor('pro', 'monthly')).toBe(3900);
    expect(amountFor('pro', 'annual')).toBe(39000);
  });

  it('identifies the free tier as free', () => {
    expect(isFree('free')).toBe(true);
    expect(isFree('trader')).toBe(false);
  });
});

describe('the annual discount is computed, never asserted', () => {
  it.each(['trader', 'pro', 'funded'] as PlanTier[])('%s really saves 17%%', (tier) => {
    expect(annualSavingPercent(tier)).toBe(17);
  });

  it.each(['trader', 'pro', 'funded'] as PlanTier[])('%s really gives 2 months free', (tier) => {
    expect(monthsFree(tier)).toBe(2);
  });

  it('the advertised label matches what the numbers actually do', () => {
    // If prices change so the saving is no longer 17% / 2 months, this fails —
    // which is the point: the copy cannot silently become untrue.
    const percent = annualSavingPercent('pro');
    const free = monthsFree('pro');
    expect(ANNUAL_LABEL).toContain(`${percent}%`);
    expect(ANNUAL_LABEL).toContain(`${free} months free`);
  });

  it('states an honest monthly equivalent for annual billing', () => {
    // $390/yr = $32.50/mo, which is genuinely less than the $39 monthly price.
    expect(monthlyEquivalent('pro')).toBe(3250);
    expect(monthlyEquivalent('pro')).toBeLessThan(priceFor('pro').monthly);
  });

  it('never claims a saving on the free tier', () => {
    expect(annualSavingPercent('free')).toBe(0);
    expect(monthsFree('free')).toBe(0);
  });
});

describe('display configuration', () => {
  it('orders tiers cheapest first and covers every plan exactly once', () => {
    expect([...TIER_ORDER]).toEqual(['free', 'trader', 'pro', 'funded']);
    expect(new Set(TIER_ORDER).size).toBe(Object.keys(PLANS).length);
    const amounts = TIER_ORDER.map((t) => priceFor(t).monthly);
    expect([...amounts].sort((a, b) => a - b)).toEqual(amounts);
  });

  it('recommends a real, paid plan', () => {
    expect(PLANS[RECOMMENDED_TIER]).toBeTruthy();
    expect(isFree(RECOMMENDED_TIER)).toBe(false);
  });

  it('gives every tier a tagline that promises no financial outcome', () => {
    for (const tier of TIER_ORDER) {
      const line = TIER_TAGLINE[tier];
      expect(line?.length ?? 0).toBeGreaterThan(10);
      expect(line).not.toMatch(/profit|guarantee|returns|win more|make money/i);
    }
  });
});

describe('no surface hardcodes a price', () => {
  it('exposes prices only through the central config', async () => {
    const { readFileSync, readdirSync, statSync } = await import('node:fs');
    const { join, resolve } = await import('node:path');

    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          walk(full);
        } else if (/\.tsx?$/.test(entry) && !full.includes('billing/pricing.ts')) {
          const source = readFileSync(full, 'utf8');
          // A literal price string in a component would drift from config.
          if (/\$(19|39|59|190|390|590)\b/.test(source)) offenders.push(full);
        }
      }
    };
    walk(resolve(__dirname, '../../../src'));
    expect(offenders).toEqual([]);
  });
});
