'use client';

/**
 * The position-size calculator interface.
 *
 * A SMALL CLIENT ISLAND ON A SERVER-RENDERED PAGE. Only the inputs and the
 * result need interactivity; the explanation, the formula, the worked example
 * and the structured data are rendered on the server, so a crawler sees the
 * whole page without executing anything, and the JavaScript cost is a form
 * rather than a document.
 *
 * IT COMPUTES ON EVERY KEYSTROKE, with no submit button and no result gate.
 * The funnel is "useful answer first, account later" — a calculator that asks
 * for an email before showing a number is the thing people leave.
 *
 * ERRORS ARE NAMED, NOT SWALLOWED. `calculatePositionSize` returns a typed
 * refusal rather than `Infinity`, and each one maps to a sentence saying which
 * field is wrong.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Info } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';
import type { CalculatorId } from '@/lib/analytics';
import {
  calculatePositionSize,
  pipsToPrice,
  roundLotsDown,
  type PositionSizeError,
} from '../position-size';
import { INSTRUMENTS, type Instrument } from '../instruments';

const MESSAGES: Record<PositionSizeError, string> = {
  balance_invalid: 'Enter an account balance greater than zero.',
  risk_invalid: 'Risk must be greater than 0% and no more than 100%.',
  stop_invalid: 'Enter a stop distance greater than zero.',
  contract_invalid: 'Enter a contract size greater than zero.',
};

type StopUnit = 'price' | 'pips';

const money = (value: number, currency: string) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);

export function PositionSizeForm({
  /** Fixes the calculator to one instrument (the XAUUSD page does this). */
  lockedInstrument,
}: {
  lockedInstrument?: Instrument;
}) {
  /*
   * The gold page is a different search intent from the generic one, so it
   * reports as a different calculator. This id is the ONLY thing about this
   * form that is ever sent — never a balance, a risk percentage, a stop
   * distance or a resulting size.
   */
  const calculatorId: CalculatorId =
    lockedInstrument?.id === 'xauusd' ? 'xauusd_lot_size' : 'position_size';
  const id = useId();
  const [instrumentId, setInstrumentId] = useState(lockedInstrument?.id ?? 'eurusd');
  const [balance, setBalance] = useState('10000');
  const [riskPercent, setRiskPercent] = useState('1');
  const [stop, setStop] = useState(lockedInstrument?.id === 'xauusd' ? '5' : '20');
  const [stopUnit, setStopUnit] = useState<StopUnit>(
    lockedInstrument?.id === 'xauusd' ? 'price' : 'pips',
  );

  const instrument =
    lockedInstrument ?? INSTRUMENTS.find((i) => i.id === instrumentId) ?? INSTRUMENTS[0]!;

  const outcome = useMemo(() => {
    const stopValue = Number(stop);
    const stopDistance =
      stopUnit === 'pips' ? pipsToPrice(stopValue, instrument.pipSize) : stopValue;
    return calculatePositionSize({
      balance: Number(balance),
      riskPercent: Number(riskPercent),
      stopDistance,
      contractSize: instrument.contractSize,
    });
  }, [balance, riskPercent, stop, stopUnit, instrument]);

  /*
   * ANALYTICS. Read the shape of this carefully: what is reported is that a
   * calculation happened and which calculator it was. The inputs are a
   * stranger's real account size and real risk appetite, and they never leave
   * the browser.
   *
   * `started` fires once per mount, on the first edit — not on every keystroke,
   * which would turn one session into hundreds of events.
   */
  const startedRef = useRef(false);
  const markStarted = () => {
    if (startedRef.current) return;
    startedRef.current = true;
    trackEvent('calculator_started', { calculator: calculatorId });
  };

  /*
   * Completion is reported per DISTINCT outcome, not per render. Typing "20"
   * passes through "2", and each intermediate value is a valid result; keyed on
   * the outcome shape, a burst of typing reports once it settles rather than
   * once per character.
   */
  const lastReported = useRef<string>('');
  useEffect(() => {
    const key = outcome.ok ? `ok:${outcome.result.lots.toFixed(4)}` : `err:${outcome.error}`;
    if (key === lastReported.current) return;
    lastReported.current = key;
    // Only after a real interaction; the default state is not an achievement.
    if (!startedRef.current) return;
    if (outcome.ok) trackEvent('calculator_completed', { calculator: calculatorId });
    else trackEvent('calculator_rejected', { calculator: calculatorId, reason: outcome.error });
  }, [outcome, calculatorId]);

  const field =
    'h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {!lockedInstrument ? (
          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor={`${id}-instrument`} className="block text-sm font-medium">
              Instrument
            </label>
            <select
              id={`${id}-instrument`}
              value={instrumentId}
              onChange={(e) => {
                markStarted();
                setInstrumentId(e.target.value);
              }}
              className={field}
            >
              {INSTRUMENTS.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.symbol} — {i.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <label htmlFor={`${id}-balance`} className="block text-sm font-medium">
            Account balance ({instrument.quoteCurrency})
          </label>
          <input
            id={`${id}-balance`}
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={balance}
            onChange={(e) => {
              markStarted();
              setBalance(e.target.value);
            }}
            className={field}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor={`${id}-risk`} className="block text-sm font-medium">
            Risk per trade (%)
          </label>
          <input
            id={`${id}-risk`}
            type="number"
            inputMode="decimal"
            min="0"
            max="100"
            step="any"
            value={riskPercent}
            onChange={(e) => {
              markStarted();
              setRiskPercent(e.target.value);
            }}
            className={field}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor={`${id}-stop`} className="block text-sm font-medium">
            Stop distance
          </label>
          <input
            id={`${id}-stop`}
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={stop}
            onChange={(e) => {
              markStarted();
              setStop(e.target.value);
            }}
            className={field}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor={`${id}-unit`} className="block text-sm font-medium">
            Stop measured in
          </label>
          <select
            id={`${id}-unit`}
            value={stopUnit}
            onChange={(e) => {
              markStarted();
              setStopUnit(e.target.value as StopUnit);
            }}
            className={field}
          >
            <option value="pips">{instrument.pipLabel}</option>
            <option value="price">Price ({instrument.quoteCurrency})</option>
          </select>
        </div>
      </div>

      {/* `aria-live` so the answer is announced as it changes, not just drawn. */}
      <div className="mt-5 border-t border-border pt-5" aria-live="polite">
        {outcome.ok ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm text-muted-foreground">Position size</span>
              <span className="font-display text-3xl font-semibold tabular-nums text-primary">
                {roundLotsDown(outcome.result.lots).toFixed(2)} lots
              </span>
            </div>
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <div className="flex justify-between gap-4 border-b border-border/60 py-1">
                <dt className="text-muted-foreground">Money at risk</dt>
                <dd className="font-medium tabular-nums">
                  {money(outcome.result.riskAmount, instrument.quoteCurrency)}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-border/60 py-1">
                <dt className="text-muted-foreground">Loss per 1.00 lot</dt>
                <dd className="font-medium tabular-nums">
                  {money(outcome.result.lossPerLot, instrument.quoteCurrency)}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-border/60 py-1">
                <dt className="text-muted-foreground">Units</dt>
                <dd className="font-medium tabular-nums">
                  {Math.round(roundLotsDown(outcome.result.lots) * instrument.contractSize)}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-border/60 py-1">
                <dt className="text-muted-foreground">Exact (unrounded)</dt>
                <dd className="font-medium tabular-nums">{outcome.result.lots.toFixed(4)} lots</dd>
              </div>
            </dl>
            <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Rounded <strong className="font-medium">down</strong> to 0.01 lots — rounding up would
              risk more than the {riskPercent}% you asked for. Excludes spread, commission and swap.
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
