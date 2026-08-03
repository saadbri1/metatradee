import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const route = vi.hoisted(() => ({ pathname: '/chart' }));

vi.mock('next/navigation', () => ({ usePathname: () => route.pathname }));
vi.mock('@/features/shell/components/sidebar', () => ({
  Sidebar: () => <nav aria-label="Desktop shell navigation" />,
}));
vi.mock('@/features/shell/components/top-bar', () => ({
  TopBar: () => <header aria-label="Dashboard top bar" />,
}));
vi.mock('@/features/shell/components/mobile-nav', () => ({
  MobileDrawer: () => <aside aria-label="Navigation drawer" />,
  MobileTabBar: () => <nav aria-label="Mobile tab bar" />,
}));
vi.mock('@/features/shell/components/command-palette', () => ({
  CommandPalette: () => null,
}));
vi.mock('@/features/shell/hooks/use-shell-shortcuts', () => ({
  useShellShortcuts: () => undefined,
}));
vi.mock('@/features/shell/hooks/use-focus-on-route-change', () => ({
  useFocusOnRouteChange: () => undefined,
}));

import { DashboardShell } from '@/features/shell/components/dashboard-shell';
import { useUIStore } from '@/store/ui-store';

const user = {
  displayName: 'Test User',
  username: 'test',
  email: 'test@example.com',
  avatarUrl: null,
};

describe('route-specific dashboard shell', () => {
  it('gives /chart the full viewport while retaining the navigation drawer', () => {
    route.pathname = '/chart';
    render(<DashboardShell user={user}>Chart route</DashboardShell>);

    expect(screen.queryByLabelText('Desktop shell navigation')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Dashboard top bar')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Mobile tab bar')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Navigation drawer')).toBeInTheDocument();
    expect(screen.getByText('Chart route').closest('#main-content')).toHaveClass('px-0', 'py-0');
  });

  it('lets /dashboard own its compact header and edge-to-edge workspace', () => {
    route.pathname = '/dashboard';
    useUIStore.setState({ sidebarCollapsed: true });
    render(<DashboardShell user={user}>Dashboard route</DashboardShell>);

    expect(screen.getByLabelText('Desktop shell navigation')).toBeInTheDocument();
    expect(screen.queryByLabelText('Dashboard top bar')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Mobile tab bar')).toBeInTheDocument();
    expect(screen.getByLabelText('Navigation drawer')).toBeInTheDocument();
    expect(screen.getByText('Dashboard route').closest('#main-content')).toHaveClass(
      'px-0',
      'py-0',
    );
    expect(
      screen.getByText('Dashboard route').closest('#main-content')?.firstElementChild,
    ).toHaveClass('max-w-none');
    expect(screen.getByText('Dashboard route').closest('#main-content')?.parentElement).toHaveClass(
      'lg:pl-[76px]',
      'duration-normal',
      'motion-reduce:transition-none',
    );
  });

  it('retains the standard top bar and content padding outside workspace routes', () => {
    route.pathname = '/journal';
    useUIStore.setState({ sidebarCollapsed: true });
    render(<DashboardShell user={user}>Journal route</DashboardShell>);

    expect(screen.getByLabelText('Dashboard top bar')).toBeInTheDocument();
    /*
     * `px-gutter` is the named layout rhythm token and resolves to the same
     * 1rem the literal `px-4` gave. `pb-24` reserves room for the fixed mobile
     * tab bar and is now applied on every route that shows it — previously it
     * was tied to the padding branch, so /dashboard reserved nothing and its
     * last widget row sat underneath the bar.
     */
    expect(screen.getByText('Journal route').closest('#main-content')).toHaveClass(
      'px-gutter',
      'py-6',
      'pb-24',
    );
    expect(
      screen.getByText('Journal route').closest('#main-content')?.firstElementChild,
    ).toHaveClass('mx-auto', 'max-w-6xl');
  });

  it('reserves room for the mobile tab bar on the dashboard too', () => {
    /*
     * THE regression this pins. `pb-24` used to sit in the same branch as the
     * default padding, so /dashboard — which supplies its own padding — got
     * neither, and the last row of widgets rendered underneath the fixed
     * MobileTabBar on small screens. The reservation now follows the BAR, not
     * the padding: every route that shows the bar reserves space for it.
     */
    route.pathname = '/dashboard';
    render(<DashboardShell user={user}>Dashboard route</DashboardShell>);

    const main = screen.getByText('Dashboard route').closest('#main-content');
    expect(main).toHaveClass('pb-24', 'lg:pb-0');
  });

  it('reserves nothing on the chart workspace, which hides the tab bar', () => {
    route.pathname = '/chart';
    render(<DashboardShell user={user}>Chart route</DashboardShell>);

    const main = screen.getByText('Chart route').closest('#main-content');
    expect(main).not.toHaveClass('pb-24');
  });

  it('resizes the content beside a user-expanded sidebar without changing routes', () => {
    route.pathname = '/dashboard';
    useUIStore.setState({ sidebarCollapsed: false });
    render(<DashboardShell user={user}>Expanded Dashboard</DashboardShell>);

    expect(
      screen.getByText('Expanded Dashboard').closest('#main-content')?.parentElement,
    ).toHaveClass('lg:pl-[232px]');
  });
});
