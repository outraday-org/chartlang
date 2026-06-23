# Task 4 — Design + core/adapter-kit: per-bar `colorValue` channel

> **Status: SHIPPED** — the `colorValue`-vs-alternatives product decision was
> **ratified** and Deliverable 2 was built (core hole + `PlotEmission.colorValue`
> wire field + runtime resolve + canvas2d adapter + conformance scenario).

> **Deliverable 2** (Series<Color> tier).

## Goal

Introduce a first-class, per-bar **dynamic-color value channel** so a single
`bgcolor(close > open ? color.green : color.red)` (or `barcolor(...)`, or
`plot(x, { color: cond ? green : red })`) recolors **every bar** by that
bar's evaluated color — not a static string baked once at emit time. This
task lands the **wire-shape decision** and the **adapter-kit + core type
surface** only; the runtime resolve is Task 5 and the adapters/converter are
Task 6.

The chosen shape (see README *Architecture Decisions*) is an **optional
parallel `colorValue: Color | null`** on `PlotEmission` — NOT an overload of
the numeric `value`, and NOT a new per-bar-color style arm. Omitted ⇒
byte-identical to a static-color emission, so every pinned conformance hash
holds and the wire-order invariant is preserved.

## Prerequisites

- **Product decision ratified.** The cross-layer cost (wire + validator +
  dedup + every adapter + reference renderer + converter) and the
  `colorValue` shape must be signed off. Until then this task is blocked.
- Task 1 (the `bgcolor`/`barcolor` author surface to widen).

## Current Behavior

- `PlotEmission` (`packages/adapter-kit/src/types.ts:491-530`) carries
  `value: number | null` (`:498`), a single static `color: string | null`
  (`:499`), and the optional presentation fields `visible?` (`:513`) +
  `xShift?` (`:529`). There is no per-bar color value — `color` is one value
  for the whole slot per bar, set by the runtime from `opts.color ?? null`
  (`emit/plot.ts:124`).
- `PlotStyle` (`:360-467`) `bg-color` (`:451`) / `bar-color` (`:457`) carry a
  static `color: Color` on the **style**, not a per-bar value.
- The author surface: `bgcolor(color: Color, opts?)` / `barcolor(color:
  Color, opts?)` (Task 1) and `plot(value, { color?: Color })` all take a
  single `Color` (string) — there is no `Series<Color>` author type.
- `Color = string` (`packages/core/src/types.ts:240`); there is no
  `Series<Color>` / `ColorSeries` type in core.
- The `xShift` / `visible` precedent: an optional `PlotEmission` field that
  is **omitted when at its default**, keeping no-feature emissions
  byte-identical to the pre-feature baseline (adapter-kit + runtime CLAUDE.md).

## Desired Behavior

- `PlotEmission` gains an optional `colorValue?: Color | null` field
  (appended after `xShift`, so the wire order is additive and existing
  serializations/hashes are untouched). Semantics: when present, it is the
  **per-bar** color the adapter SHOULD use, overriding the static
  `style.color` (for `bg-color`/`bar-color`) and the static top-level
  `color` (for line-family plots). `null` is the explicit "no color this
  bar" (gap); omitted is "fall back to the static color".
- The author surface accepts a per-bar color expression: the
  `bgcolor`/`barcolor` first argument and `plot`'s `opts.color` widen from
  `Color` to `Color` (unchanged ergonomics — a per-bar conditional like
  `cond ? green : red` is ALREADY a `Color`-typed expression that the runtime
  re-evaluates each step). **No author-type change may be required at all** —
  confirm during design (see Architecture note). If a true pre-computed
  `Series<Color>` input is in scope, add a `ColorSeries = Series<Color>` core
  type; otherwise defer it.
- `colorValue` is documented as orthogonal to numeric `value`: a `bg-color`
  emission still carries `value: null`, and its per-bar color rides
  `colorValue`.

## Requirements

### 1. Decide and document the wire shape (design artifact in this task file's PR)

Re-confirm the README decision with the implementer's eyes on the actual
types, and record the rejected alternatives in the adapter-kit JSDoc:

- **Chosen:** optional `colorValue?: Color | null` on `PlotEmission`.
- **Rejected — overload `value`:** `value: number | null` is load-bearing for
  alerts, y-scale inclusion, the NaN-forbidden rule, and the `plot-hash`
  tuple `{ bar, value }`. Widening it to `number | string | null` breaks
  every numeric consumer and rebreaks every pinned hash. Do not do this.
- **Rejected — a new `dynamic-color` style arm:** color-per-bar is orthogonal
  to *style*; encoding it as a style splits one concept across N arms and
  cannot recolor a `line` plot per bar.

### 2. `PlotEmission.colorValue` (`packages/adapter-kit/src/types.ts`)

Append after `xShift` (`:529`):

```ts
/**
 * Per-bar dynamic color for this emission. Omitted ⇒ the adapter uses the
 * static color (the style's `color` for `bg-color`/`bar-color`, or the
 * top-level `color` for line-family plots), so a no-dynamic-color emission
 * is byte-identical to the pre-feature wire. When present, it OVERRIDES
 * the static color for this `(slotId, bar)`; `null` is an explicit
 * "no color this bar" gap. This is orthogonal to the numeric `value`
 * (a `bg-color` emission still carries `value: null`).
 *
 * @since 1.5
 * @stable
 * @example
 *     const dyn: PlotEmission["colorValue"] = "#16a34a";
 *     void dyn;
 */
readonly colorValue?: Color | null;
```

Import `Color` into the emission's scope if not already (the file imports it
for `PlotStyle`). Update the `PlotEmission` `@example` block (`:478-489`) to
note the optional field.

### 3. Core author type (only if a `Series<Color>` input is in scope)

- If design concludes the author NEVER needs a pre-computed color series
  (the per-bar conditional scalar covers every case), **no core type change
  is needed** — the existing `Color` arg on `bgcolor`/`barcolor`/`plot`
  already accepts `cond ? green : red`. Record this conclusion.
- If a `Series<Color>` input IS in scope, add `export type ColorSeries =
  Series<Color>;` to `packages/core/src/types.ts` (mirror `PriceSeries`),
  re-export it, and widen the `bgcolor`/`barcolor` first arg + `plot`'s
  `opts.color` to `Color | ColorSeries`. Mirror in the compiler shim.
  **Default position: defer `ColorSeries`** — the per-bar scalar is the
  dominant case and keeps Deliverable 2 smaller.

### 4. Validator type-shape only (`packages/adapter-kit/src/validation/`)

This task lands only the TYPE. The runtime-side validation logic (a
`colorValue` finite-color-or-null check) is Task 5 — but if the validator's
`PlotEmission` shape is type-checked at compile time, ensure the new optional
field type-checks (no runtime branch yet).

### 5. Tests

- adapter-kit type test: `PlotEmission["colorValue"]` is `Color | null |
  undefined`; an emission without it still satisfies `PlotEmission`.
- A byte-identity assertion (or note for Task 5/6): an emission omitting
  `colorValue` serializes identically to a pre-feature `PlotEmission`.

## Edge cases

- `colorValue` MUST be appended (not inserted mid-object) so JSON key order /
  any positional serialization stays additive. The `plot-hash` only covers
  `{ bar, value }`, so `colorValue` never enters the hash — but keep the wire
  order additive regardless (conformance CLAUDE.md).
- `colorValue: null` vs omitted are DISTINCT: `null` = explicit gap this bar,
  omitted = use static fallback. Document this precisely — Task 6's renderer
  branches on it.
- Do NOT widen `value` under any circumstance. Do NOT add a style arm.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/adapter-kit/src/types.ts` | Modify | Add `PlotEmission.colorValue?: Color \| null`. |
| `packages/core/src/types.ts` | Modify (conditional) | `ColorSeries` only if a series input is in scope (default: defer). |
| `packages/core/src/index.ts` | Modify (conditional) | Re-export `ColorSeries` if added. |
| `packages/compiler/src/program.ts` | Modify (conditional) | Mirror `ColorSeries` + widened arg if added. |
| `packages/adapter-kit/src/**/*.types.test.ts` | Modify | `colorValue` type assertions. |
| `.changeset/<slug>.md` | Create | Deliverable-2 changeset (separate from Deliverable 1). |

## Gates

- `pnpm typecheck`, `pnpm lint`
- `pnpm -F @invinite-org/chartlang-adapter-kit test`
- `pnpm docs:check` (JSDoc on the new field: `@since`, `@example`, `@stable`)

## Changeset

`.changeset/<slug>.md` — a **separate** Deliverable-2 changeset (this ships
independently of Deliverable 1):

```md
---
"@invinite-org/chartlang-adapter-kit": minor
"@invinite-org/chartlang-runtime": minor
"@invinite-org/chartlang-pine-converter": minor
---

Add a per-bar dynamic-color channel (`PlotEmission.colorValue`) so
`bgcolor`/`barcolor` and value-driven plot colors recolor every bar from one
call. Omitted ⇒ byte-identical to the static-color wire. Adapters prefer
`colorValue` over the static color when present.
```

(Use `@since 1.5` for the Deliverable-2 surface.)

## Acceptance Criteria

- `PlotEmission.colorValue?: Color | null` added, appended, fully JSDoc'd;
  omitted-emission byte-identity preserved.
- The rejected alternatives (overload `value`, new style arm) are recorded in
  the field's JSDoc rationale (or the design note).
- `ColorSeries` decision recorded (default: deferred).
- adapter-kit type test green; no `value` widening; no style arm.
- Separate Deliverable-2 changeset committed.
