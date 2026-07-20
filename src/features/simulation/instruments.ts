export const INSTRUMENT_ROOTS = ['ES', 'MES', 'NQ', 'MNQ'] as const;
export type InstrumentRoot = (typeof INSTRUMENT_ROOTS)[number];

export interface InstrumentSpecification {
  root: InstrumentRoot;
  tickSize: number;
  tickValue: number;
  contractMultiplier: number;
  currency: 'USD';
}

/** Static application-owned economics. UI input can never override these values. */
export const INSTRUMENT_SPECIFICATIONS: Readonly<Record<InstrumentRoot, InstrumentSpecification>> =
  Object.freeze({
    ES: Object.freeze({
      root: 'ES',
      tickSize: 0.25,
      tickValue: 12.5,
      contractMultiplier: 50,
      currency: 'USD',
    }),
    MES: Object.freeze({
      root: 'MES',
      tickSize: 0.25,
      tickValue: 1.25,
      contractMultiplier: 5,
      currency: 'USD',
    }),
    NQ: Object.freeze({
      root: 'NQ',
      tickSize: 0.25,
      tickValue: 5,
      contractMultiplier: 20,
      currency: 'USD',
    }),
    MNQ: Object.freeze({
      root: 'MNQ',
      tickSize: 0.25,
      tickValue: 0.5,
      contractMultiplier: 2,
      currency: 'USD',
    }),
  });

export function instrumentRoot(symbol: string): InstrumentRoot | null {
  const match = /^(MES|MNQ|ES|NQ)(?:[FGHJKMNQUVXZ][0-9])?$/.exec(symbol);
  return match ? (match[1] as InstrumentRoot) : null;
}

export function instrumentSpecification(symbol: string): InstrumentSpecification | null {
  const root = instrumentRoot(symbol);
  return root ? INSTRUMENT_SPECIFICATIONS[root] : null;
}

export function isTickAligned(price: number, tickSize: number): boolean {
  if (!Number.isFinite(price) || !Number.isFinite(tickSize) || tickSize <= 0) return false;
  const ticks = price / tickSize;
  return Math.abs(ticks - Math.round(ticks)) <= 1e-9;
}
