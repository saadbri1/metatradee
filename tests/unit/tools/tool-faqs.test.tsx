/**
 * Tool-page FAQs: the visible list and the `FAQPage` markup.
 *
 * THE ONE INVARIANT. Google's structured-data policy requires that FAQ markup
 * describe content the reader can see on the page. `ToolLayout` renders the
 * list and builds the JSON-LD from the SAME array, so the two cannot diverge —
 * these tests pin that, and pin that a page with no FAQs emits no FAQPage at
 * all rather than an empty one.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

/*
 * `ToolLayout` renders inside `PublicShell`, whose header calls `usePathname`.
 * Outside a Next router that returns null and the header throws, so the whole
 * shell is stubbed down to the one hook it needs.
 */
vi.mock('next/navigation', () => ({
  usePathname: () => '/tools/position-size-calculator',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { ToolLayout } from '@/features/tools/components/tool-layout';

const FAQS = [
  { q: 'What is the first question?', a: 'The first answer.' },
  { q: 'What is the second question?', a: 'The second answer.' },
] as const;

function renderTool(faqs?: readonly { q: string; a: string }[]) {
  return render(
    <ToolLayout
      path="/tools/position-size-calculator"
      eyebrow="Free tool"
      title="Position size calculator"
      lede="A lede."
      calculator={<div>calculator</div>}
      calculatorId="position_size"
      faqs={faqs}
      related={[]}
    >
      <p>Explanatory copy.</p>
    </ToolLayout>,
  );
}

/** Every JSON-LD block on the page, parsed. */
function jsonLdNodes(container: HTMLElement): Record<string, unknown>[] {
  const scripts = Array.from(container.querySelectorAll('script[type="application/ld+json"]'));
  return scripts.flatMap((s) => {
    const parsed = JSON.parse((s.textContent ?? '').replace(/\\u003c/g, '<'));
    return Array.isArray(parsed) ? parsed : [parsed];
  });
}

describe('a tool page with FAQs', () => {
  it('renders every question and answer as text on the page', () => {
    renderTool(FAQS);
    for (const faq of FAQS) {
      expect(screen.getByText(faq.q)).toBeInTheDocument();
      expect(screen.getByText(faq.a)).toBeInTheDocument();
    }
  });

  it('emits FAQPage markup containing exactly the rendered questions', () => {
    const { container } = renderTool(FAQS);
    const faqNode = jsonLdNodes(container).find((n) => n['@type'] === 'FAQPage');
    expect(faqNode, 'no FAQPage emitted').toBeDefined();

    const questions = (faqNode!.mainEntity as { name: string; acceptedAnswer: { text: string } }[])
      .map((q) => q.name)
      .sort();
    expect(questions).toEqual(FAQS.map((f) => f.q).sort());

    // And every answer in the markup is on the page.
    for (const entry of faqNode!.mainEntity as { acceptedAnswer: { text: string } }[]) {
      expect(screen.getByText(entry.acceptedAnswer.text)).toBeInTheDocument();
    }
  });

  it('keeps the WebApplication node alongside the FAQPage', () => {
    const { container } = renderTool(FAQS);
    const types = jsonLdNodes(container).map((n) => n['@type']);
    expect(types).toContain('WebApplication');
    expect(types).toContain('FAQPage');
  });

  it('uses a definition list, so the answers need no JavaScript to read', () => {
    // An accordion would hide the text behind a click; a <dl> cannot.
    const { container } = renderTool(FAQS);
    expect(container.querySelectorAll('dl')).toHaveLength(1);
    expect(container.querySelectorAll('dt')).toHaveLength(FAQS.length);
    expect(container.querySelectorAll('dd')).toHaveLength(FAQS.length);
  });
});

describe('a tool page without FAQs', () => {
  it('emits no FAQPage node at all', () => {
    const { container } = renderTool(undefined);
    expect(jsonLdNodes(container).some((n) => n['@type'] === 'FAQPage')).toBe(false);
  });

  it('still emits the WebApplication node', () => {
    const { container } = renderTool(undefined);
    expect(jsonLdNodes(container).some((n) => n['@type'] === 'WebApplication')).toBe(true);
  });

  it('renders no empty FAQ heading', () => {
    renderTool(undefined);
    expect(screen.queryByText('Frequently asked questions')).not.toBeInTheDocument();
  });
});

describe('the shipped tool pages', () => {
  it('keeps exactly one H1, with the FAQ block as an H2 beneath it', () => {
    const { container } = renderTool(FAQS);
    expect(container.querySelectorAll('h1')).toHaveLength(1);
    const h2s = Array.from(container.querySelectorAll('h2')).map((h) => h.textContent);
    expect(h2s).toContain('Frequently asked questions');
  });
});
