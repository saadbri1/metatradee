/**
 * Candle request validation and cost limits.
 *
 * Pure module: no network, no secrets, no Next.js. The route is a thin shell
 * over this so the rules that bound COST and MEMORY are unit-testable on their
 * own — every accepted request here becomes a billed provider call.
 *
 * THREE independent limits apply, and the TIGHTEST one binds. They are not
 * redundant; each protects a different thing:
 *
 *   1. MAX_RANGE_DAYS   — wall-clock span, so a typo like 2020→2026 is refused
 *                         before anything is computed.
 *   2. MAX_OUTPUT_ROWS  — bars we return, bounding the JSON response.
 *   3. MAX_SOURCE_ROWS  — bars we must FETCH, which is the subtle one: 5m and
 *                         15m are derived from 1-minute data, so a 7-day 15m
 *                         request reads 10,080 provider rows to emit 672. If
 *                         only the output were capped, the provider's own row
 *                         limit would truncate the fetch and we would return a
 *                         short series that looks complete. Capping source rows
 *                         makes that silent-truncation case impossible.
 *
 * Consequence worth knowing: for 1m the OUTPUT cap binds first (5,000 minutes
 * ≈ 3.5 days), well before the 7-day span limit. That is intended for a first
 * version — conservative beats generous when every request costs money.
 */
import { z } from 'zod';
import { isDatedContract } from './databento/symbols';
import { TIMEFRAMES } from './databento/aggregate';
import {
  MAX_OUTPUT_ROWS,
  MAX_RANGE_DAYS,
  MAX_SOURCE_ROWS,
  SECONDS_PER_DAY,
  expectedOutputRows,
  expectedSourceRows,
} from './limits';

export {
  MAX_OUTPUT_ROWS,
  MAX_RANGE_DAYS,
  MAX_SOURCE_ROWS,
  expectedOutputRows,
  expectedSourceRows,
  sourceBarSeconds,
} from './limits';

/**
 * Query schema. `.strict()` rejects unknown parameters outright rather than
 * ignoring them — a misspelled `symbols=` must fail loudly, not quietly return
 * data for something the caller did not ask for.
 *
 * Timestamps must be explicit UTC (`...Z`). A bare local-looking datetime is
 * ambiguous, and an off-by-one-timezone range silently returns the wrong bars.
 */
export const candleQuerySchema = z
  .object({
    symbol: z
      .string()
      .refine(
        isDatedContract,
        'Symbol must be a dated futures contract for ES, MES, NQ or MNQ (for example ESZ5).',
      ),
    timeframe: z.enum(TIMEFRAMES),
    start: z
      .string()
      .datetime({ message: 'start must be an ISO 8601 UTC datetime, e.g. 2025-12-01T00:00:00Z.' }),
    end: z
      .string()
      .datetime({ message: 'end must be an ISO 8601 UTC datetime, e.g. 2025-12-01T06:00:00Z.' }),
  })
  .strict()
  .superRefine((value, ctx) => {
    const startMs = Date.parse(value.start);
    const endMs = Date.parse(value.end);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return;

    if (startMs >= endMs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['end'],
        message: 'end must be after start.',
      });
      return;
    }

    const rangeSeconds = (endMs - startMs) / 1_000;
    const timeframe = value.timeframe;

    const maxDays = MAX_RANGE_DAYS[timeframe];
    if (rangeSeconds > maxDays * SECONDS_PER_DAY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['end'],
        message: `Range too large: ${timeframe} supports at most ${maxDays} day(s) per request.`,
      });
      return;
    }

    const outputRows = expectedOutputRows(timeframe, rangeSeconds);
    if (outputRows > MAX_OUTPUT_ROWS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['end'],
        message: `Range too large: it would return about ${outputRows} candles, above the ${MAX_OUTPUT_ROWS} limit.`,
      });
      return;
    }

    const sourceRows = expectedSourceRows(timeframe, rangeSeconds);
    if (sourceRows > MAX_SOURCE_ROWS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['end'],
        message: `Range too large: ${timeframe} is derived from 1-minute data and would read about ${sourceRows} source bars, above the ${MAX_SOURCE_ROWS} limit.`,
      });
    }
  });

export type CandleQuery = z.infer<typeof candleQuerySchema>;

/** Provider row budget for a validated query — never exceeds MAX_SOURCE_ROWS. */
export function providerLimitFor(query: CandleQuery): number {
  const rangeSeconds = (Date.parse(query.end) - Date.parse(query.start)) / 1_000;
  return Math.min(expectedSourceRows(query.timeframe, rangeSeconds), MAX_SOURCE_ROWS);
}
