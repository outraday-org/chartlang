# Task 1 — Core `fill-between` kind + state + style, and canvas2d renderer

> **Status: TODO**

## Goal

Introduce the `"fill-between"` drawing kind across the `core` contract
(union, lists, bucket, camel/kebab maps, state type, style type,
`DrawNamespace` signature) and ship the matching `renderFillBetween`
canvas2d renderer. The renderer is bundled here because
`drawingDispatch.ts` is an exhaustive switch with a `satisfies never`
default arm (no `assertNever()` helper call — the unhandled-kind branch is
narrowed to `never` so an un-cased `DrawingKind` member is a compile
error) — adding the union member is a compile error (and a 100%-coverage
gap) until a real, tested renderer arm exists. This task also adds `draw.fillBetween` to
the core `STATEFUL_PRIMITIVES` registry so the compiler injects a slot id
when Task 2's runtime implementation lands.

## Prerequisites

None.

## Current Behavior

`packages/core/src/draw/` has 62 drawing kinds; none is a fill between
two edges. `examples/canvas2d-adapter/` renders all 62 via per-kind
`renderXxx` functions routed by an exhaustive switch.

## Desired Behavior

`"fill-between"` exists as a fully-wired core kind with a
`FillBetweenState` / `FillBetweenStyle`, a `draw.fillBetween` signature
on `DrawNamespace`, and a canvas2d renderer that fills the closed polygon
formed by `edgeA` (forward) + `edgeB` (reversed). No runtime emit yet
(Task 2) — the type and renderer exist; calling `draw.fillBetween` still
throws via the namespace proxy until Task 2.

## Requirements

### 1. `DrawingKind` union + iterables (`packages/core/src/draw/drawingKind.ts`)

- Add `| "fill-between"` to the `DrawingKind` union. Place it in the
  **Boxes / Shapes** group next to `"path"` and bump that group's count
  comment (currently `// Boxes / Shapes (8)` at ~line 42 → `(9)`).
- Update the total-count prose `62` → `63` in **every** `DRAWING_KINDS` /
  map JSDoc that states it — the count appears at **four** sites
  (~lines 5, 118, 200, 279). Grep `\b62\b` in `drawingKind.ts` and bump
  each. (Line 31 is the `"fib-retracement"` example, not a count — leave
  it.)
- Append `"fill-between"` to `DRAWING_KINDS` in the **same positional
  order** as the union (order is asserted).
- Add `["fill-between", "fillBetween"]` to `KIND_CAMELCASE`.
- `KIND_KEBABCASE` is derived from `KIND_CAMELCASE` by inversion (no
  manual entry needed — confirm by reading the `Array.from(...)`
  builder).
- Update `drawingKind.test.ts`: add `"fill-between"` to `EXPECTED_ORDER`
  in the matching slot **and** bump the count assertion
  `expect(DRAWING_KINDS.length).toBe(62)` (~line 76) → `63`. The
  positional `toEqual(EXPECTED_ORDER)` check (~line 80) must stay green.

### 2. Bucket (`packages/core/src/draw/buckets.ts`)

- Add `["fill-between", "polylines"]` to `KIND_BUCKET`. Update
  `buckets.test.ts` — it asserts **both** an exhaustive size
  (`expect(KIND_BUCKET.size).toBe(62)` → `63`) **and** a per-bucket tally
  ("distributes 62 kinds across the 5 buckets": `polylines` 25 → 26 and
  the total 62 → 63). Bump both.

### 3. Style (`packages/core/src/draw/drawingStyle.ts`)

Add a `FillBetweenStyle` type — stroke fields like `LineDrawStyle`
(optional `color`, `lineWidth`, `lineStyle`) plus the fill pair reused
from `ShapeStyle`:

```ts
/**
 * Style for {@link draw.fillBetween} — a filled ribbon between two
 * edges. Stroke fields are optional (the band may be fill-only);
 * `fill` + `fillAlpha` reuse the {@link ShapeStyle} fill model.
 *
 * @formula N/A — style bag, no math
 * @anchors N/A — style fields only
 * @since 0.4
 * @stable
 * @example
 *     const s: FillBetweenStyle = { fill: "#3b82f6", fillAlpha: 0.2 };
 *     void s;
 */
export type FillBetweenStyle = {
    /** Optional outline colour drawn around the ribbon. */
    readonly color?: Color;
    /** Outline width in px (default 0 / no stroke when `color` unset). */
    readonly lineWidth?: number;
    /** Outline dash style. */
    readonly lineStyle?: LineStyle;
    /** Fill colour of the band. */
    readonly fill?: Color;
    /** Fill opacity 0..1 (`applyShapeStyle` currently defaults to 1). */
    readonly fillAlpha?: number;
};
```

Match the exact `Color` / `LineStyle` imports and the type-literal
convention already used in this file. The JSDoc tags are mandatory:
`scripts/docs-check.ts` requires every exported `src/draw/` symbol to
carry `@formula`, `@anchors`, `@since`, `@example`, and a stability
marker.

### 4. State (`packages/core/src/draw/drawingState.ts`)

Add `FillBetweenState` immediately after `PathState`, then add it to the
`DrawingState` union (`drawingState.ts:1502`):

```ts
/**
 * State for a `fill-between` drawing: a filled ribbon between two edges.
 * Each edge is an ordered list of world anchors; the rendered region is
 * the closed polygon `edgeA` forward then `edgeB` reversed.
 *
 * @formula N/A — drawing state payload
 * @anchors `edgeA`, `edgeB` — two `ReadonlyArray<WorldPoint>`
 * @since 0.4
 * @stable
 * @example
 *     const state: FillBetweenState = {
 *         kind: "fill-between",
 *         edgeA: [{ time: 0, price: 1 }],
 *         edgeB: [{ time: 0, price: 0 }],
 *         style: { fill: "#3b82f6" },
 *     };
 *     void state;
 */
export type FillBetweenState = DrawingMeta & {
    readonly kind: "fill-between";
    readonly edgeA: ReadonlyArray<WorldPoint>;
    readonly edgeB: ReadonlyArray<WorldPoint>;
    readonly style: FillBetweenStyle;
};
```

**Important:** `DrawingMeta` is `{ name?, visible? }` only — it carries
**no** `id` / `slotId` / `subId` fields (those live on the wire
`DrawingEmission`, not on `DrawingState`). A `FillBetweenState` literal is
`{ kind, edgeA, edgeB, style }` (+ optional `name` / `visible`), exactly
like the `PathState` / `LineState` / `MarkerState` `@example`s. Do **not**
add `id` / `slotId` / `subId` to the example — `pnpm docs:check`
type-checks every `@example`, so an excess-property literal fails the gate.
Match the `DrawingMeta & { readonly … }` intersection shape the sibling
states use (not a `Readonly<{ … }>` wrapper).

- Update `drawingState.types.test.ts` `exhaustiveSwitch` to add a
  `case "fill-between":` arm so the exhaustiveness test compiles.
- If a `DrawingState`-shaped validator / round-trip test enumerates
  every kind, add a `fill-between` sample there too.

### 5. `DrawNamespace` signature (`packages/core/src/draw/draw.ts`)

Add the method next to `path`:

```ts
/**
 * Fill the ribbon between two edges. Each edge is a list of world
 * anchors; the filled region is the closed polygon `edgeA` forward
 * then `edgeB` reversed. The native equivalent of Pine
 * `linefill.new(line1, line2, color)` / `fill(plot1, plot2)`.
 */
fillBetween(
    edgeA: ReadonlyArray<WorldPoint>,
    edgeB: ReadonlyArray<WorldPoint>,
    opts?: FillBetweenStyle,
): DrawingHandle;
```

Also import `FillBetweenStyle` from `drawingStyle.ts` in `draw.ts`.
Export `FillBetweenState` and `FillBetweenStyle` from the core barrel
(`packages/core/src/index.ts` and/or `draw/index.ts`) following the
existing `PathState` / `PathOpts` export pattern.

### 6. Stateful primitive registry (`packages/core/src/statefulPrimitives.ts`)

- Add `{ name: "draw.fillBetween", slot: true }` in the draw section in
  the same order as `DRAWING_KINDS` / `KIND_CAMELCASE` (next to
  `draw.path`).
- Update `statefulPrimitives.test.ts`: add `"draw.fillBetween"` to
  `EXPECTED_SLOT_TRUE`, update the exact size assertions `174` → `175`,
  and update any prose/JSDoc counts in `statefulPrimitives.ts` that pin
  the entry count or "61 draw entries".
- This is required before Task 2 works in compiled scripts: without the
  registry entry, the compiler will not inject the leading slot id and
  the runtime overload will take the script-facing path and throw.

### 7. Canvas2d renderer (`examples/canvas2d-adapter/src/render/draw/fillBetween.ts`)

New file modelled on `render/draw/path.ts`. MIT header (original work —
no provenance port line). Map both edges via `worldPointToCanvas`, build
the closed polygon, `fill()` with `fill` + `fillAlpha` (reuse the
`shapeStyle.ts` apply helper semantics; adapt the stroke field from
`color` to the helper's `stroke` input or use a tiny local resolver), and
stroke the outline only when `color` is set:

Because `scripts/docs-check.ts` scans exported symbols in
`examples/canvas2d-adapter/src`, the exported `renderFillBetween`
function must carry a JSDoc block with `@since`, a stability marker, and
an executable / type-checkable `@example`, following `renderPath`.

```ts
/**
 * Render a `fill-between` drawing emission as a closed filled polygon.
 *
 * @since 0.4
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     declare const e: DrawingEmission;
 *     declare const view: Viewport;
 *     renderFillBetween(ctx, e, view);
 *     void renderFillBetween;
 */
export function renderFillBetween(ctx: RenderCtx, e: DrawingEmission, view: Viewport): void {
    const state = e.state as FillBetweenState;
    const a = state.edgeA.map((p) => worldPointToCanvas(p, view));
    const b = state.edgeB.map((p) => worldPointToCanvas(p, view));
    if (a.length < 1 || b.length < 1) return; // degenerate → no-op
    if (a.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return;
    if (b.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return;
    ctx.beginPath();
    ctx.moveTo(a[0].x, a[0].y);
    for (let i = 1; i < a.length; i++) ctx.lineTo(a[i].x, a[i].y);
    for (let i = b.length - 1; i >= 0; i--) ctx.lineTo(b[i].x, b[i].y);
    ctx.closePath();
    // apply fill + fillAlpha via shapeStyle helper, then ctx.fill();
    // if state.style.color set: set strokeStyle/lineWidth/dash + ctx.stroke();
}
```

Wire it: add the import + the `case "fill-between": renderFillBetween(ctx, emission, view); return;` arm in
`render/draw/drawingDispatch.ts` (each arm calls
`renderXxx(ctx, emission, view); return;` — match that shape, the param is
named `emission`, not `drawing`), export from `render/draw/index.ts`. The
dispatch JSDoc count comment is already stale — it says "all 61 kinds" /
"all 61 arms" (~lines 78-80) while the switch already has 62 live arms.
Refresh that prose to reflect 63 arms after the new one lands (or drop the
exact count from the historical narrative).

### 8. Tests (co-located)

- `examples/canvas2d-adapter/src/render/draw/fillBetween.test.ts` —
  mirror `path.test.ts`: feed a synthetic `DrawingEmission` with two
  edges, assert `fill` is issued, the polygon is closed, the degenerate
  (`edgeA`/`edgeB` empty) path is a no-op, a non-finite mapped anchor
  (`NaN` time or price) is a no-op, and the stroke arm fires when
  `color` is set. Cover the `fillAlpha` default branch. **100% coverage
  on the new file.**
- `drawingDispatch.test.ts` — add a `fill-between` case so the new arm is
  covered.
- `packages/core/src/statefulPrimitives.test.ts` — add the new slot entry
  and bump exact counts.

### 9. CLAUDE.md

- **`packages/core/` has no package-root `CLAUDE.md`** (only
  `packages/core/src/time/CLAUDE.md` exists). Do **not** create a new
  core package CLAUDE.md as part of this feature — the kind inventory's
  source of truth is the `drawingKind.ts` JSDoc counts you already
  bumped in §1. (The root `CLAUDE.md` index lists a core CLAUDE.md that
  does not yet exist; reconciling that is out of scope here.)
- `examples/canvas2d-adapter/CLAUDE.md` **exists** — note the new
  `renderFillBetween` arm; if it documents an "all N kinds render" count,
  bump it.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/draw/drawingKind.ts` | Modify | Union + lists + camel/kebab maps + counts |
| `packages/core/src/draw/drawingKind.test.ts` | Modify | `EXPECTED_ORDER` |
| `packages/core/src/draw/buckets.ts` | Modify | `KIND_BUCKET` entry |
| `packages/core/src/draw/buckets.test.ts` | Modify | tally if asserted |
| `packages/core/src/draw/drawingStyle.ts` | Modify | `FillBetweenStyle` |
| `packages/core/src/draw/drawingState.ts` | Modify | `FillBetweenState` + union |
| `packages/core/src/draw/drawingState.types.test.ts` | Modify | exhaustive switch arm |
| `packages/core/src/draw/draw.ts` | Modify | `fillBetween` signature |
| `packages/core/src/{index.ts,draw/index.ts}` | Modify | barrel exports |
| `packages/core/src/statefulPrimitives.ts` | Modify | `draw.fillBetween` slot-id injection registry |
| `packages/core/src/statefulPrimitives.test.ts` | Modify | exact registry set + counts |
| `examples/canvas2d-adapter/src/render/draw/fillBetween.ts` | Create | renderer |
| `examples/canvas2d-adapter/src/render/draw/fillBetween.test.ts` | Create | renderer tests |
| `examples/canvas2d-adapter/src/render/draw/drawingDispatch.ts` | Modify | switch arm + import + count |
| `examples/canvas2d-adapter/src/render/draw/index.ts` | Modify | export |
| `examples/canvas2d-adapter/CLAUDE.md` | Modify | new renderer arm (no `packages/core/CLAUDE.md` exists to touch) |

## Gates

- `pnpm typecheck` (exhaustive switch + exhaustive type test compile)
- `pnpm lint`
- `pnpm test` (coverage 100% on core + canvas2d-adapter)
- `pnpm docs:check` (JSDoc on new exported `FillBetweenState` /
  `FillBetweenStyle` and exported `renderFillBetween` — `@since`,
  stability marker, `@example`, plus draw-specific tags where the gate
  requires them)

## Changeset

Deferred to Task 5 (single changeset for the whole feature). This task
adds no changeset of its own.

## Acceptance Criteria

- `"fill-between"` present in the union, `DRAWING_KINDS`,
  `KIND_CAMELCASE`, `KIND_KEBABCASE`, `KIND_BUCKET`, and every
  exhaustive test, with all count comments updated.
- `FillBetweenState` / `FillBetweenStyle` exported from the core barrel
  with passing JSDoc gate.
- `draw.fillBetween` declared on `DrawNamespace`.
- `draw.fillBetween` listed in `STATEFUL_PRIMITIVES` with `slot: true`,
  and exact registry tests updated to 175 entries.
- `renderFillBetween` renders a closed filled polygon, handles the
  degenerate and non-finite-anchor no-ops, strokes when `color` set;
  dispatch routes it.
- `pnpm typecheck` + `pnpm test` green at 100% coverage on both packages
  (incl. the bumped `drawingKind.test.ts` count `63`, the `buckets.test.ts`
  size `63` + `polylines` tally `26`).
- `examples/canvas2d-adapter/CLAUDE.md` updated (no `packages/core/`
  package-root CLAUDE.md exists).
