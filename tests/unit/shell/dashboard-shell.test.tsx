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

  it('leaves the standard shell unchanged on other routes', () => {
    route.pathname = '/dashboard';
    useUIStore.setState({ sidebarCollapsed: true });
    render(<DashboardShell user={user}>Dashboard route</DashboardShell>);

    expect(screen.getByLabelText('Desktop shell navigation')).toBeInTheDocument();
    expect(screen.getByLabelText('Dashboard top bar')).toBeInTheDocument();
    expect(screen.getByLabelText('Mobile tab bar')).toBeInTheDocument();
    expect(screen.getByLabelText('Navigation drawer')).toBeInTheDocument();
    expect(screen.getByText('Dashboard route').closest('#main-content')?.parentElement).toHaveClass(
      'lg:pl-[76px]',
      'duration-normal',
      'motion-reduce:transition-none',
    );
  });

  it('resizes the content beside a user-expanded sidebar without changing routes', () => {
    route.pathname = '/dashboard';
    useUIStore.setState({ sidebarCollapsed: false });
    render(<DashboardShell user={user}>Expanded Dashboard</DashboardShell>);

    expect(
      screen.getByText('Expanded Dashboard').closest('#main-content')?.parentElement,
    ).toHaveClass('lg:pl-64');
  });
});
