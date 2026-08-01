/**
 * Shape of the PayPal JS SDK's browser global.
 *
 * Declared ONCE, here, rather than inside a component. It used to live in
 * paypal-button.tsx — which is on the deletion list once Subscriptions is
 * removed — so the Orders button would have lost its typing to an unrelated
 * cleanup. A shared declaration cannot be duplicated (TypeScript rejects two
 * `declare global` blocks for the same member), so this file is the only place
 * it may appear.
 */
export {};

declare global {
  interface Window {
    paypal?: {
      FUNDING?: Record<string, string>;
      Buttons: (opts: Record<string, unknown>) => {
        render: (el: HTMLElement) => Promise<void>;
        close?: () => void;
      };
    };
  }
}
