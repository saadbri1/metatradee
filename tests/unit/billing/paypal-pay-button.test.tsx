/**
 * The approval-to-capture path in the browser.
 *
 * Two defects were live here at once, and a buyer hit both:
 *
 *  1. TWO buttons rendered. `onPaid` was an effect dependency and the parent
 *     passed a fresh arrow every render, so the effect re-ran; its cleanup only
 *     set a flag, and `.render()` appends, so a second button stacked on the
 *     first.
 *  2. Clicking the older button left the UI on "Confirming your payment…"
 *     forever, because `onApprove` did `await capture(); if (cancelled) return;`
 *     and that stale closure threw the server's answer away.
 *
 * Every test below fails against that version. The spinner ones matter most:
 * an infinite loading state after a real charge is the worst outcome this
 * component can produce, because the buyer cannot tell whether they paid.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => ({
  capture: vi.fn(),
  create: vi.fn(),
}));

vi.mock('@/features/billing/providers/paypal/order-actions', () => ({
  capturePayPalOrderAction: h.capture,
  createPayPalOrderAction: h.create,
}));

import { PayPalPayButton, __resetSdkCache } from '@/features/billing/components/paypal-pay-button';

/** Captures the options each Buttons() call was given. */
let buttonOptions: Record<string, (...args: never[]) => unknown>[] = [];
/** How many times .render() actually painted into a container. */
let renderCount = 0;
let closeCount = 0;

function installFakeSdk() {
  buttonOptions = [];
  renderCount = 0;
  closeCount = 0;
  (window as unknown as { paypal: unknown }).paypal = {
    FUNDING: { PAYPAL: 'paypal' },
    Buttons: (opts: Record<string, (...args: never[]) => unknown>) => {
      buttonOptions.push(opts);
      return {
        render: async (el: HTMLElement) => {
          renderCount += 1;
          // Mirror the real SDK: render APPENDS, it does not replace.
          const node = document.createElement('div');
          node.setAttribute('data-paypal-button', String(renderCount));
          el.appendChild(node);
        },
        close: () => {
          closeCount += 1;
        },
      };
    },
  };
}

/** The most recently mounted button's callbacks. */
function latest() {
  const opts = buttonOptions[buttonOptions.length - 1];
  if (!opts) throw new Error('no PayPal Buttons instance was created');
  return opts;
}

async function approve(orderID: string | undefined, which = latest()) {
  await act(async () => {
    await (which.onApprove as (d: { orderID?: string }) => Promise<void>)({ orderID });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  __resetSdkCache();
  installFakeSdk();
  h.create.mockResolvedValue({ ok: true, orderId: 'ORDER123456789AB' });
  h.capture.mockResolvedValue({
    ok: true,
    outcome: 'granted',
    tier: 'pro',
    accessExpiresAt: '2026-08-31T12:00:00.000Z',
    message: 'Payment received. You have 30 days of pro access.',
  });
});

afterEach(() => {
  delete (window as unknown as { paypal?: unknown }).paypal;
});

describe('exactly one button is mounted', () => {
  it('renders a single PayPal button on mount', async () => {
    render(<PayPalPayButton clientId="cid" tier="pro" interval="monthly" />);
    await waitFor(() => expect(renderCount).toBe(1));

    const host = screen.getByTestId('paypal-button-host');
    expect(host.querySelectorAll('[data-paypal-button]')).toHaveLength(1);
  });

  it('does NOT mount a second button when the parent re-renders with a new onPaid', async () => {
    /*
     * THE regression. The parent used to pass `onPaid={() => refetch()}` — a
     * new identity every render — and it was an effect dependency, so each
     * parent update appended another button.
     */
    const { rerender } = render(
      <PayPalPayButton clientId="cid" tier="pro" interval="monthly" onPaid={() => {}} />,
    );
    await waitFor(() => expect(renderCount).toBe(1));

    for (let i = 0; i < 4; i++) {
      // A fresh arrow each time, exactly as an inline callback would be.
      rerender(<PayPalPayButton clientId="cid" tier="pro" interval="monthly" onPaid={() => {}} />);
    }
    await act(async () => {});

    expect(renderCount).toBe(1);
    const host = screen.getByTestId('paypal-button-host');
    expect(host.querySelectorAll('[data-paypal-button]')).toHaveLength(1);
  });

  it('tears the instance down and empties the container on unmount', async () => {
    const { unmount } = render(<PayPalPayButton clientId="cid" tier="pro" interval="monthly" />);
    await waitFor(() => expect(renderCount).toBe(1));
    const host = screen.getByTestId('paypal-button-host');

    unmount();

    // Previously cleanup only set a flag, leaving an abandoned but still
    // clickable button in the DOM.
    expect(closeCount).toBe(1);
    expect(host.querySelectorAll('[data-paypal-button]')).toHaveLength(0);
  });

  it('loads the SDK script only once across two buttons', async () => {
    render(
      <>
        <PayPalPayButton clientId="cid" tier="pro" interval="monthly" />
        <PayPalPayButton clientId="cid" tier="trader" interval="annual" />
      </>,
    );
    await waitFor(() => expect(renderCount).toBe(2));
    // Two buttons, but one shared SDK — window.paypal was already present.
    expect(document.querySelectorAll('script#paypal-sdk-js')).toHaveLength(0);
  });
});

describe('onApprove calls capture exactly once', () => {
  it('invokes the capture action a single time with the order id', async () => {
    render(<PayPalPayButton clientId="cid" tier="pro" interval="monthly" />);
    await waitFor(() => expect(renderCount).toBe(1));

    await approve('ORDER123456789AB');

    expect(h.capture).toHaveBeenCalledTimes(1);
    expect(h.capture).toHaveBeenCalledWith('ORDER123456789AB');
  });

  it('ignores a second approval while the first is still in flight', async () => {
    let release: (v: unknown) => void = () => {};
    h.capture.mockReturnValue(new Promise((r) => (release = r)));

    render(<PayPalPayButton clientId="cid" tier="pro" interval="monthly" />);
    await waitFor(() => expect(renderCount).toBe(1));

    const opts = latest();
    const first = (opts.onApprove as (d: { orderID?: string }) => Promise<void>)({
      orderID: 'ORDER123456789AB',
    });
    const second = (opts.onApprove as (d: { orderID?: string }) => Promise<void>)({
      orderID: 'ORDER123456789AB',
    });

    await act(async () => {
      release({ ok: true, outcome: 'granted', tier: 'pro', message: 'done' });
      await Promise.all([first, second]);
    });

    // The database is idempotent on provider_capture_id, but a second request
    // is still a second charge attempt at PayPal.
    expect(h.capture).toHaveBeenCalledTimes(1);
  });
});

describe('the spinner always clears', () => {
  it('shows an error and no spinner when PayPal returns no order id', async () => {
    render(<PayPalPayButton clientId="cid" tier="pro" interval="monthly" />);
    await waitFor(() => expect(renderCount).toBe(1));

    await approve(undefined);

    expect(h.capture).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/did not return a payment reference/i);
    expect(screen.queryByText(/Confirming your payment/i)).not.toBeInTheDocument();
  });

  it('clears the spinner and shows the exact server message on a rejected capture', async () => {
    h.capture.mockResolvedValue({
      ok: false,
      outcome: 'rejected',
      reason: 'wrong_amount',
      message: 'The amount paid does not match the price of the plan selected.',
    });

    render(<PayPalPayButton clientId="cid" tier="pro" interval="monthly" />);
    await waitFor(() => expect(renderCount).toBe(1));

    await approve('ORDER123456789AB');

    // The server's own safe copy, verbatim — not a generic substitute.
    expect(screen.getByRole('alert')).toHaveTextContent(
      'The amount paid does not match the price of the plan selected.',
    );
    expect(screen.queryByText(/Confirming your payment/i)).not.toBeInTheDocument();
  });

  it('clears the spinner when the capture action THROWS', async () => {
    /*
     * The failure the buyer actually hit. A thrown action used to leave the UI
     * on "Confirming your payment…" indefinitely, with no way to tell whether
     * money had moved.
     */
    h.capture.mockRejectedValue(new Error('network down'));

    render(<PayPalPayButton clientId="cid" tier="pro" interval="monthly" />);
    await waitFor(() => expect(renderCount).toBe(1));

    await approve('ORDER123456789AB');

    expect(screen.queryByText(/Confirming your payment/i)).not.toBeInTheDocument();
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/could not confirm your payment/i);
    // And it tells the buyer what to do, since a charge may have happened.
    expect(alert).toHaveTextContent(/contact support/i);
  });

  it('never leaves the spinner up after any approval outcome', async () => {
    for (const outcome of ['granted', 'already_granted', 'rejected', 'error', 'invalid_order']) {
      vi.clearAllMocks();
      __resetSdkCache();
      installFakeSdk();
      h.capture.mockResolvedValue({ ok: outcome === 'granted', outcome, message: `m-${outcome}` });

      const view = render(<PayPalPayButton clientId="cid" tier="pro" interval="monthly" />);
      await waitFor(() => expect(renderCount).toBe(1));
      await approve('ORDER123456789AB');

      expect(
        view.queryByText(/Confirming your payment/i),
        `spinner stuck for outcome=${outcome}`,
      ).not.toBeInTheDocument();
      view.unmount();
    }
  });
});

describe('a successful capture refreshes entitlement', () => {
  it('calls onPaid once the server confirms the grant', async () => {
    const onPaid = vi.fn();
    render(<PayPalPayButton clientId="cid" tier="pro" interval="monthly" onPaid={onPaid} />);
    await waitFor(() => expect(renderCount).toBe(1));

    await approve('ORDER123456789AB');

    expect(onPaid).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent(/Payment received/i);
  });

  it('uses the LATEST onPaid even though it is not an effect dependency', async () => {
    // The ref must not pin the first callback it ever saw.
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(
      <PayPalPayButton clientId="cid" tier="pro" interval="monthly" onPaid={first} />,
    );
    await waitFor(() => expect(renderCount).toBe(1));

    rerender(<PayPalPayButton clientId="cid" tier="pro" interval="monthly" onPaid={second} />);
    await approve('ORDER123456789AB');

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('does not call onPaid when the capture was refused', async () => {
    const onPaid = vi.fn();
    h.capture.mockResolvedValue({ ok: false, outcome: 'rejected', message: 'refused' });

    render(<PayPalPayButton clientId="cid" tier="pro" interval="monthly" onPaid={onPaid} />);
    await waitFor(() => expect(renderCount).toBe(1));

    await approve('ORDER123456789AB');

    expect(onPaid).not.toHaveBeenCalled();
  });
});
