'use client';

/**
 * Thin wrapper mounting the coach on the 9.6 trade detail. Appears inline where
 * the user already is — never a modal or floating bot.
 */
import { ReviewPanel } from './review-panel';

export function TradeReviewPanel({ tradeId }: { tradeId: string }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <ReviewPanel scope="trade" targetId={tradeId} title="AI trade review" />
    </div>
  );
}
