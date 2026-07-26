import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BrandMark, BrandLockup } from '@/features/marketing/components/brand-mark';

const MARKETING = resolve(__dirname, '../../../src/features/marketing');
const APP = resolve(__dirname, '../../../src/app');

/**
 * These tests LOCK the official MetaTradee identity ("The Tier"). The geometry
 * and colour sources below are fixed by the identity spec — if a future change
 * redraws the mark, invents a descriptor, or reintroduces a brand gradient,
 * these fail.
 */
describe('The Tier — official mark geometry', () => {
  it('draws exactly two planes on a 32-unit grid', () => {
    const { container } = render(<BrandMark />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('viewBox')).toBe('0 0 32 32');
    expect(svg.querySelectorAll('rect')).toHaveLength(2);
  });

  it('places the meta-plane at the specified coordinates', () => {
    const { container } = render(<BrandMark />);
    const meta = container.querySelectorAll('rect')[0]!;
    expect({
      x: meta.getAttribute('x'),
      y: meta.getAttribute('y'),
      width: meta.getAttribute('width'),
      height: meta.getAttribute('height'),
      rx: meta.getAttribute('rx'),
    }).toEqual({ x: '8.5', y: '8', width: '20', height: '6.5', rx: '2.2' });
  });

  it('places the base plane at the specified coordinates', () => {
    const { container } = render(<BrandMark />);
    const base = container.querySelectorAll('rect')[1]!;
    expect({
      x: base.getAttribute('x'),
      y: base.getAttribute('y'),
      width: base.getAttribute('width'),
      height: base.getAttribute('height'),
      rx: base.getAttribute('rx'),
    }).toEqual({ x: '3.5', y: '17.5', width: '20', height: '6.5', rx: '2.2' });
  });

  it('preserves the locked 1:4 overshoot and the +5,+5 shift', () => {
    const { container } = render(<BrandMark />);
    const [meta, base] = [...container.querySelectorAll('rect')];
    const mx = Number(meta!.getAttribute('x'));
    const my = Number(meta!.getAttribute('y'));
    const bx = Number(base!.getAttribute('x'));
    const by = Number(base!.getAttribute('y'));
    const width = Number(meta!.getAttribute('width'));

    expect(mx - bx).toBe(5);
    expect(by - my).toBe(9.5);
    // The meta-plane overshoots the base's right edge by a quarter of its width.
    expect(mx + width - (bx + width)).toBe(width / 4);
  });

  it('takes its colours from brand tokens, so light and dark resolve per spec', () => {
    const { container } = render(<BrandMark />);
    const [meta, base] = [...container.querySelectorAll('rect')];
    // light #3D4FE0 / dark #5B6CFF
    expect(meta!.getAttribute('fill')).toBe('hsl(var(--primary))');
    // light #0E1016 / dark #F3F5F9
    expect(base!.getAttribute('fill')).toBe('hsl(var(--foreground))');
  });

  it('contains no gradient, tile, arrow or chart geometry', () => {
    const { container } = render(<BrandMark />);
    const svg = container.querySelector('svg')!;
    expect(svg.querySelector('linearGradient')).toBeNull();
    expect(svg.querySelector('defs')).toBeNull();
    expect(svg.querySelector('path')).toBeNull();
    expect(svg.querySelector('polygon')).toBeNull();
    // A background tile would be a third rect; there are exactly two planes.
    expect(svg.querySelectorAll('rect')).toHaveLength(2);
  });

  it('scales from one size prop, down to the 16px minimum', () => {
    for (const size of [16, 24, 32, 44]) {
      const { container, unmount } = render(<BrandMark size={size} />);
      const svg = container.querySelector('svg')!;
      expect(svg.getAttribute('width')).toBe(String(size));
      expect(svg.getAttribute('height')).toBe(String(size));
      // Geometry never changes with size — only the render box does.
      expect(svg.getAttribute('viewBox')).toBe('0 0 32 32');
      unmount();
    }
  });
});

describe('official wordmark lockup', () => {
  it('is the mark plus "MetaTradee" and nothing else', () => {
    render(<BrandLockup />);
    expect(screen.getByText('MetaTradee')).toBeInTheDocument();
    expect(screen.queryByText(/trading journal/i)).toBeNull();
    expect(screen.queryByText(/journal the past/i)).toBeNull();
  });

  it('uses the approved display font at weight 600 with tight tracking', () => {
    render(<BrandLockup />);
    const word = screen.getByText('MetaTradee');
    expect(word.className).toContain('font-display');
    expect(word.className).toContain('font-semibold');
    expect(word.className).toContain('tracking-[-0.03em]');
    expect(word.className).toContain('text-foreground');
  });

  it('keeps the spec proportions between mark and wordmark', () => {
    const { container } = render(<BrandLockup size={42} />);
    // Spec lockup: 42px mark, 27px wordmark, 16px gap.
    expect(screen.getByText('MetaTradee').style.fontSize).toBe('27.006px');
    expect((container.firstElementChild as HTMLElement).style.gap).toBe('16.002px');
  });
});

describe('no invented identity survives anywhere', () => {
  const files = [
    'components/brand-mark.tsx',
    'components/marketing-header.tsx',
    'components/mobile-nav-drawer.tsx',
    'components/footer.tsx',
  ].map((f) => readFileSync(resolve(MARKETING, f), 'utf8'));

  const pages = ['products', 'solutions', 'brokers', 'pricing', 'resources'].map((p) =>
    readFileSync(resolve(APP, p, 'page.tsx'), 'utf8'),
  );

  it('has no "TRADING JOURNAL" descriptor on any public surface', () => {
    for (const source of [...files, ...pages]) {
      expect(source).not.toMatch(/Trading Journal<|>Trading Journal|TRADING JOURNAL/);
    }
  });

  it('uses no brand-colour gradient on any call to action', () => {
    for (const source of [...files, ...pages]) {
      expect(source).not.toMatch(/from-primary\s+to-iris/);
      expect(source).not.toMatch(/from-iris/);
    }
  });

  it('never uses the reserved P&L colours as marketing decoration', () => {
    // `text-profit` is allowed only where it labels real trading semantics.
    for (const source of files) {
      expect(source).not.toMatch(/bg-profit\b(?!\/)/);
      expect(source).not.toMatch(/text-loss/);
    }
  });

  it('renders the same lockup component on every public surface', () => {
    const consumers = [
      resolve(MARKETING, 'components/marketing-header.tsx'),
      resolve(MARKETING, 'components/mobile-nav-drawer.tsx'),
      resolve(MARKETING, 'components/footer.tsx'),
      resolve(APP, '(auth)/layout.tsx'),
    ];
    for (const file of consumers) {
      expect(readFileSync(file, 'utf8')).toMatch(/<BrandLockup/);
    }
  });
});
