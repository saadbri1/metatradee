# Engineering note — suspected swap sign error in net P&L

**Status: UNCONFIRMED.** Observed by reading the code while verifying claims for
the MQL5 article on 2026-08-09. It has **not** been reproduced with a test, and
nothing here should be treated as a defect until it has been. No calculation
logic was changed when this note was written.

## Why this is isolated from the work that found it

This sits in the money path. Changing it alters `net_pnl` on existing rows and
on every future import, so it needs its own change with its own tests and its
own review — not a line edited inside a documentation pass.

## Current observed behaviour

`computeDerivedTradeFields` in `src/features/journal/derived.ts`:

```ts
net_pnl = roundMoney(gross - (commission + swap + fees));
```

The three cost terms are **subtracted**, which is correct only if each arrives as
a positive magnitude.

`src/features/journal/schemas.ts` enforces that for two of them and not the
third:

```ts
commission: nonNegative.optional().default(0),   // z.number().nonnegative()
swap:       z.number().optional().default(0),    // any sign accepted
fees:       nonNegative.optional().default(0),
```

`src/features/import/pipeline.ts` (`normalizeRow`) parses these columns with
`parseLocaleNumber` and passes the value straight to the schema. There is no
sign normalisation anywhere in the import path.

## Suspected problem

MetaTrader exports costs as **negative** numbers. Mapping a statement's `Swap`
column directly therefore appears to produce:

```
swap = −2.40   →   net_pnl = gross − (−2.40) = gross + 2.40
```

That is, a cost credited rather than debited — and silently, because the value
passes validation.

The same input shape behaves differently across the three fields, which is
itself worth resolving:

| Field      | Negative input from an MT5 export | Consequence                                        |
| ---------- | --------------------------------- | -------------------------------------------------- |
| commission | rejected by `nonNegative`         | Row captured as invalid with a reason — loud, safe |
| fees       | rejected by `nonNegative`         | Same                                               |
| swap       | accepted                          | **Suspected silent sign flip in `net_pnl`**        |

Two things follow if this reproduces. Positions held over several rollovers
would be overstated by twice the swap, and the error is invisible: no row is
flagged, and the number stays plausible. Separately, refusing a valid broker
export as "invalid" because its commission column is negative is a poor
experience even though it is the safe failure.

## Affected surface

- `src/features/journal/derived.ts` — `computeDerivedTradeFields`
- `src/features/journal/schemas.ts` — `tradeCreateSchema`, `nonNegative`
- `src/features/import/pipeline.ts` — `normalizeRow`
- Anything reading `net_pnl`: analytics KPIs, equity curve, reports, AI coach

## Tests required before calling it confirmed

1. **Reproduction.** A realistic MT5 row with `commission = −7.00` and
   `swap = −1.20`, driven through `normalizeRow` → `tradeCreateSchema` →
   `computeDerivedTradeFields`. Assert what actually happens to each field.
2. **Direction.** `net_pnl` must be strictly less than `pnl` whenever any cost is
   non-zero, under either sign convention.
3. **Positive swap is real.** A carry-positive position genuinely earns swap, so
   the fix must not clamp to a cost — `abs()` would be wrong.
4. **Both conventions.** Positive-magnitude and negative-signed inputs must reach
   the same `net_pnl`, if normalisation is the chosen fix.
5. **Existing rows.** Establish whether any stored trade already carries a
   negative swap before changing behaviour; a fix that silently reinterprets
   stored data is a migration, not a patch.

## Decisions for whoever picks this up

- Which convention is canonical: signed (broker-native) or positive magnitudes?
- Should normalisation happen at the import boundary, in the schema, or in
  `computeDerivedTradeFields`? It should happen in exactly one of them.
- Should `commission`/`fees` normalise sign rather than reject, so a broker
  export imports without hand-editing?
- Does existing data need backfilling, and is that reversible?

## Related

`docs/backlinks/mql5-r-multiple-article.md` documents the sign convention
problem generically, as advice to any reader computing R from an MT5 export. It
makes no claim about a defect in MetaTradee.
