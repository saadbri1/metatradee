/**
 * Server-authoritative derived-trade-field computation. This is the SINGLE
 * source of truth for PnL / Net PnL / RR / duration — used by manual trade
 * writes AND (later) the import engine, so imported and manual trades produce
 * identical numbers. Pure + unit-tested. Money is rounded half-up to 2 decimals.
 *
 * Formulas
 *   gross pnl   = (direction === 'buy' ? exit - entry : entry - exit) * quantity
 *   net pnl     = gross - (commission + swap + fees)
 *   risk        = risk_amount, else |entry - stop_loss| * quantity  (if available)
 *   reward val  = reward,      else |take_profit - entry| * quantity (if available)
 *   rr_ratio    = reward_val / risk   (when risk > 0)
 *   duration    = floor((closed_at - opened_at) / 1000) seconds
 * Any field whose inputs are missing resolves to null (never a fabricated 0).
 */
import type { Direction } from './enums';

export interface DerivedInputs {
  direction: Direction;
  entry_price?: number | null;
  exit_price?: number | null;
  quantity?: number | null;
  stop_loss?: number | null;
  take_profit?: number | null;
  risk_amount?: number | null;
  reward?: number | null;
  commission?: number | null;
  swap?: number | null;
  fees?: number | null;
  opened_at?: string | null;
  closed_at?: string | null;
}

export interface DerivedFields {
  pnl: number | null;
  net_pnl: number | null;
  rr_ratio: number | null;
  duration_seconds: number | null;
}

/** Round half-up to 2 decimals, guarding float error. */
export function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function isNum(v: number | null | undefined): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

export function computeDerivedTradeFields(t: DerivedInputs): DerivedFields {
  const commission = isNum(t.commission) ? t.commission : 0;
  const swap = isNum(t.swap) ? t.swap : 0;
  const fees = isNum(t.fees) ? t.fees : 0;

  // Gross + net PnL.
  let pnl: number | null = null;
  let net_pnl: number | null = null;
  if (isNum(t.entry_price) && isNum(t.exit_price) && isNum(t.quantity)) {
    const gross =
      (t.direction === 'buy' ? t.exit_price - t.entry_price : t.entry_price - t.exit_price) *
      t.quantity;
    pnl = roundMoney(gross);
    net_pnl = roundMoney(gross - (commission + swap + fees));
  }

  // Risk / reward → RR.
  let risk: number | null = isNum(t.risk_amount) ? t.risk_amount : null;
  if (risk === null && isNum(t.entry_price) && isNum(t.stop_loss) && isNum(t.quantity)) {
    risk = Math.abs(t.entry_price - t.stop_loss) * t.quantity;
  }
  let rewardVal: number | null = isNum(t.reward) ? t.reward : null;
  if (rewardVal === null && isNum(t.entry_price) && isNum(t.take_profit) && isNum(t.quantity)) {
    rewardVal = Math.abs(t.take_profit - t.entry_price) * t.quantity;
  }
  const rr_ratio = isNum(risk) && risk > 0 && isNum(rewardVal) ? round2(rewardVal / risk) : null;

  // Duration.
  let duration_seconds: number | null = null;
  if (t.opened_at && t.closed_at) {
    const open = Date.parse(t.opened_at);
    const close = Date.parse(t.closed_at);
    if (Number.isFinite(open) && Number.isFinite(close) && close >= open) {
      duration_seconds = Math.floor((close - open) / 1000);
    }
  }

  return { pnl, net_pnl, rr_ratio, duration_seconds };
}
