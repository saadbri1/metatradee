/**
 * Public plan cards.
 *
 * The risk on a pricing surface is not a layout bug — it is showing a number or
 * a claim that is not true. These check that every figure comes from the
 * central config, that the annual saving shown matches what the prices actually
 * do, and that the page makes no claim nobody has measured.
 */
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlanCards } from '@/features/marketing/components/plan-cards';
import { PLANS } from '@/features/billing/plans';
import { formatPrice, monthlyEquivalent, priceFor } from '@/features/billing/pricing';

function card(name: string) {
  return screen.getByRole('heading', { name, level: 3 }).closest('div') as HTMLElement;
}

describe('monthly view', () => {
  it('shows the configured monthly price for every paid plan', () => {
    render(<PlanCards />);
    for (const tier of ['trader', 'pro', 'funded'] as const) {
      const el = card(PLANS[tier].name);
      expect(within(el).getByText(formatPrice(priceFor(tier).monthly))).toBeInTheDocument();
    }
  });

  it('says Free rather than $0, and asks for no payment', () => {
    render(<PlanCards />);
    const free = card('Free');
    expect(within(free).getByText('No payment required')).toBeInTheDocument();
    expect(within(free).queryByText('$0')).not.toBeInTheDocument();
  });

  it('states the access period rather than offering a trial', () => {
    /*
     * There are no trials. The product sells a fixed period of access that
     * does not renew, so the public page must not promise a trial that the
     * checkout cannot deliver.
     */
    render(<PlanCards />);
    const pro = card('Pro');
    expect(within(pro).getByRole('link', { name: 'Get started' })).toHaveAttribute(
      'href',
      '/register',
    );
    expect(within(pro).getByText(/30 days access\. No automatic renewal\./)).toBeInTheDocument();
  });

  it('uses no trial, subscription or cancellation wording anywhere', () => {
    const { container } = render(<PlanCards />);
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/trial/i);
    expect(text).not.toMatch(/cancel any time/i);
    expect(text).not.toMatch(/subscri/i);
    expect(text).not.toMatch(/billed (monthly|yearly)/i);
    expect(text).toMatch(/no automatic renewal/i);
  });
});

describe('yearly view', () => {
  it('shows the honest monthly equivalent and the real annual total', async () => {
    const user = userEvent.setup();
    render(<PlanCards />);
    await user.click(screen.getByRole('button', { name: 'Yearly' }));

    const pro = card('Pro');
    // The headline is the ONE-OFF amount actually charged, not a per-month
    // figure — the payment never repeats.
    expect(within(pro).getByText(formatPrice(priceFor('pro').annual))).toBeInTheDocument();
    // The monthly equivalent is still shown, as an honest comparison.
    expect(monthlyEquivalent('pro')).toBeLessThan(priceFor('pro').monthly);
    /*
     * Asserted on textContent, not a regex over a matcher. The copy is split
     * across elements by JSX interpolation, and formatPrice returns "$32.50" —
     * whose leading $ is an end-anchor if it is dropped into a RegExp.
     */
    const text = pro.textContent ?? '';
    expect(text).toContain('365 days access');
    expect(text).toContain(formatPrice(monthlyEquivalent('pro')));
    expect(text).toContain('No automatic renewal');
  });

  it('states a saving equal to what the prices really give', async () => {
    const user = userEvent.setup();
    render(<PlanCards />);
    await user.click(screen.getByRole('button', { name: 'Yearly' }));
    // 19*12 = 228 vs 190 → 17%. Derived, so it cannot overstate the discount.
    expect(within(card('Trader')).getByText(/save 17%/)).toBeInTheDocument();
  });

  it('never advertises a discount on the free plan', async () => {
    const user = userEvent.setup();
    render(<PlanCards />);
    await user.click(screen.getByRole('button', { name: 'Yearly' }));
    expect(within(card('Free')).queryByText(/save/i)).not.toBeInTheDocument();
  });
});

describe('the toggle is operable and announced', () => {
  it('exposes its state through aria-pressed', async () => {
    const user = userEvent.setup();
    render(<PlanCards />);
    const monthly = screen.getByRole('button', { name: 'Monthly' });
    const yearly = screen.getByRole('button', { name: 'Yearly' });

    expect(monthly).toHaveAttribute('aria-pressed', 'true');
    expect(yearly).toHaveAttribute('aria-pressed', 'false');

    await user.click(yearly);
    expect(yearly).toHaveAttribute('aria-pressed', 'true');
    expect(monthly).toHaveAttribute('aria-pressed', 'false');
  });

  it('is reachable and operable by keyboard', async () => {
    const user = userEvent.setup();
    render(<PlanCards />);
    const yearly = screen.getByRole('button', { name: 'Yearly' });
    yearly.focus();
    await user.keyboard('{Enter}');
    expect(yearly).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('claims', () => {
  it('recommends a plan without claiming popularity nobody has measured', () => {
    render(<PlanCards />);
    expect(screen.getByText('Recommended')).toBeInTheDocument();
    expect(
      screen.queryByText(/most popular|best.?selling|\d+[,\d]* (traders|users|customers)/i),
    ).not.toBeInTheDocument();
  });

  it('sells no capability that no plan grants', () => {
    render(<PlanCards />);
    // propFirmTools and backtesting are not built — they must not appear as
    // an included bullet on any card.
    expect(screen.queryByText(/prop.?firm/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/backtest/i)).not.toBeInTheDocument();
  });

  it('promises no trading outcome', () => {
    const { container } = render(<PlanCards />);
    expect(container.textContent).not.toMatch(/guarantee|profitable|win more|beat the market/i);
  });

  it('lists only capabilities the plan matrix actually grants', () => {
    render(<PlanCards />);
    // Trader has no AI coach; it must not be listed on the Trader card.
    expect(PLANS.trader.features.aiCoach).toBe(false);
    expect(within(card('Trader')).queryByText('AI Coach reviews')).not.toBeInTheDocument();
    expect(within(card('Pro')).getByText('AI Coach reviews')).toBeInTheDocument();
  });
});
