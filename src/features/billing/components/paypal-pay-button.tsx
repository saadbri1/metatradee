'use client';

/**
 * One-time PayPal payment button.
 *
 * The SDK is loaded with intent=capture and NO vault — nothing is stored, and
 * no billing agreement is created, because there is nothing to renew.
 *
 * This component holds no price. It asks the server to create an order for a
 * tier and interval, hands PayPal the resulting id, and hands the id back to
 * the server to capture. It never learns what was charged until the server
 * tells it, and it never decides whether the payment succeeded — `onApprove`
 * firing is not proof of anything, so the button waits for the server's
 * verdict before showing any success state.
 */
import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  capturePayPalOrderAction,
  createPayPalOrderAction,
} from '../providers/paypal/order-actions';
import '../providers/paypal/sdk-types';
import { DAYS_FOR_INTERVAL } from '../access-period';
import type { BillingInterval } from '../pricing';
import type { PlanTier } from '../plans';

type Phase = 'loading' | 'ready' | 'paying' | 'confirming' | 'paid' | 'error';

let sdkPromise: Promise<void> | null = null;

/** Load the SDK once per page, not once per button. */
function loadSdk(clientId: string): Promise<void> {
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    if (window.paypal) return resolve();
    const script = document.createElement('script');
    const params = new URLSearchParams({
      'client-id': clientId,
      // CAPTURE, not subscription: one payment, taken once, no vaulting.
      intent: 'capture',
      currency: 'USD',
      locale: 'en_US',
      components: 'buttons',
    });
    script.src = `https://www.paypal.com/sdk/js?${params.toString()}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('sdk_load_failed'));
    document.body.appendChild(script);
  });
  return sdkPromise;
}

export function PayPalPayButton({
  clientId,
  tier,
  interval,
  onPaid,
}: {
  /** PUBLIC client id. Never the secret. */
  clientId: string;
  tier: PlanTier;
  interval: BillingInterval;
  onPaid?: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [message, setMessage] = useState('');
  const days = DAYS_FOR_INTERVAL[interval];

  useEffect(() => {
    let cancelled = false;

    loadSdk(clientId)
      .then(() => {
        if (cancelled || !host.current || !window.paypal) return;
        setPhase('ready');
        window.paypal
          .Buttons({
            fundingSource: window.paypal.FUNDING?.PAYPAL,
            // 'pay', never 'subscribe' — the label must match what happens.
            style: { layout: 'vertical', label: 'pay', height: 44 },

            createOrder: async () => {
              setPhase('paying');
              setMessage('');
              // The server decides the amount. We send a product, not a price.
              const result = await createPayPalOrderAction(tier, interval);
              if (!result.ok || !result.orderId) {
                throw new Error(result.error ?? 'order_failed');
              }
              return result.orderId;
            },

            onApprove: async (data: { orderID?: string }) => {
              if (!data.orderID) {
                setPhase('error');
                setMessage('PayPal did not return a payment reference.');
                return;
              }
              setPhase('confirming');
              // Only the order id crosses the boundary.
              const result = await capturePayPalOrderAction(data.orderID);
              if (cancelled) return;
              setMessage(result.message);
              if (result.outcome === 'granted' || result.outcome === 'already_granted') {
                setPhase('paid');
                onPaid?.();
              } else {
                setPhase('error');
              }
            },

            onCancel: () => {
              if (cancelled) return;
              setPhase('ready');
              setMessage('Payment cancelled. Nothing has been charged.');
            },

            onError: () => {
              if (cancelled) return;
              setPhase('error');
              setMessage('PayPal could not complete this payment. Nothing has been charged.');
            },
          })
          .render(host.current)
          .catch(() => {
            if (!cancelled) {
              setPhase('error');
              setMessage('The PayPal button could not be displayed.');
            }
          });
      })
      .catch(() => {
        if (!cancelled) {
          setPhase('error');
          setMessage('PayPal could not be reached. Please try again shortly.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [clientId, tier, interval, onPaid]);

  const busy = phase === 'loading' || phase === 'confirming';

  return (
    <div className="space-y-2">
      <p className="text-center text-xs text-muted-foreground">
        Pay with PayPal — {days} days access. No automatic renewal.
      </p>

      {/* Hidden rather than unmounted once paid, so PayPal's iframe is never
          torn out from under itself mid-flow. */}
      <div ref={host} hidden={phase === 'paid'} />

      {busy ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
          {phase === 'confirming' ? 'Confirming your payment…' : 'Loading PayPal…'}
        </p>
      ) : null}

      {message ? (
        <p
          role={phase === 'error' ? 'alert' : 'status'}
          className={
            phase === 'error'
              ? 'text-sm text-destructive'
              : phase === 'paid'
                ? 'text-sm font-medium text-profit'
                : 'text-sm text-muted-foreground'
          }
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
