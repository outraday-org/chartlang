# Adapter-kit candle wire contract (`candle` / `ohlc-bar` styles)

> **Status: TODO**

## Goal

Add the two value-carrying plot styles to the wire contract: the two
new `PlotKind` union members in **core** (where the union actually
lives), the adapter-kit `PlotStyle` union members `kind: "candle"` and
`kind: "ohlc-bar"`, and their `validateEmission` arms. This is the
lowest layer — runtime (Task 6) and the reference adapter (Task 7)
both depend on it.

## Prerequisites

None.

## Current Behavior

`packages/adapter-kit/src/types.ts` defines the wire `PlotStyle` union;
the `PlotKind` discriminator union itself lives in
`packages/core/src/plot/plot.ts:30` and adapter-kit re-exports it
(`types.ts:95`). `candle-override` (bull/bear/doji colors) and
`bar-override` (a single color) exist but carry **no per-bar OHLC
values** — they only recolor the primary candles. The multi-value
precedent is `filled-band`, which carries `upper` / `lower` numerics in
the style and is validated by `validateFilledBandStyle` in
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

### 1. `PlotKind` union (`packages/core/src/plot/plot.ts:30`)

The `PlotKind` string-literal union lives in **core** — adapter-kit
only re-exports it (`packages/adapter-kit/src/types.ts:95` is
`export type PlotKind = CorePlotKind;`, imported at line 12).
`Capabilities.plots: ReadonlySet<PlotKind>` (`types.ts:271`) ranges
over it. Add `"candle"` and `"ohlc-bar"` to the core union and update
its JSDoc inventory prose (the "full 0.5 inventory is …" list —
every expansion is additive per the same JSDoc). An adapter that does
not list them renders these plots as a silent no-op (Task 6 gate).

Two lockstep guards:

- The adapter-kit type test
  (`packages/adapter-kit/src/types.types.test.ts:82-84`) pins
  `PlotStyle["kind"]` ≡ `PlotKind` — so the core union members and the
  adapter-kit `PlotStyle` arms (step 2) MUST land together.
- Do **NOT** append the new kinds to `PHASE_5_PLOT_KINDS`
  (`packages/adapter-kit/src/capabilities/capabilities.ts:22-39`). It
  is the frozen `@stable` Phase-5 inventory pinned by
  `capabilities.test.ts:44`; appending would silently opt every
  `allPhase5Plots()` adapter into kinds it has no render code for.
  Adapters opt in individually (Task 7 does for canvas2d).
- Core JSDoc changed ⇒ regenerate the hover registry
  (`pnpm gen-hover-registry`, commit
  `packages/language-service/src/hoverRegistry.generated.ts`;
  `pnpm hover:check` gates it).

### 2. `PlotStyle` union (`packages/adapter-kit/src/types.ts`)

Add the two members above, adjacent to the existing `candle-override` /
`bar-override` / `filled-band` arms (`"filled-band"` at lines 427-431,
`"candle-override"` at 475-479). Keep the `Color` type import already
used by the sibling arms (`Color` is core's plain-string alias,
imported at `types.ts:7`).

### 3. Validation arms (`.../validation/validateEmission.ts`)

Add `validateCandleStyle` + `validateOhlcBarStyle`, wired into the
`validatePlotStyle` switch (mirror `validateFilledBandStyle`, lines
257-274). The **OHLC-quad invariant** (shared helper — do not
duplicate):

- Each of `open` / `high` / `low` / `close` must be a finite number or
  `null` (`isFiniteNumber` is the existing finite check).
- **All four `null`** ⇒ valid (a gap bar — the adapter draws nothing).
- **A mix of finite and `null`** ⇒ `bad("style.{open,high,low,close}:
  all four must be finite together or all null")` — `bad(message,
  code = "malformed-emission")` is the existing helper at line 156.
- Colors (`bull` / `bear` / `color`, plus optional `doji` / `wickColor`
  / `borderColor` / `upColor` / `downColor`): validated via the
  existing `validateColor(value, path)` helper (lines 350-355 — the
  same one `validateCandleOverrideStyle` uses at 357-366).

Factor the finite-or-null-quad check into one helper both arms call.

### 3b. `packages/adapter-kit/CLAUDE.md`

Add a short wire-invariant bullet documenting the value-carrying
`candle` / `ohlc-bar` styles: the OHLC quad lives inside the style
object (the `filled-band` multi-value precedent), the
all-four-finite-or-all-null rule, and that `PlotEmission.value` stays
single-channel (`close ?? null`, resolved in Task 6). Per the root
`CLAUDE.md` rule, a behavior change in a folder updates that folder's
`CLAUDE.md` in the same PR.

### 4. Wire type test (`packages/adapter-kit/src/*.types.test.ts`)

Extend the emission type tests: a `candle` / `ohlc-bar` style is
assignable to `PlotStyle` and to `PlotEmission.style`; `PlotKind`
includes both. Add unit tests for `validateCandleStyle` /
`validateOhlcBarStyle` covering: all-finite (ok), all-null (ok),
mixed-null (bad), non-finite value (bad), bad color (bad).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/plot/plot.ts` | Modify | 2 `PlotKind` union members + JSDoc inventory prose |
| `packages/adapter-kit/src/types.ts` | Modify | 2 `PlotStyle` members |
| `packages/adapter-kit/src/validation/validateEmission.ts` | Modify | 2 validation arms + shared quad helper |
| `packages/adapter-kit/src/validation/*.test.ts` | Modify | validation unit tests |
| `packages/adapter-kit/src/*.types.test.ts` | Modify | wire type assignability tests |
| `packages/adapter-kit/CLAUDE.md` | Modify | wire-invariant bullet (quad rule) |
| `packages/language-service/src/hoverRegistry.generated.ts` | Generate | `pnpm gen-hover-registry` (core JSDoc changed) |

## Gates

- `pnpm typecheck`, `pnpm lint`
- `pnpm test` (adapter-kit + core 100% coverage — every validation
  branch)
- `pnpm docs:check` (core `PlotKind` JSDoc still complete)
- `pnpm hover:check` (regenerated hover registry committed)

## Changeset

`.changeset/adapter-kit-candle-styles.md` —
`"@invinite-org/chartlang-adapter-kit": minor`,
`"@invinite-org/chartlang-core": minor` (`PlotKind` members),
`"@invinite-org/chartlang-language-service": patch` (hover regen).
Body: "Add value-carrying `candle` / `ohlc-bar` plot styles + validation
for custom OHLC candle-series rendering."

## Acceptance Criteria

- Core `PlotKind` carries both new kinds; adapter-kit `PlotStyle`
  carries `candle` + `ohlc-bar` with the OHLC quad; the
  `PlotStyle["kind"]` ≡ `PlotKind` type test stays green.
- `PHASE_5_PLOT_KINDS` untouched (frozen Phase-5 inventory).
- `validateEmission` enforces the finite-or-null-quad invariant (all
  four together or all null; a mix is malformed) via one shared helper,
  plus `validateColor` on every color field.
- Validation branch coverage 100%; type tests green; adapter-kit
  `CLAUDE.md` bullet added; hover registry regenerated; changeset
  committed.
- No existing wire type changes (additive union members only).
