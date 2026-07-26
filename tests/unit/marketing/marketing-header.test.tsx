import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ pathname: '/' }));

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
  } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

beforeAll(() => {
  // jsdom has no PointerEvent; the header closes menus on pointerdown.
  if (!('PointerEvent' in window)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).PointerEvent = MouseEvent;
  }
});

import { MarketingHeader } from '@/features/marketing/components/marketing-header';
import { PRODUCT_ITEMS, SOLUTION_ITEMS, RESOURCE_ITEMS } from '@/features/marketing/navigation';

beforeEach(() => {
  mocks.pathname = '/';
  vi.clearAllMocks();
});

function primaryNav() {
  return screen.getByRole('navigation', { name: 'Primary' });
}

describe('header structure', () => {
  it('renders brand, the five primary entries, Log in and Get Started', () => {
    render(<MarketingHeader />);

    expect(screen.getByRole('link', { name: /MetaTradee home/i })).toHaveAttribute('href', '/');

    const nav = primaryNav();
    expect(within(nav).getByRole('button', { name: /Products/ })).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: /Solutions/ })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Supported Brokers' })).toHaveAttribute(
      'href',
      '/brokers',
    );
    expect(within(nav).getByRole('link', { name: 'Pricing' })).toHaveAttribute('href', '/pricing');
    expect(within(nav).getByRole('button', { name: /Resources/ })).toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Get Started' })).toHaveAttribute('href', '/register');
  });

  it('marks the active route with aria-current', () => {
    mocks.pathname = '/pricing';
    render(<MarketingHeader />);
    expect(within(primaryNav()).getByRole('link', { name: 'Pricing' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('does not mark an inactive route as current', () => {
    mocks.pathname = '/pricing';
    render(<MarketingHeader />);
    expect(
      within(primaryNav()).getByRole('link', { name: 'Supported Brokers' }),
    ).not.toHaveAttribute('aria-current');
  });
});

describe('dropdowns', () => {
  it('starts closed with aria-expanded=false', () => {
    render(<MarketingHeader />);
    expect(screen.getByRole('button', { name: /Products/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByRole('link', { name: /Trading Journal/ })).toBeNull();
  });

  it.each([
    ['Products', PRODUCT_ITEMS],
    ['Solutions', SOLUTION_ITEMS],
    ['Resources', RESOURCE_ITEMS],
  ])('opens %s and renders every real item with its destination', async (label, items) => {
    const user = userEvent.setup();
    render(<MarketingHeader />);

    const trigger = screen.getByRole('button', { name: new RegExp(label) });
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    for (const item of items) {
      expect(screen.getByRole('link', { name: new RegExp(item.label, 'i') })).toHaveAttribute(
        'href',
        item.href,
      );
    }
    // Every panel offers a route to its own overview page.
    expect(screen.getByRole('link', { name: new RegExp(`All ${label}`) })).toBeInTheDocument();
  });

  it('links the panel to its trigger via aria-controls', async () => {
    const user = userEvent.setup();
    render(<MarketingHeader />);
    const trigger = screen.getByRole('button', { name: /Products/ });
    await user.click(trigger);

    const panelId = trigger.getAttribute('aria-controls')!;
    expect(document.getElementById(panelId)).toBeTruthy();
  });

  it('closes the previous menu when another opens', async () => {
    const user = userEvent.setup();
    render(<MarketingHeader />);

    await user.click(screen.getByRole('button', { name: /Products/ }));
    await user.click(screen.getByRole('button', { name: /Solutions/ }));

    expect(screen.getByRole('button', { name: /Products/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.getByRole('button', { name: /Solutions/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('toggles closed when the trigger is clicked again', async () => {
    const user = userEvent.setup();
    render(<MarketingHeader />);
    const trigger = screen.getByRole('button', { name: /Products/ });

    await user.click(trigger);
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    render(<MarketingHeader />);
    const trigger = screen.getByRole('button', { name: /Products/ });

    await user.click(trigger);
    await user.keyboard('{Escape}');

    await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'false'));
    expect(trigger).toHaveFocus();
  });

  it('closes when the pointer goes down outside the navigation', async () => {
    const user = userEvent.setup();
    render(
      <>
        <MarketingHeader />
        <button type="button">outside</button>
      </>,
    );

    const trigger = screen.getByRole('button', { name: /Products/ });
    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: 'outside' }));

    await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'false'));
  });

  it('closes after a menu item is chosen', async () => {
    const user = userEvent.setup();
    render(<MarketingHeader />);

    const trigger = screen.getByRole('button', { name: /Products/ });
    await user.click(trigger);
    await user.click(screen.getByRole('link', { name: /Trading Journal/ }));

    await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'false'));
  });

  it('is operable from the keyboard alone', async () => {
    const user = userEvent.setup();
    render(<MarketingHeader />);

    const trigger = screen.getByRole('button', { name: /Products/ });
    trigger.focus();
    await user.keyboard('{Enter}');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    // The first item in the panel is reachable with a single Tab.
    await user.tab();
    expect(screen.getByRole('link', { name: /Trading Dashboard/ })).toHaveFocus();
  });
});

describe('mobile drawer', () => {
  it('opens an accessible dialog containing every public route', async () => {
    const user = userEvent.setup();
    render(<MarketingHeader />);

    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    const dialog = screen.getByRole('dialog', { name: /MetaTradee navigation/i });

    expect(dialog).toHaveAttribute('aria-modal', 'true');
    for (const label of ['Products', 'Solutions', 'Resources']) {
      expect(within(dialog).getByRole('button', { name: label })).toBeInTheDocument();
    }
    expect(within(dialog).getByRole('link', { name: 'Supported Brokers' })).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'Pricing' })).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login');
    expect(within(dialog).getByRole('link', { name: 'Get Started' })).toHaveAttribute(
      'href',
      '/register',
    );
  });

  it('expands and collapses a nested section', async () => {
    const user = userEvent.setup();
    render(<MarketingHeader />);
    await user.click(screen.getByRole('button', { name: 'Open menu' }));

    const dialog = screen.getByRole('dialog');
    const section = within(dialog).getByRole('button', { name: 'Products' });
    expect(section).toHaveAttribute('aria-expanded', 'false');

    await user.click(section);
    expect(section).toHaveAttribute('aria-expanded', 'true');
    expect(within(dialog).getByRole('link', { name: 'Trading Journal' })).toHaveAttribute(
      'href',
      '/products#journal',
    );

    await user.click(section);
    expect(section).toHaveAttribute('aria-expanded', 'false');
    expect(within(dialog).queryByRole('link', { name: 'Trading Journal' })).toBeNull();
  });

  it('closes on Escape and returns focus to the menu button', async () => {
    const user = userEvent.setup();
    render(<MarketingHeader />);

    const opener = screen.getByRole('button', { name: 'Open menu' });
    await user.click(opener);
    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(opener).toHaveFocus();
  });

  it('closes when a destination is chosen', async () => {
    const user = userEvent.setup();
    render(<MarketingHeader />);
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('link', { name: 'Pricing' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('traps focus inside the drawer', async () => {
    const user = userEvent.setup();
    render(
      <>
        <MarketingHeader />
        <button type="button">outside the drawer</button>
      </>,
    );

    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    const dialog = screen.getByRole('dialog');

    // Tab many times; focus must never escape to the element behind the drawer.
    for (let i = 0; i < 30; i += 1) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });

  it('locks background scroll while open and restores it on close', async () => {
    const user = userEvent.setup();
    render(<MarketingHeader />);

    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(document.body.style.overflow).toBe('hidden');

    await user.keyboard('{Escape}');
    await waitFor(() => expect(document.body.style.overflow).not.toBe('hidden'));
  });
});

describe('no dead controls', () => {
  it('gives every header control an accessible name and a real action', async () => {
    const user = userEvent.setup();
    render(<MarketingHeader />);

    for (const control of screen.getAllByRole('link')) {
      expect(control).toHaveAccessibleName();
      const href = control.getAttribute('href');
      expect(href, `${control.textContent} has no href`).toBeTruthy();
      expect(href).toMatch(/^\//);
    }
    for (const control of screen.getAllByRole('button')) {
      expect(control).toHaveAccessibleName();
      expect(control).toBeEnabled();
    }

    // And the same holds inside every dropdown panel.
    for (const label of ['Products', 'Solutions', 'Resources']) {
      await user.click(screen.getByRole('button', { name: new RegExp(label) }));
      for (const link of screen.getAllByRole('link')) {
        expect(link.getAttribute('href')).toMatch(/^\//);
      }
    }
  });
});
