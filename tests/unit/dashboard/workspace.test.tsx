import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/features/accounts/server/actions', () => ({
  createTradingAccountAction: vi.fn(),
  updateTradingAccountStatusAction: vi.fn(),
}));

import { DashboardOverview } from '@/features/dashboard/components/dashboard-overview';
import DashboardLoading from '@/app/(protected)/dashboard/loading';
import DashboardError from '@/app/(protected)/dashboard/error';

const emptyData = {
  accounts: [],
  trades: [],
  lastImportAt: null,
  lastImportStatus: null,
  timezone: 'UTC',
};

describe('account-aware dashboard workspace', () => {
  it('renders the complete honest empty dashboard and five KPI cards', () => {
    render(<DashboardOverview name="Trader" data={emptyData} />);
    expect(screen.getByText('No accounts')).toBeInTheDocument();
    for (const label of [
      'Net P&L',
      'Trade expectancy',
      'Profit factor',
      'Win rate',
      'Average win/loss trade',
    ]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(screen.getByText(/Score unlocks with 20 closed trades/i)).toBeInTheDocument();
    expect(screen.getAllByText(/No closed trades match these filters/i)).toHaveLength(2);
    expect(screen.getByRole('button', { name: /edit widgets/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /manage/i })).toBeDisabled();
  });

  it('opens the three-path account workflow from a working control', () => {
    render(<DashboardOverview name="Trader" data={emptyData} />);
    fireEvent.click(screen.getAllByRole('button', { name: /add account/i })[0]!);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Broker account')).toBeInTheDocument();
    expect(screen.getByText('Demo account')).toBeInTheDocument();
    expect(screen.getByText('Funded account')).toBeInTheDocument();
    expect(screen.getByText(/Live OAuth\/API synchronization is coming soon/i)).toBeInTheDocument();
  });

  it('renders route loading and retryable error states', () => {
    const { unmount } = render(<DashboardLoading />);
    expect(screen.getByLabelText('Loading dashboard')).toHaveAttribute('aria-busy', 'true');
    unmount();
    const reset = vi.fn();
    render(<DashboardError error={new Error('network')} reset={reset} />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(reset).toHaveBeenCalledOnce();
  });
});
