# Adapter-kit candle wire contract (`candle` / `ohlc-bar` styles)

> **Status: TODO**

## Goal

Add the two value-carrying plot styles to the adapter-kit wire contract:
the `PlotStyle` union members `kind: "candle"` and `kind: "ohlc-bar"`,
their `PlotKind` capability entries, and their `validateEmission` arms.
This is the lowest layer — runtime (Task 6) and the reference adapter
(Task 7) both depend on it.

## Prerequisites

None.

## Current Behavior

`packages/adapter-kit/src/types.ts` defines the wire `PlotStyle` union.
`candle-override` (bull/bear/doji colors) and `bar-override` (a single
color) exist but carry **no per-bar OHLC values** — they only recolor
the primary candles. The multi-value precedent is `filled-band`, which
carries `upper` / `lower` numerics in the style and is validated by
`validateFilledBandStyle` in
`packages/adapter-kit/src/validation/validateEmission.ts`.

## Desired Behavior

Two new wire styles carry a full per-bar OHLC quad plus colors, so an
adapter can render a **derived** candle / bar series:

```ts
| {
      readonly kind: "candle";
      readonly open: number | null;
      readonly high: number | null;
      readonly low: number | null;
      readonly close: number | null;
      readonly bull: Color;
      readonly bear: Color;
      readonly doji?: Color;
      readonly wickColor?: Color;
      readonly borderColor?: Color;
  }
| {
      readonly kind: "ohlc-bar";
      readonly open: number | null;
      readonly high: number | null;
      readonly low: number | null;
      readonly close: number | null;
      readonly color: Color;
      readonly upColor?: Color;   // close ≥ open
      readonly downColor?: Color; // close < open
  }
```

## Requirements

### 1. `PlotStyle` union (`packages/adapter-kit/src/types.ts`)

Add the two members above, adjacent to the existing `candle-override` /
`bar-override` / `filled-band` arms (search `"filled-band"` around line
426 and `"candle-override"` around line 474). Keep the `Color` type
import already used by the sibling arms.

### 2. `PlotKind` capability enum (`packages/adapter-kit/src/types.ts`)

Add `"candle"` and `"ohlc-bar"` to the `PlotKind` union that
`Capabilities.plots: Set<PlotKind>` ranges over (the same list
`candle-override` / `bar-override` belong to). An adapter that does not
list them renders these plots as a silent no-op (Task 6 gate).

### 3. Validation arms (`.../validation/validateEmission.ts`)

Add `validateCandleStyle` + `validateOhlcBarStyle`, wired into the
`validatePlotStyle` switch (mirror `validateFilledBandStyle`, ~line
257). The **OHLC-quad invariant** (shared helper — do not duplicate):

- Each of `open` / `high` / `low` / `close` must be a finite number or
  `null`.
- **All four `null`** ⇒ valid (a gap bar — the adapter draws nothing).
- **A mix of finite and `null`** ⇒ `bad("style.{open,high,low,close}:
  all four must be finite together or all null")` (a half-specified
  candle is malformed).
- Colors (`bull` / `bear` / `color`, plus optional `doji` / `wickColor`
  / `borderColor` / `upColor` / `downColor`): validated as color strings
  via the existing color-validation helper used by `candle-override`.

Factor the finite-or-null-quad check into one helper both arms call.

### 4. Wire type test (`packages/adapter-kit/src/*.types.test.ts`)

Extend the emission type tests: a `candle` / `ohlc-bar` style is
assignable to `PlotStyle` and to `PlotEmission.style`; `PlotKind`
includes both. Add unit tests for `validateCandleStyle` /
`validateOhlcBarStyle` covering: all-finite (ok), all-null (ok),
mixed-null (bad), non-finite value (bad), bad color (bad).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/adapter-kit/src/types.ts` | Modify | 2 `PlotStyle` members + 2 `PlotKind` entries |
| `packages/adapter-kit/src/validation/validateEmission.ts` | Modify | 2 validation arms + shared quad helper |
| `packages/adapter-kit/src/validation/*.test.ts` | Modify | validation unit tests |
| `packages/adapter-kit/src/*.types.test.ts` | Modify | wire type assignability tests |

## Gates

- `pnpm typecheck`, `pnpm lint`
- `pnpm test` (adapter-kit 100% coverage — every validation branch)
- `pnpm docs:check` (if any exported symbol gains/loses JSDoc)

## Changeset

`.changeset/adapter-kit-candle-styles.md` —
`"@invinite-org/chartlang-adapter-kit": minor`. Body: "Add
value-carrying `candle` / `ohlc-bar` plot styles + validation for custom
OHLC candle-series rendering."

## Acceptance Criteria

- `PlotStyle` carries `candle` + `ohlc-bar` with the OHLC quad; `PlotKind`
  includes both.
- `validateEmission` enforces the finite-or-null-quad invariant (all
  four together or all null; a mix is malformed) via one shared helper,
  plus color validation.
- Validation branch coverage 100%; type tests green; changeset committed.
- No existing wire type changes (additive union members only).
