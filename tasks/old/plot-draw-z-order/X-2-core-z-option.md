# Tier 3 (core): `z` Option on Plot & Draw

> **Status: TODO**

## Goal

Add an optional, presentation-only `z?: number` to the author-facing
option types: `PlotOpts` (for `plot()`) and every `draw.*` option type.
This is the **author surface + contract** for z-order. No runtime/render
behavior changes in this task — it only declares the option and its
JSDoc so downstream tasks (runtime, adapter) can consume it.

## Prerequisites

- Task 1 (spec contract describing the render-order key).

## Current Behavior

- `packages/core/src/plot/plot.ts:232` defines:
  ```ts
  export type PlotOpts = Readonly<{
      color?: Color;
      title?: string;
      lineWidth?: number;
      lineStyle?: LineStyle;
      pane?: "overlay" | "new" | string;
      style?: PlotOptsStyle;
  }>;
  ```
  No `z`.
- The `draw.*` namespace and its option types live under
  `packages/core/src/draw/` (`draw.ts`, `drawingState.ts`). Each
  `draw.*` constructor (`draw.line`, `draw.rectangle`,
  `draw.fillBetween`, `draw.text`/label, `draw.polyline`, horizontal
  line, etc.) accepts a style/options bag (color, lineWidth, lineStyle,
  …). None carry `z`.

## Desired Behavior

- `PlotOpts` gains `z?: number`.
- Every `draw.*` option type gains `z?: number` via a single shared
  `ZOrdered` mixin (there is **no** common base type to extend — see
  Requirement 1), so every drawing primitive accepts it uniformly with
  the JSDoc authored once.
- `z` is documented as presentation-only: it does not change geometry,
  values, anchors, alerts, or `state.*` — only render stacking.

## Requirements

### 1. Add `z?` to the draw option types via a shared `ZOrdered` mixin

There is **no single shared base** for draw options (and no
`DrawingMeta`). The `draw.*` constructors live in
`packages/core/src/draw/draw.ts`, but their option bags are **per-kind
style types** defined in `packages/core/src/draw/drawingStyle.ts`:
`LineDrawStyle`, `ShapeStyle`, `HighlighterStyle`, `BrushStyle`,
`TextOpts`, `ArrowOpts`, `ArrowMarkerOpts`, `PathOpts`,
`FillBetweenStyle`, `FibOpts`, `RegressionTrendOpts`, `FrameOpts`,
`TableOpts`. They compose by intersection, not a common supertype, so
there is nothing single to extend.

Add a small shared mixin in `packages/core/src/draw/drawingStyle.ts`:

```ts
export interface ZOrdered {
    readonly z?: number;
}
```

and intersect it into each per-kind style type (e.g.
`export type LineDrawStyle = ZOrdered & Readonly<{ … }>`), so every
`draw.*` primitive accepts `z` uniformly with the JSDoc authored **once**
on `ZOrdered.z`. Do **not** copy-paste the JSDoc onto each type. Record
the exact set of types touched in the PR description.

(`drawingState.ts` holds `DrawingState` — the per-handle *state* emitted
on the wire — and is **out of scope** here; `z` is a top-level emission
field added in Task 3, never part of `DrawingState`.)

### 2. Add `z?` to `PlotOpts`

```ts
export type PlotOpts = Readonly<{
    color?: Color;
    title?: string;
    lineWidth?: number;
    lineStyle?: LineStyle;
    pane?: "overlay" | "new" | string;
    style?: PlotOptsStyle;
    /**
     * Presentation-only render-order key (z-index). Default `0`.
     * Higher `z` renders on top; lower `z` renders behind. Marks with
     * equal `z` keep the default group order (plots below drawings) and,
     * within a group, declaration order. `z` may be any finite number —
     * fractional values (e.g. `1.5`) slot a mark between two layers
     * without renumbering. It affects **only** stacking: `value`,
     * alerts, and `state.*` are unaffected.
     *
     * @since 1.4
     * @stable
     * @example
     *     plot(ta.sma(bar.close, 50), { z: -1 }); // behind other plots
     */
    z?: number;
}>;
```

(`@since` tracks the **global release train**, not the per-package
`package.json` version — the `xShift` precedent is `@since 1.3` even
though it lives across `core@1.1.1` and `adapter-kit@1.2.1`. z-order is
the next feature after `xShift`, so use **`@since 1.4`** consistently in
every task in this folder. Do **not** derive `@since` from
`package.json`; the changeset bumps the package version independently. If
an `@since 1.4` already exists in the tree by the time this lands, reuse
it; otherwise confirm 1.4 is still the next train before committing.)

### 3. JSDoc on the draw `z`

Author this JSDoc **once** on `ZOrdered.z` (from Requirement 1), mirroring
the `PlotOpts.z` JSDoc with a draw example:

```ts
/**
 * Presentation-only render-order key (z-index). Default `0`. Higher
 * renders on top. A drawing with negative `z` can render **below**
 * plots (which default to a lower band than drawings). Finite numbers
 * only; affects stacking only, never geometry or anchors.
 *
 * @since 1.4
 * @stable
 * @example
 *     draw.line(a, b, { z: -1 }); // beneath the plots
 */
```

### 4. Type-level tests (co-located)

Add/extend the core type tests proving:
- `plot(value, { z: 2 })` type-checks; `plot(value, { z: "x" })` does
  not (use the repo's `expectTypeOf` / `@ts-expect-error` convention —
  match existing core type tests).
- `draw.line(a, b, { z: -1 })` type-checks.
- `z` is optional everywhere (`PlotOpts` with no `z` still valid).

### 5. Edge cases / invariants

- `z` is purely a type addition here — **no** validation, clamping, or
  emission logic in core (that is Tasks 3–4).
- Do not add `z` to `PlotOptsStyle` or to any value-bearing type; it is
  a sibling option, not a style sub-field.
- Coverage: type-only additions must not drop branch coverage; if the
  core coverage gate flags the new option path, ensure a test exercises
  any new runtime-reachable code (there should be none in core).

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/plot/plot.ts` | Modify | `PlotOpts.z?: number` + JSDoc |
| `packages/core/src/draw/drawingStyle.ts` | Modify | `ZOrdered` mixin (JSDoc on `z`) + intersect into the per-kind style types |
| `packages/core/src/**/__tests__` (type tests) | Modify | Type-level assertions for `z` |
| `packages/core/CLAUDE.md` | Modify | Note the new presentation option if it documents the opts surface |
| `.changeset/plot-draw-z-order.md` | Create | `@invinite-org/chartlang-core: minor` |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (coverage 100% on `packages/core`)
- `pnpm docs:check` (JSDoc `@since`/`@stable`/`@example` on new exports)
- `pnpm skills:gate` (will **not** trip from this task: the skills
  generator reads `ta.*`/`draw.*` JSDoc from
  `packages/runtime/src/emit/draw` — constructor signature, description,
  anchors, `@since`, stability — and does **not** extract option-type
  fields like `z`. Adding `z?` to a core option type leaves
  `references/primitives.md` byte-identical, so no regen is needed here.
  The `z` option is taught via `SKILL.md` prose in Task 8.)

## Changeset

Create `.changeset/plot-draw-z-order.md`:

```markdown
---
"@invinite-org/chartlang-core": minor
---

Add an optional presentation-only `z` (render-order / z-index) option to
`plot()` and every `draw.*` primitive. Default `0`; higher renders on
top, ties fall back to the existing group + declaration order. Finite
numbers only. Affects stacking only — values, alerts, and `state.*` are
unchanged.
```

Tasks 3, 4, 6, 7 will append their package bumps to this same file.

## Acceptance Criteria

- `PlotOpts.z?: number` exists, and every `draw.*` option type carries
  `z?: number` via the shared `ZOrdered` mixin (JSDoc authored once on
  `ZOrdered.z`), each with full JSDoc (`@since 1.4`, `@stable`,
  `@example`).
- Type tests prove `z` is accepted on `plot()` and `draw.*`, optional,
  and rejects non-numbers.
- No validation/emission/render logic added in core.
- 100% coverage on `packages/core`; doc gate green.
- Changeset created with the core minor bump.
- `packages/core/CLAUDE.md` updated if it enumerates the opts surface.
