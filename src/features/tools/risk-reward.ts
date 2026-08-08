/**
 * Risk/reward and the win rate it implies. PURE.
 *
 * THE SECOND NUMBER IS THE USEFUL ONE. A ratio on its own invites the wrong
 * conclusion — "3:1 is good" — when what decides whether a setup is worth
 * taking is the win rate it needs to break even:
 *
 *     breakeven win rate = risk ÷ (risk + reward) = 1 ÷ (1 + R)
 *
 * A 3:1 setup breaks even at 25%. Showing that alongside the ratio is the
 * difference between a number and a decision, and it is arithmetic rather than
 * advice — it says what the ratio requires, never whether to take the trade.
 *
 * Costs are excluded: spread, commission and swap all raise the real breakeven,
 * so the figure returned here is a FLOOR. The page says so.
 */

export interface RiskRewardInput {
  entry: number;
  stop: number;
  target: number;
}

export type RiskRewardError = 'inputs_invalid' | 'stop_equals_entry' | 'direction_mismatch';

export interface RiskRewardResult {
  /** Price distance from entry to stop. Always positive. */
  risk: number;
  /** Price distance from entry to target. Always positive. */
  reward: number;
  /** Reward ÷ risk. `2` means 2:1. */
  ratio: number;
  /** Fraction in [0,1) — multiply by 100 for a percentage. */
  breakevenWinRate: number;
  direction: 'long' | 'short';
}

export type RiskRewardOutcome =
  { ok: true; result: RiskRewardResult } | { ok: false; error: RiskRewardError };

export function calculateRiskReward(input: RiskRewardInput): RiskRewardOutcome {
  const { entry, stop, target } = input;

  if (![entry, stop, target].every((n) => Number.isFinite(n) && n > 0)) {
    return { ok: false, error: 'inputs_invalid' };
  }
  if (stop === entry) return { ok: false, error: 'stop_equals_entry' };

  const direction: 'long' | 'short' = stop < entry ? 'long' : 'short';

  /*
   * The target must sit on the opposite side of entry from the stop. A "long"
   * with a target below entry is a typo, not a trade, and computing a ratio
   * from it would return a confident negative number that looks like an answer.
   */
  const targetIsProfitable = direction === 'long' ? target > entry : target < entry;
  if (!targetIsProfitable) return { ok: false, error: 'direction_mismatch' };

  const risk = Math.abs(entry - stop);
  const reward = Math.abs(target - entry);
  const ratio = reward / risk;

  return {
    ok: true,
    result: { risk, reward, ratio, breakevenWinRate: risk / (risk + reward), direction },
  };
}
