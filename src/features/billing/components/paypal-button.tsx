'use client';

/**
 * PayPal Subscriptions button.
 *
 * The button's success callback is NOT proof of anything. When PayPal reports
 * an approval we send only the subscription id to the server, which reads the
 * subscription back from PayPal and decides. So the states below are honest:
 * "approved" is not "active", and the UI says so.
 *
 * The SDK is loaded with intent=subscription&vault=true, and only ever with the
 * PUBLIC client id — the secret is server-only and cannot reach this file.
 */
import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { verifyPayPalSubscriptionAction } from '../providers/paypal/verify-action';
import type { BillingInterval } from '../pricing';
import type { PlanTier } from '../plans';

type Phase = 'loading' | 'ready' | 'approving' | 'verifying' | 'active' | 'pending' | 'error';

declare global {
  interface Window {
    paypal?: {
      Buttons: (opts: Record<string, unknown>) => {
        render: (el: HTMLElement) => Promise<void>;
        close?: () => void;
      };
    };
  }
}

let sdkPromise: Promise<void> | null = null;

/** Load the SDK once per page, not once per button. */
function loadSdk(clientId: string): Promise<void> {
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    if (window.paypal) return resolve();
    const script = document.createElement('script');
    const params = new URLSearchParams({
      'client-id': clientId,
      vault: 'true',
      intent: 'subscription',
      currency: 'USD',
    });
    script.src = `https://www.paypal.com/sdk/js?${params.toString()}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('sdk_load_failed'));
    document.body.appendChild(script);
  });
  return sdkPromise;
}

export function PayPalSubscribeButton({
  clientId,
  paypalPlanId,
  tier,
  interval,
  onActivated,
}: {
  /** PUBLIC client id. Never the secret. */
  clientId: string;
  paypalPlanId: string;
  tier: PlanTier;
  interval: BillingInterval;
  onActivated?: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    let cancelled = false;

    loadSdk(clientId)
      .then(() => {
        if (cancelled || !host.current || !window.paypal) return;
        setPhase('ready');
        window.paypal
          .Buttons({
            style: { layout: 'vertical', label: 'subscribe', height: 44 },

            createSubscription: (_data: unknown, actions: Record<string, never>) => {
              setPhase('approving');
              setMessage('');
              // custom_id binds the subscription to this user. The server
              // re-reads it and refuses if it does not match the caller.
              return (
                actions as unknown as {
                  subscription: { create: (o: Record<string, unknown>) => Promise<string> };
                }
              ).subscription.create({ plan_id: paypalPlanId });
            },

            onApprove: async (data: { subscriptionID?: string }) => {
              if (!data.subscriptionID) {
                setPhase('error');
                setMessage('PayPal did not return a subscription reference.');
                return;
              }
              setPhase('verifying');
              // Only the id crosses the boundary.
              const result = await verifyPayPalSubscriptionAction(
                data.subscriptionID,
                tier,
                interval,
              );
              if (cancelled) return;
              setMessage(result.message);
              if (result.outcome === 'active') {
                setPhase('active');
                onActivated?.();
              } else if (result.outcome === 'pending') {
                setPhase('pending');
              } else {
                setPhase('error');
              }
            },

            onCancel: () => {
              if (cancelled) return;
              setPhase('ready');
              setMessage('Checkout cancelled. Nothing has been charged.');
            },

            onError: () => {
              if (cancelled) return;
              setPhase('error');
              setMessage('PayPal could not complete this checkout. Nothing has been charged.');
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
  }, [clientId, paypalPlanId, tier, interval, onActivated]);

  const busy = phase === 'loading' || phase === 'verifying';

  return (
    <div className="space-y-2">
      {/* Hidden rather than unmounted once resolved, so PayPal's iframe is
          never torn out from under itself mid-flow. */}
      <div ref={host} hidden={phase === 'active'} />

      {busy ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
          {phase === 'verifying' ? 'Confirming with PayPal…' : 'Loading PayPal…'}
        </p>
      ) : null}

      {message ? (
        <p
          role={phase === 'error' ? 'alert' : 'status'}
          className={
            phase === 'error'
              ? 'text-sm text-destructive'
              : phase === 'active'
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
