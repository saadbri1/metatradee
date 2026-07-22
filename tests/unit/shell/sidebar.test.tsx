import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const route = vi.hoisted(() => ({ pathname: '/dashboard' }));

vi.mock('next/navigation', () => ({ usePathname: () => route.pathname }));
vi.mock('@/features/shell/components/user-menu', () => ({
  UserMenu: () => <button aria-label="Account menu">TU</button>,
}));

import { Sidebar } from '@/features/shell/components/sidebar';
import { useUIStore } from '@/store/ui-store';

const user = {
  displayName: 'Test User',
  username: 'test',
  email: 'test@example.com',
  avatarUrl: null,
};

describe('professional desktop navigation sidebar', () => {
  beforeEach(() => {
    route.pathname = '/dashboard';
    useUIStore.setState({ sidebarCollapsed: false });
  });

  it('renders the 232px labeled navigation when expanded', () => {
    render(<Sidebar user={user} />);

    const sidebar = screen.getByLabelText('Desktop navigation');
    expect(sidebar).toHaveAttribute('data-state', 'expanded');
    expect(sidebar).toHaveClass('w-[232px]', 'hidden', 'lg:flex', 'motion-reduce:transition-none');
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Dashboard')).toBeVisible();
    expect(screen.getByText('MetaTradee')).toBeVisible();
    expect(screen.queryByLabelText(/float sidebar/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/pin sidebar/i)).not.toBeInTheDocument();
  });

  it('expands and collapses from the reachable outside-edge control', async () => {
    const keyboard = userEvent.setup();
    render(<Sidebar user={user} />);

    const collapse = screen.getByRole('button', { name: 'Collapse sidebar' });
    collapse.focus();
    await keyboard.keyboard('{Enter}');

    const sidebar = screen.getByLabelText('Desktop navigation');
    expect(sidebar).toHaveAttribute('data-state', 'collapsed');
    expect(sidebar).toHaveClass('w-[76px]');

    await keyboard.click(screen.getByRole('button', { name: 'Expand sidebar' }));
    expect(sidebar).toHaveAttribute('data-state', 'expanded');
    expect(sidebar).toHaveClass('w-[232px]');
    expect(screen.getByText('Test User')).toBeVisible();
  });

  it('shows accessible labels and compact tooltips for collapsed navigation', async () => {
    useUIStore.setState({ sidebarCollapsed: true });
    render(<Sidebar user={user} />);

    const journal = screen.getByRole('link', { name: 'Journal' });
    expect(journal).toHaveAttribute('href', '/journal');
    fireEvent.focus(journal);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Journal');
  });

  it('keeps Add account and the account action real and reachable', () => {
    render(<Sidebar user={user} />);

    expect(screen.getByRole('link', { name: 'Add account' })).toHaveAttribute(
      'href',
      '/dashboard?addAccount=1',
    );
    expect(screen.getByRole('button', { name: 'Account menu' })).toBeEnabled();
    expect(screen.getByRole('link', { name: 'Analytics' })).toHaveAttribute('href', '/analytics');
    expect(screen.queryByRole('link', { name: 'Help' })).not.toBeInTheDocument();
  });

  it('retains active-route state when the rail is expanded', () => {
    route.pathname = '/calendar';
    useUIStore.setState({ sidebarCollapsed: false });
    render(<Sidebar user={user} />);

    expect(screen.getByRole('link', { name: 'Calendar' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
  });
});
