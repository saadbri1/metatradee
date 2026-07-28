/**
 * WCAG 2.2 AA contrast, enforced against the real token file.
 *
 * Contrast is measurable, so it should be a test rather than a review opinion.
 * This parses `src/styles/tokens.css` and checks every pair a user actually
 * reads. If someone retunes a colour, this fails before it ships.
 *
 * Thresholds: 4.5:1 for normal text (1.4.3), 3:1 for the boundary of a UI
 * component and for focus indicators (1.4.11). Decorative dividers are exempt
 * from 1.4.11, which is why `--border` is deliberately NOT asserted at 3:1
 * while `--input` — which bounds a form control — is.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CSS = readFileSync(resolve(__dirname, '../../../src/styles/tokens.css'), 'utf8');

/** Pull the custom properties declared in the block for a selector. */
function tokensFor(selector: string): Record<string, string> {
  const blocks = [...CSS.matchAll(/([^{}]+)\{([^}]*)\}/g)];
  const vars: Record<string, string> = {};
  for (const [, selectors, body] of blocks) {
    const list = (selectors ?? '').split(',').map((s) => s.trim());
    if (!list.includes(selector)) continue;
    for (const decl of (body ?? '').split(';')) {
      const m = decl.match(/--([\w-]+)\s*:\s*([^;]+)/);
      if (m) vars[m[1]!] = m[2]!.replace(/\/\*[\s\S]*?\*\//g, '').trim();
    }
  }
  return vars;
}

const LIGHT = tokensFor('.light');
const DARK = tokensFor('.dark');

function hslToRgb(value: string): [number, number, number] {
  const [h, s, l] = value.split(/\s+/).map((v) => parseFloat(v));
  if ([h, s, l].some((n) => Number.isNaN(n))) {
    throw new Error(`Not an HSL channel triplet: "${value}"`);
  }
  const S = s! / 100;
  const L = l! / 100;
  const k = (n: number) => (n + h! / 30) % 12;
  const a = S * Math.min(L, 1 - L);
  const f = (n: number) => L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255)) as [number, number, number];
}

function luminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(vars: Record<string, string>, fg: string, bg: string): number {
  const a = vars[fg];
  const b = vars[bg];
  // A missing token must FAIL, never silently pass.
  if (!a) throw new Error(`token --${fg} is not declared`);
  if (!b) throw new Error(`token --${bg} is not declared`);
  const la = luminance(hslToRgb(a));
  const lb = luminance(hslToRgb(b));
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Surfaces a piece of body text can sit on in each theme. */
const LIGHT_SURFACES = ['background', 'card', 'popover', 'muted', 'accent', 'secondary'];
const DARK_SURFACES = ['background', 'card', 'popover', 'muted', 'accent', 'secondary'];

describe('the token file is parsed, not assumed', () => {
  it('finds both theme scopes with real values', () => {
    expect(Object.keys(LIGHT).length).toBeGreaterThan(10);
    expect(Object.keys(DARK).length).toBeGreaterThan(10);
    expect(LIGHT.background).toBeTruthy();
    expect(DARK.background).toBeTruthy();
  });

  it('throws on a token that does not exist, rather than reporting a pass', () => {
    expect(() => contrast(LIGHT, 'does-not-exist', 'background')).toThrow(/not declared/);
  });
});

describe.each([
  ['light', LIGHT, LIGHT_SURFACES],
  ['dark', DARK, DARK_SURFACES],
] as const)('%s theme — text contrast (WCAG 1.4.3, 4.5:1)', (_name, vars, surfaces) => {
  it('body text is legible on every surface it can sit on', () => {
    for (const surface of surfaces) {
      expect(
        contrast(vars, 'foreground', surface),
        `foreground on ${surface}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('muted text is legible on every surface it can sit on', () => {
    for (const surface of surfaces) {
      expect(
        contrast(vars, 'muted-foreground', surface),
        `muted-foreground on ${surface}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('button labels are legible on their own fill', () => {
    expect(contrast(vars, 'destructive-foreground', 'destructive')).toBeGreaterThanOrEqual(4.5);
    expect(contrast(vars, 'secondary-foreground', 'secondary')).toBeGreaterThanOrEqual(4.5);
    expect(contrast(vars, 'accent-foreground', 'accent')).toBeGreaterThanOrEqual(4.5);
  });

  it('P&L figures are legible — they are read as numbers, not decoration', () => {
    for (const surface of ['background', 'card']) {
      expect(contrast(vars, 'profit', surface), `profit on ${surface}`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(vars, 'loss', surface), `loss on ${surface}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('warning and error text are legible', () => {
    for (const surface of ['background', 'card']) {
      expect(contrast(vars, 'warning', surface), `warning on ${surface}`).toBeGreaterThanOrEqual(
        4.5,
      );
      expect(
        contrast(vars, 'destructive', surface),
        `destructive on ${surface}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe.each([
  ['light', LIGHT],
  ['dark', DARK],
] as const)('%s theme — non-text contrast (WCAG 1.4.11, 3:1)', (_name, vars) => {
  it('a form field boundary is perceivable', () => {
    // --input bounds a control, so 1.4.11 applies. --border is a decorative
    // divider and is intentionally exempt, which is why it is not asserted.
    for (const surface of ['background', 'card', 'muted', 'accent']) {
      expect(contrast(vars, 'input', surface), `input border on ${surface}`).toBeGreaterThanOrEqual(
        3,
      );
    }
  });

  it('the focus indicator is perceivable', () => {
    for (const surface of ['background', 'card']) {
      expect(contrast(vars, 'ring', surface), `ring on ${surface}`).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('known gap, held visible rather than silently ignored', () => {
  it('records that the dark primary fill does not carry a white label at AA', () => {
    // #5B6CFF is the brand Iris and is deliberately left unchanged. White on it
    // measures ~3.89:1, below the 4.5:1 needed for a normal-size button label.
    // Fixing it means either changing the brand colour or switching the label to
    // near-black (~5.12:1) — a brand-presentation decision, not a code one.
    // This test documents the number; change it when that decision is made.
    const measured = contrast(DARK, 'primary-foreground', 'primary');
    expect(measured).toBeLessThan(4.5);
    expect(measured).toBeGreaterThan(3); // still clears 1.4.11 / large-text 3:1
  });
});
