'use client';

/**
 * Risk/reward calculator interface.
 *
 * IT LEADS WITH THE BREAKEVEN WIN RATE, not the ratio. "3:1" is a number;
 * "you need to be right 25% of the time" is the thing that changes a decision,
 * and it is plain arithmetic rather than advice — it says what the ratio
 * requires, never whether the trade is worth taking.
 */
import { useId, useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import { calculateRiskReward, type RiskRewardError } from '../risk-reward';

const MESSAGES: Record<RiskRewardError, string> = {
  inputs_invalid: 'Enter a positive number for entry, stop and target.',
  stop_equals_entry: 'The stop cannot be the same price as the entry.',
  direction_mismatch:
    'The target is on the same side as the stop. For a long, the target sits above entry; for a short, below.',
};

export function RiskRewardForm() {
  const id = useId();
  const [entry, setEntry] = useState('2000');
  const [stop, setStop] = useState('1990');
  const [target, setTarget] = useState('2030');

  const outcome = useMemo(
    () => calculateRiskReward({ entry: Number(entry), stop: Number(stop), target: Number(target) }),
    [entry, stop, target],
  );

  const field =
    'h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  const inputs: [string, string, (v: string) => void][] = [
    ['Entry price', entry, setEntry],
    ['Stop price', stop, setStop],
    ['Target price', target, setTarget],
  ];

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {inputs.map(([label, value, set], index) => (
          <div key={label} className="space-y-1.5">
            <label htmlFor={`${id}-${index}`} className="block text-sm font-medium">
              {label}
            </label>
            <input
              id={`${id}-${index}`}
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={value}
              onChange={(e) => set(e.target.value)}
              className={field}
            />
          </div>
        ))}
      </div>

      <div className="mt-5 border-t border-border pt-5" aria-live="polite">
        {outcome.ok ? (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">
                  Risk / reward
                </p>
                <p className="mt-1 font-display text-3xl font-semibold tabular-nums text-primary">
                  {outcome.result.ratio.toFixed(2)} : 1
                </p>
              </div>
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">
                  Breakeven win rate
                </p>
                <p className="mt-1 font-display text-3xl font-semibold tabular-nums">
                  {(outcome.result.breakevenWinRate * 100).toFixed(1)}%
                </p>
              </div>
            </div>
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
              <div className="flex justify-between gap-4 border-b border-border/60 py-1">
                <dt className="text-muted-foreground">Direction</dt>
                <dd className="font-medium capitalize">{outcome.result.direction}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-border/60 py-1">
                <dt className="text-muted-foreground">Risk</dt>
                <dd className="font-medium tabular-nums">{outcome.result.risk}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-border/60 py-1">
                <dt className="text-muted-foreground">Reward</dt>
                <dd className="font-medium tabular-nums">{outcome.result.reward}</dd>
              </div>
            </dl>
            <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              The breakeven rate is a <strong className="font-medium">floor</strong>: spread,
              commission and swap all raise the win rate actually required.
            </p>
          </div>
        ) : (
          <p role="alert" className="text-sm font-medium text-destructive">
            {MESSAGES[outcome.error]}
          </p>
        )}
      </div>
    </div>
  );
}
