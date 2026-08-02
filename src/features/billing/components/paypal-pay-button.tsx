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
 *
 * TWO DEFECTS THIS FILE PREVIOUSLY HAD, both visible to a buyer:
 *
 *  1. TWO BUTTONS. `onPaid` was in the effect's dependency array, and the
 *     parent passed a fresh arrow on every render, so the effect re-ran on
 *     each parent update. Its cleanup only set a `cancelled` flag — it never
 *     tore down the PayPal instance — and `.render()` APPENDS, so every re-run
 *     added another button to the same container. `onPaid` is now held in a
 *     ref and is not a dependency, and cleanup genuinely closes the instance
 *     and empties the container.
 *
 *  2. AN INFINITE SPINNER. `onApprove` did `await capture(); if (cancelled)
 *     return;` — so the stale closure belonging to the first button discarded
 *     the server's answer and left the UI on "Confirming your payment…"
 *     forever. A buyer who clicked the older of the two buttons saw exactly
 *     that. Nothing in `onApprove` short-circuits on a stale closure any more:
 *     once money may have moved, the result is ALWAYS rendered, and a `finally`
 *     guarantees the loading state is cleared even if something throws.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  capturePayPalOrderAction,
  createPayPalOrderAction,
} from '../providers/paypal/order-actions';
import '../providers/paypal/sdk-types';
// TEMPORARY — remove with browser-diagnostics.ts after the sandbox test.
import { ppBrowserDiag } from '../providers/paypal/browser-diagnostics';
import { DAYS_FOR_INTERVAL } from '../access-period';
import type { BillingInterval } from '../pricing';
import type { PlanTier } from '../plans';

type Phase = 'loading' | 'ready' | 'paying' | 'confirming' | 'paid' | 'error';

/** The rendered SDK script, keyed by client id so it is fetched once per page. */
const sdkPromises = new Map<string, Promise<void>>();
const SDK_SCRIPT_ID = 'paypal-sdk-js';

/**
 * Load the SDK once per page, not once per button.
 *
 * Keyed by client id and backed by an id'd <script> element, so a remount, a
 * second card, or a fast-refresh cannot inject a second copy of the SDK.
 */
function loadSdk(clientId: string): Promise<void> {
  const existing = sdkPromises.get(clientId);
  if (existing) return existing;

  const promise = new Promise<void>((resolve, reject) => {
    if (window.paypal) return resolve();

    const alreadyInDom = document.getElementById(SDK_SCRIPT_ID) as HTMLScriptElement | null;
    if (alreadyInDom) {
      alreadyInDom.addEventListener('load', () => resolve(), { once: true });
      alreadyInDom.addEventListener('error', () => reject(new Error('sdk_load_failed')), {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    const params = new URLSearchParams({
      'client-id': clientId,
      // CAPTURE, not subscription: one payment, taken once, no vaulting.
      intent: 'capture',
      currency: 'USD',
      locale: 'en_US',
      components: 'buttons',
    });
    script.id = SDK_SCRIPT_ID;
    script.src = `https://www.paypal.com/sdk/js?${params.toString()}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('sdk_load_failed'));
    document.body.appendChild(script);
  });

  sdkPromises.set(clientId, promise);
  return promise;
}

/** Test seam: forget the loaded SDK between cases. */
export function __resetSdkCache(): void {
  sdkPromises.clear();
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

  /*
   * `onPaid` is held in a ref, NOT read from the effect's closure. The parent
   * recreates the callback on every render; depending on it re-ran the whole
   * mount and produced a second button. The ref means the latest callback is
   * always used without the effect ever needing to re-run.
   */
  const onPaidRef = useRef(onPaid);
  useEffect(() => {
    onPaidRef.current = onPaid;
  }, [onPaid]);

  /** The live PayPal Buttons instance, so cleanup can actually close it. */
  const instanceRef = useRef<{ close?: () => void } | null>(null);
  /** One capture at a time. A double-clicked confirm must not call twice. */
  const captureInFlight = useRef(false);
  /**
   * The order id THIS component most recently created.
   *
   * Cleared before every createOrder and set only on success, so a stale id
   * from a previous render or a failed attempt can never be handed to capture.
   * onApprove refuses an id that is not the one we just created — capturing an
   * order this session did not create is exactly how a payment ends up bound
   * to the wrong account.
   */
  const currentOrderId = useRef<string | null>(null);

  const handleApprove = useCallback(async (orderId: string | undefined) => {
    ppBrowserDiag('onApprove.start', {
      hasOrderId: Boolean(orderId),
      matchesCreated: orderId != null && orderId === currentOrderId.current,
    });

    // In-flight guard. The database is idempotent on provider_capture_id, but
    // a second request is still a second charge attempt at PayPal.
    if (captureInFlight.current) {
      ppBrowserDiag('onApprove.duplicate.ignored');
      return;
    }
    captureInFlight.current = true;

    setPhase('confirming');
    setMessage('');
    let settled = false;

    try {
      if (!orderId) {
        ppBrowserDiag('onApprove.missingOrderId');
        setPhase('error');
        setMessage('PayPal did not return a payment reference. Nothing has been charged.');
        settled = true;
        return;
      }

      /*
       * STALE ORDER GUARD. PayPal hands back the id it was given, so the
       * approved id must be exactly the one this component just created.
       *
       * A null ref is a mismatch too, deliberately: it means no order was
       * created by this instance, so whatever is being approved came from a
       * previous attempt, a re-render, or somewhere else entirely. Capturing
       * it would attribute another order to this session — the same class of
       * bug as the ownership mismatch this guard sits next to. The SDK always
       * calls createOrder before onApprove, so a legitimate flow always has it
       * set.
       */
      if (orderId !== currentOrderId.current) {
        ppBrowserDiag('onApprove.staleOrder.rejected');
        setPhase('error');
        setMessage(
          'That payment reference is out of date. Nothing has been charged — please start the payment again.',
        );
        settled = true;
        return;
      }

      // Length only — enough to tell absent from malformed, without logging
      // the identifier itself.
      ppBrowserDiag('capture.invoke', { orderIdLength: orderId.length });
      const result = await capturePayPalOrderAction(orderId);
      ppBrowserDiag('capture.result', { ok: result.ok, outcome: result.outcome });

      /*
       * NO staleness check here, deliberately. This runs after money may have
       * moved; discarding the answer because the effect was torn down is what
       * produced the permanent "Confirming your payment…".
       */
      setMessage(result.message);
      if (result.outcome === 'granted' || result.outcome === 'already_granted') {
        setPhase('paid');
        onPaidRef.current?.();
      } else {
        setPhase('error');
      }
      settled = true;
    } catch (err) {
      // Never swallowed. A thrown action is a state the buyer must be told about.
      ppBrowserDiag('capture.exception', { name: (err as Error)?.name ?? 'unknown' });
      setPhase('error');
      setMessage(
        'We could not confirm your payment. If PayPal has charged you, contact support with your PayPal transaction id — nothing has been recorded on your account yet.',
      );
      settled = true;
    } finally {
      captureInFlight.current = false;
      // Consumed either way. An id that has been through capture must never be
      // presented again.
      currentOrderId.current = null;
      /*
       * The spinner is cleared here whatever happened above. If some path ever
       * returns without setting a terminal phase, the buyer gets an error they
       * can act on rather than a spinner that never stops.
       */
      if (!settled) {
        ppBrowserDiag('capture.unsettled');
        setPhase('error');
        setMessage(
          'We could not confirm your payment. Please refresh and check your billing page.',
        );
      }
    }
  }, []);

  useEffect(() => {
    let disposed = false;
    const container = host.current;

    loadSdk(clientId)
      .then(() => {
        if (disposed || !container || !window.paypal) return;
        /*
         * `.render()` APPENDS. Emptying first means that even if this effect
         * somehow runs twice, the container holds exactly one button rather
         * than two stacked ones.
         */
        container.replaceChildren();
        setPhase('ready');

        const instance = window.paypal.Buttons({
          fundingSource: window.paypal.FUNDING?.PAYPAL,
          // 'pay', never 'subscribe' — the label must match what happens.
          style: { layout: 'vertical', label: 'pay', height: 44 },

          createOrder: async () => {
            setPhase('paying');
            setMessage('');
            // Clear FIRST: a failed create must not leave the previous id
            // behind for a later approval to pick up.
            currentOrderId.current = null;
            // The server decides the amount. We send a product, not a price.
            const result = await createPayPalOrderAction(tier, interval);
            if (!result.ok || !result.orderId) {
              throw new Error(result.error ?? 'order_failed');
            }
            currentOrderId.current = result.orderId;
            ppBrowserDiag('order.created', { orderIdLength: result.orderId.length });
            return result.orderId;
          },

          onApprove: (data: { orderID?: string }) => handleApprove(data?.orderID),

          onCancel: () => {
            currentOrderId.current = null;
            setPhase('ready');
            setMessage('Payment cancelled. Nothing has been charged.');
          },

          onError: () => {
            currentOrderId.current = null;
            setPhase('error');
            setMessage('PayPal could not complete this payment. Nothing has been charged.');
          },
        });

        instanceRef.current = instance;
        instance.render(container).catch(() => {
          if (!disposed) {
            setPhase('error');
            setMessage('The PayPal button could not be displayed.');
          }
        });
      })
      .catch(() => {
        if (!disposed) {
          setPhase('error');
          setMessage('PayPal could not be reached. Please try again shortly.');
        }
      });

    return () => {
      disposed = true;
      /*
       * Actually tear the instance down. Previously this only set a flag, so
       * the old button stayed in the DOM and stayed clickable — which is how a
       * buyer ended up clicking a button whose callbacks had been abandoned.
       */
      try {
        instanceRef.current?.close?.();
      } catch {
        // close() throws if PayPal already tore its own iframe down. Not a
        // failure — the container is emptied below either way.
      }
      instanceRef.current = null;
      container?.replaceChildren();
    };
    // `onPaid` is deliberately absent: it lives in a ref. Including it re-ran
    // this effect on every parent render and rendered a second button.
  }, [clientId, tier, interval, handleApprove]);

  const busy = phase === 'loading' || phase === 'confirming';

  return (
    <div className="space-y-2">
      <p className="text-center text-xs text-muted-foreground">
        Pay with PayPal — {days} days access. No automatic renewal.
      </p>

      {/* Hidden rather than unmounted once paid, so PayPal's iframe is never
          torn out from under itself mid-flow. */}
      <div ref={host} data-testid="paypal-button-host" hidden={phase === 'paid'} />

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
