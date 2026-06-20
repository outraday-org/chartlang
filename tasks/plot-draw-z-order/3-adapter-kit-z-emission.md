# Tier 3 (contract): `z` on Emissions + Validation

> **Status: TODO**

## Goal

Add the presentation-only `z?: number` field to the **wire** types
`PlotEmission` and `DrawingEmission`, and validate it in
`validateEmission` as a finite number (reject NaN/±Infinity). This is
the adapter-facing contract the runtime writes (Task 4) and the adapter
reads (Task 5). Mirror the existing `xShift` field exactly, except `z`
allows fractional values.

## Prerequisites

- Task 2 (core `z` option exists on `PlotOpts` / draw options).

## Current Behavior

- `packages/adapter-kit/src/types.ts:491` `PlotEmission` carries
  `…pane`, `visible?`, and the presentation-only `xShift?: number`
  (≈line 529, validated as a signed integer). No `z`.
- `packages/adapter-kit/src/types.ts:647` `DrawingEmission`:
  ```ts
  export type DrawingEmission = {
      readonly kind: "drawing";
      readonly handleId: string;
      readonly drawingKind: DrawingKind;
      readonly op: "create" | "update" | "remove";
      readonly state: DrawingState;
      readonly bar: number;
      readonly time: number;
  };
  ```
  No `z`.
- `packages/adapter-kit/src/validation/validateEmission.ts` validates
  emission fields, including the `xShift` integer check — the sibling
  pattern to follow.

## Desired Behavior

- `PlotEmission.z?: number` and `DrawingEmission.z?: number`, both
  optional and presentation-only, documented as omitted ⇒ `0` ⇒
  byte-identical to a pre-feature emission.
- `validateEmission` rejects a `z` that is present but not a **finite
  number** (NaN, `Infinity`, `-Infinity`, or non-number) with a clear
  diagnostic; accepts any finite number including fractions and
  negatives; treats omitted as valid.

## Requirements

### 1. `PlotEmission.z?` field

Add after `xShift?` in `PlotEmission`:

```ts
/**
 * Presentation-only render-order key (z-index). Omitted (or `0`) ⇒ no
 * explicit order, so the emission is byte-identical to a plot that
 * never carried the field. Higher `z` renders on top; lower (incl.
 * negative) renders behind. Adapters MUST compute a stable global
 * order keyed on `(z ?? 0, groupBand, declarationSeq)` — a plot with
 * `z` below a drawing's `z` renders beneath that drawing, crossing the
 * default plots-under-drawings band. Any finite number (fractional
 * allowed); `validateEmission` rejects NaN / ±Infinity. Affects only
 * stacking — `value`, `xShift`, alerts, and `state.*` are unaffected.
 *
 * @since 1.4
 * @stable
 * @example
 *     const behind: PlotEmission["z"] = -1;
 *     void behind;
 */
readonly z?: number;
```

### 2. `DrawingEmission.z?` field

Add `z?: number` to `DrawingEmission` with parallel JSDoc (note a
negative `z` lets a drawing render **below** plots). Keep field ordering
consistent with the type's existing style.

> **Dedup interaction:** drawings dedup per `(handleId, bar)`
> last-write-wins. `z` is part of the latest state like any other field;
> a `create` then `update` that changes `z` takes the updated value.
> Document this in the JSDoc if non-obvious.

### 3. `validateEmission` — finite-number check

In `packages/adapter-kit/src/validation/validateEmission.ts`, add a
`z` check sibling to the `xShift` check, for **both** plot and drawing
emissions:

- If `z` is `undefined` → valid (skip).
- If `z` is present and `!Number.isFinite(z)` → invalid; push a
  diagnostic via the existing `bad()` helper (code `"malformed-emission"`)
  matching the actual message style — the `xShift` check reads
  `bad("plot.xShift: must be an integer")`, so use
  `bad("plot.z: must be a finite number")` /
  `bad("drawing.z: must be a finite number")`. The plot check belongs in
  `validatePlotEmission`, the drawing check in `validateDrawingEmission`.
- Fractional and negative finite values → valid (unlike `xShift`, do
  **not** require an integer).

### 4. Tests (co-located)

Extend the validateEmission test suite:
- Plot/drawing with omitted `z` → valid.
- `z: 0`, `z: 2.5`, `z: -3` → valid.
- `z: NaN`, `z: Infinity`, `z: -Infinity`, `z: "1"` (cast) → invalid
  with the expected diagnostic.
- Round-trip: a `z`-bearing emission survives any clone/transfer helper
  the adapter-kit exposes (if `xShift` has such a test, mirror it).

### 5. Edge cases / invariants

- **Byte-identity:** adapter-kit has no serialization/golden test for
  emissions (the byte-identity claim for `xShift` lives only in JSDoc at
  `types.ts`, not in a test). Add a focused unit assertion that an
  emission built without `z` has no `z` own-key (`expect("z" in e).toBe(false)`
  / `Object.keys`) so a stray `z: undefined` cannot leak onto the wire.
- Keep `DrawingKind` / `DrawingState` untouched; `z` is a top-level
  emission field, not part of drawing state geometry.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/adapter-kit/src/types.ts` | Modify | `z?` on `PlotEmission` + `DrawingEmission` |
| `packages/adapter-kit/src/validation/validateEmission.ts` | Modify | Finite-number `z` validation (plot + drawing) |
| `packages/adapter-kit/src/validation/validateEmission.test.ts` | Modify | Valid/invalid `z` cases + byte-identity |
| `.changeset/plot-draw-z-order.md` | Modify | Append `@invinite-org/chartlang-adapter-kit: minor` |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (coverage 100% on `packages/adapter-kit`)
- `pnpm docs:check` (JSDoc on new fields)

## Changeset

Append to `.changeset/plot-draw-z-order.md`:

```
"@invinite-org/chartlang-adapter-kit": minor
```

and extend the body to mention the wire field + validation.

## Acceptance Criteria

- `PlotEmission.z?` and `DrawingEmission.z?` exist with full JSDoc.
- `validateEmission` accepts finite (incl. fractional/negative) `z` and
  rejects non-finite/non-number `z` for both emission kinds, with tests.
- Omitted `z` produces a byte-identical emission (no `z` key on the
  wire); confirmed by test.
- 100% coverage on `packages/adapter-kit`; doc gate green.
- Changeset updated with the adapter-kit bump.
- (`packages/adapter-kit` has **no** `CLAUDE.md` and is not listed in the
  root `CLAUDE.md` per-package index — do **not** create one just for
  this field; the wire-field contract is documented in
  `docs/spec/emissions.md` in Task 8.)
