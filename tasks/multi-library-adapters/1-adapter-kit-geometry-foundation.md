# adapter-kit geometry foundation: IR + projection + canvas paint + basic kinds

> **Status: TODO**

## Goal

Add a renderer-agnostic **geometry layer** to
`packages/adapter-kit/` that all rendering adapters share. This task
establishes the foundation: the `Viewport` + projection helpers, the
`DrawPrimitive` IR, the canvas-family sink (`RenderCtx`,
`paintPrimitive`, `MockCanvasContext`, `hashCallLog`), the shared
geometry `_lib` helpers (bezier, line-extend, arrowhead, named-polyline),
and the `decomposeDrawing` dispatcher covering the **basic** drawing
kinds (lines/rays, boxes/shapes, annotations, marker, text). Tasks 2–3
extend `decomposeDrawing` to the remaining kinds.

## Prerequisites

None.

## Current Behavior

All projection (`timeToX`/`priceToY`/`Viewport`), the `RenderCtx`
type, the `MockCanvas2DContext`, and all 62 drawing geometries live
inside `examples/canvas2d-adapter/src/render/`. `adapter-kit` has no
geometry surface.

## Desired Behavior

`@invinite-org/chartlang-adapter-kit` exports a pure geometry surface
plus a canvas sub-path. `decomposeDrawing(emission, viewport)` returns a
flat `DrawPrimitive[]` for the basic kinds; `paintPrimitive(ctx, prim)`
renders one primitive to a canvas `RenderCtx`; `MockCanvasContext`
records calls for deterministic hashing.

## Requirements

### 1. Projection + IR types — `packages/adapter-kit/src/geometry/types.ts`

Port `Viewport`, `timeToX`, `priceToY` verbatim from
`examples/canvas2d-adapter/src/render/coords.ts`, and add the IR:

```ts
export type Point2 = { readonly x: number; readonly y: number };

export type Viewport = {
    readonly xMin: number;   // time
    readonly xMax: number;
    readonly yMin: number;   // price
    readonly yMax: number;
    readonly pxWidth: number;
    readonly pxHeight: number;
};

export type StrokeStyle = {
    readonly color: string;
    readonly width: number;
    readonly dash: ReadonlyArray<number>; // [] === solid
};
export type FillStyle = { readonly color: string; readonly alpha: number };

export type DrawPrimitive =
    | { readonly kind: "polyline"; readonly points: ReadonlyArray<Point2>;
        readonly closed: boolean; readonly stroke?: StrokeStyle; readonly fill?: FillStyle }
    | { readonly kind: "arc"; readonly cx: number; readonly cy: number; readonly r: number;
        readonly start: number; readonly end: number;
        readonly stroke?: StrokeStyle; readonly fill?: FillStyle }
    | { readonly kind: "text"; readonly x: number; readonly y: number; readonly text: string;
        readonly color: string; readonly font: string;
        readonly align: "left" | "center" | "right";
        readonly baseline: "top" | "middle" | "bottom"; readonly bgColor?: string }
    | { readonly kind: "marker";
        readonly shape: "circle" | "square" | "diamond" | "triangle-up" | "triangle-down";
        readonly x: number; readonly y: number; readonly size: number;
        readonly stroke?: StrokeStyle; readonly fill?: FillStyle };
```

### 2. Projection helpers — `packages/adapter-kit/src/geometry/project.ts`

```ts
export function timeToX(time: number, view: Viewport): number { /* from coords.ts */ }
export function priceToY(price: number, view: Viewport): number { /* from coords.ts */ }
export function worldPointToPixel(p: WorldPoint, view: Viewport): Point2 {
    return { x: timeToX(p.time, view), y: priceToY(p.price, view) };
}
```

`WorldPoint` from `@invinite-org/chartlang-core`.

### 3. Shared geometry `_lib` — `packages/adapter-kit/src/geometry/_lib/`

**Move** (not copy) these from
`examples/canvas2d-adapter/src/render/draw/`, rewriting any that emit to
`ctx` so they return geometry only:

| New file | Source | Notes |
|----------|--------|-------|
| `_lib/bezier.ts` | `draw/bezier.ts` | `sampleCubic`, `sampleQuadratic`, `Point2` (re-use IR `Point2`) |
| `_lib/lineExtend.ts` | `draw/lineExtend.ts` | `extendLineSegment(a, b, opts, view)` → `{ from, to }` |
| `_lib/arrowhead.ts` | `draw/arrowhead.ts` | returns the arrowhead polygon points (no ctx) |
| `_lib/namedPolyline.ts` | `draw/namedPolyline.ts` | returns `DrawPrimitive[]` (a polyline + per-vertex `text` primitives) instead of painting |
| `_lib/dash.ts` | **`src/render/lineDash.ts`** (`dashPattern`) | `lineStyle → number[]` — **copy, do not move** (see note) |

The four `draw/`-local helpers (`bezier`, `lineExtend`, `arrowhead`,
`namedPolyline`) are package-private (consumed by `decomposeDrawing` only)
and their canvas2d originals are deleted in Task 4.

> **`dash.ts` is the exception — copy, not move.** `dashPattern` lives at
> `examples/canvas2d-adapter/src/render/lineDash.ts` (one level **up** from
> `draw/`) and is still imported by **surviving** plot renderers
> (`render/area.ts`, `render/horizontalLine.ts`, …). canvas2d therefore
> keeps `lineDash.ts`; adapter-kit gets its own `_lib/dash.ts` with the
> identical `dashPattern` mapping (`"solid"→[]`, `"dashed"→[6,4]`,
> `"dotted"→[2,4]`). Task 4 must **not** delete `lineDash.ts`.

### 4. `decomposeDrawing` dispatcher — `packages/adapter-kit/src/geometry/decompose.ts`

```ts
export function decomposeDrawing(
    e: DrawingEmission,
    view: Viewport,
): ReadonlyArray<DrawPrimitive> {
    switch (e.drawingKind) {
        case "line": return decomposeLine(e.state as LineState, view);
        // ...basic kinds in this task; Tasks 2–3 add the rest
        default: {
            const _exhaustive: DrawingKind = e.drawingKind;
            void _exhaustive;
            return [];   // Tasks 2–3 fill the remaining arms
        }
    }
}
```

`op: "remove"` handling stays in each adapter (the drawing-state map drops
it), exactly as canvas2d does — `decomposeDrawing` operates on whatever
`state` it is handed.

> **Exhaustiveness note:** until Task 3 lands all 62 arms, the `default`
> arm must *not* use `satisfies never` (that would fail to typecheck).
> Use the widening assignment above; Task 3 replaces the `default` with
> the `never` guard once every kind is covered.

### 5. Basic-kind decomposers — `packages/adapter-kit/src/geometry/kinds/`

One file per group, each a pure `(state, view) => DrawPrimitive[]`,
ported from the matching canvas2d renderer's geometry:

- `lines.ts` — `line`, `horizontal-line`, `horizontal-ray`,
  `vertical-line`, `cross-line`, `trend-angle` (6). Use `extendLineSegment`.
- `boxes.ts` — `rectangle`, `rotated-rectangle`, `triangle`, `polyline`,
  `circle`, `ellipse`, `path` (7). Closed polylines / arcs with fill.
- `annotations.ts` — `text`, `arrow`, `arrow-marker`, `arrow-mark-up`,
  `arrow-mark-down` (5). Arrow uses `_lib/arrowhead`.
- `marker.ts` — `marker` (1) → a `marker` primitive (+ optional `text`).

Reference the exact geometry in
`examples/canvas2d-adapter/src/render/draw/{line,rectangle,circle,ellipse,text,arrow,marker,...}.ts`.
Preserve default colors/widths (e.g. line `#000000` width `1`) so Task 4's
hash re-pin is behaviour-preserving.

### 6. Canvas sink — `packages/adapter-kit/src/canvas/`

- `canvas/renderCtx.ts` — move the `RenderCtx` structural type from
  `examples/canvas2d-adapter/src/render/clear.ts` (the full Phase-2/5
  surface: `beginPath`/`moveTo`/`lineTo`/`stroke`/`fill`/`arc`/`closePath`/
  `setLineDash`/`fillRect`/`clearRect`/`fillText`/`save`/`restore`/
  `translate` + setters `strokeStyle`/`fillStyle`/`lineWidth`/`globalAlpha`/
  `font`/`textAlign`/`textBaseline`).
- `canvas/paintPrimitive.ts` — `paintPrimitive(ctx: RenderCtx, p: DrawPrimitive): void`.
  One `switch` over the 4 IR kinds emitting the canonical `ctx` calls
  (stroke after fill; reset `setLineDash([])` and `globalAlpha = 1`
  after use, matching the existing renderers).
- `canvas/mockContext.ts` — generalise `MockCanvas2DContext` +
  `hashCallLog` from `examples/canvas2d-adapter/src/testing.ts` into
  `MockCanvasContext` (records every method + setter into `RecordedCall[]`;
  `canonicalise` rounds floats to 4 dp; `hashCallLog(mock)` → SHA-256).
  Keep the class name generic; canvas2d re-exports it as
  `MockCanvas2DContext` in Task 4.

### 7. Barrels + package exports

- `packages/adapter-kit/src/geometry/index.ts` — re-export projection,
  IR types, `decomposeDrawing`.
- `packages/adapter-kit/src/canvas/index.ts` — re-export `RenderCtx`,
  `paintPrimitive`, `MockCanvasContext`, `hashCallLog`.
- `packages/adapter-kit/src/index.ts` — add the geometry re-exports
  (types + `decomposeDrawing` + projection).
- `packages/adapter-kit/package.json` — add a `./canvas` export:
  ```json
  "./canvas": { "types": "./dist/canvas/index.d.ts", "import": "./dist/canvas/index.js" }
  ```

### 8. Tests (co-located, 100% coverage)

- `geometry/project.test.ts` — `timeToX`/`priceToY`/`worldPointToPixel`
  incl. the `span === 0 → pxWidth/2` branch.
- `geometry/kinds/*.test.ts` — each basic decomposer: assert the exact
  `DrawPrimitive[]` for representative anchors (extend-left/right rays,
  filled vs unfilled box, arrow polygon, marker shapes).
- `canvas/paintPrimitive.test.ts` — paint each IR kind into a
  `MockCanvasContext`; assert the recorded call sequence.
- `canvas/mockContext.test.ts` — every method + setter recorded;
  `hashCallLog` stable across runs and to 4-dp float drift.
- `geometry/_lib/*.test.ts` — bezier sampling, line extension, arrowhead,
  named-polyline, dash mapping.

### Edge cases

- Degenerate anchors (a === b): zero-length line/ray must not throw; emit
  an empty or single-point polyline matching canvas2d's current handling.
- `span === 0` in projection → centre (`pxWidth/2`).
- NaN anchor coords (past-history `bar.point`) propagate to pixel NaN —
  do **not** sanitise; canvas/library no-ops on NaN, mirroring today.
- Fill alpha defaults and `lineStyle` defaults must match the source
  renderers exactly.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/adapter-kit/src/geometry/types.ts` | Create | `Viewport`, `Point2`, `DrawPrimitive`, styles |
| `packages/adapter-kit/src/geometry/project.ts` (+test) | Create | projection helpers |
| `packages/adapter-kit/src/geometry/decompose.ts` (+test) | Create | dispatcher (basic arms) |
| `packages/adapter-kit/src/geometry/kinds/{lines,boxes,annotations,marker}.ts` (+tests) | Create | basic decomposers |
| `packages/adapter-kit/src/geometry/_lib/{bezier,lineExtend,arrowhead,namedPolyline,dash}.ts` (+tests) | Create | shared geometry helpers (moved) |
| `packages/adapter-kit/src/geometry/index.ts` | Create | geometry barrel |
| `packages/adapter-kit/src/canvas/{renderCtx,paintPrimitive,mockContext,index}.ts` (+tests) | Create | canvas sink + mock |
| `packages/adapter-kit/src/index.ts` | Modify | export geometry surface |
| `packages/adapter-kit/package.json` | Modify | add `./canvas` export |
| `packages/adapter-kit/CLAUDE.md` | Create | document the geometry-layer invariants (IR is the shared contract; decomposers pure; canvas2d re-exports the mock) |

## Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` (adapter-kit 100% coverage)
- `pnpm docs:check` (JSDoc on every new export: `@example`, `@since`, stability)
- `pnpm readme:check` (adapter-kit README ≤ 100 lines)

## Changeset

`.changeset/adapter-kit-geometry-foundation.md` — **minor** bump for
`@invinite-org/chartlang-adapter-kit` (new public geometry + canvas surface).

## Acceptance Criteria

- `decomposeDrawing` covers all basic kinds (lines, boxes, annotations,
  marker, text); remaining kinds return `[]` via the placeholder default.
- `paintPrimitive` + `MockCanvasContext` + `hashCallLog` exported from the
  `./canvas` sub-path; deterministic hashing verified.
- 100% line/branch/function coverage on adapter-kit; JSDoc + README gates green.
- `adapter-kit/CLAUDE.md` created documenting the geometry invariants.
- Changeset committed (minor).
- canvas2d is **untouched** in this task (it still owns its renderers;
  Task 4 migrates it).
