import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ mutate: vi.fn() }));

vi.mock('@/features/auth/hooks/use-sign-out', () => ({
  useSignOut: () => ({ mutate: mocks.mutate, isPending: false }),
}));

import { UserMenu } from '@/features/shell/components/user-menu';

const user = {
  displayName: 'Test User',
  username: 'test',
  email: 'test@example.com',
  avatarUrl: null,
};

describe('shell profile menu', () => {
  it('opens from the account control and exposes the real destinations', async () => {
    const person = userEvent.setup();
    render(<UserMenu user={user} />);

    const trigger = screen.getByRole('button', { name: 'Account menu' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await person.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Profile/ })).toHaveAttribute(
      'href',
      '/settings/profile',
    );
    expect(screen.getByRole('menuitem', { name: /Preferences/ })).toHaveAttribute(
      'href',
      '/settings/preferences',
    );
    expect(screen.getByRole('menuitem', { name: /Billing/ })).toHaveAttribute('href', '/billing');
  });

  it('signs out through the real hook rather than a decorative control', async () => {
    const person = userEvent.setup();
    render(<UserMenu user={user} />);

    await person.click(screen.getByRole('button', { name: 'Account menu' }));
    await person.click(screen.getByRole('menuitem', { name: /Sign out/i }));

    expect(mocks.mutate).toHaveBeenCalled();
  });
});
