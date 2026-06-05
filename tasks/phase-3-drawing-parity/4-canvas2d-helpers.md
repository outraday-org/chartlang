# Task 4 — Canvas2d: shared draw helpers (worldToCanvas, drawingDispatch, fibLevels, bezier)

> **Status: TODO**

## Goal

Extend the canvas2d reference adapter with the shared rendering
scaffolding every per-category port task (5–18) builds on: a
world-`(time, price)` → canvas-`(x, y)` projector, a per-kind
renderer dispatch switch, the canonical fib-level ratios array,
the quadratic + cubic Bezier helpers, and the
`CANVAS2D_CAPABILITIES.drawings` extension to
`capabilities.allPhase3Drawings()`. Plus the `RenderCtx` extension
so drawing renderers consume the same test seam (the
`MockCanvas2DContext`) as plot renderers.

## Prerequisites

- Task 3 (runtime emits `DrawingEmission`; adapter receives via
  `onEmissions`).

## Current Behavior

- `examples/canvas2d-adapter/src/render/coords.ts` declares the
  `Viewport` type (line 20) with fields `{ xMin, xMax, yMin,
  yMax, pxWidth, pxHeight }` — `xMin/xMax` are **time-stamps**
  (visible bar range), `yMin/yMax` are **prices**. It also
  ships `timeToX(time, viewport)` (line 118),
  `priceToY(price, viewport)` (line 83), and `yToPrice(y,
  viewport)` (line 101). Note: the type is `Viewport`, NOT
  `ViewportState`.
- `examples/canvas2d-adapter/src/capabilities.ts` declares
  `drawings: new Set()` (empty) and
  `maxDrawingsPerScript: { lines: 0, labels: 0, boxes: 0,
  polylines: 0, other: 0 }` (zero budget).
- `examples/canvas2d-adapter/src/defaultAdapter.ts` has no
  drawing-emission handling — `onEmissions` ignores
  `emissions.drawings`.
- No `src/render/draw/` directory.

## Desired Behavior

- `worldPointToCanvas(p, view: Viewport): { x: number; y: number }`
  is the canonical projector used by every drawing renderer.
  Composes the existing `timeToX(p.time, view)` and
  `priceToY(p.price, view)` helpers from `coords.ts` — does NOT
  re-implement the projection math.
- `drawingDispatch(ctx, emission, view: Viewport)` routes any
  `DrawingEmission` to its per-kind renderer (61 cases).
- `FIB_LEVELS: ReadonlyArray<number>` ships the canonical
  ratios; consumed by every fib renderer in Tasks 11–12.
- `quadraticBezier(p0, p1, p2, t)` and
  `cubicBezier(p0, p1, p2, p3, t)` ship; consumed by `arc` /
  `curve` / `doubleCurve` (Task 8), `fibSpiral` (Task 12), and
  pattern renderers (Task 15).
- `CANVAS2D_CAPABILITIES.drawings =
  capabilities.allPhase3Drawings()` so the conformance suite
  covers every kind end-to-end.
- `CANVAS2D_CAPABILITIES.maxDrawingsPerScript` carries non-zero
  budgets sized for the `drawAll61` smoke scenario (Task 19).
- `defaultAdapter.ts`'s `onEmissions` iterates
  `emissions.drawings` and dispatches each through
  `drawingDispatch`. Under tests, the `MockCanvas2DContext`
  records the calls; in the playground a real canvas renders.

## Requirements

### 1. `examples/canvas2d-adapter/src/render/draw/worldToCanvas.ts`

```ts
import type { WorldPoint } from "@invinite-org/chartlang-core";
import type { Viewport } from "../coords";
import { priceToY, timeToX } from "../coords";

/**
 * World → canvas projection. Composes the existing `timeToX`
 * and `priceToY` helpers from `coords.ts` (which pin
 * `xMin/xMax` as the time range and `yMin/yMax` as the price
 * range, with y flipped because canvas y grows downward).
 *
 * Off-screen points are NOT clipped — the renderer is expected
 * to draw them; the canvas2d context handles clipping at the
 * stroke / fill boundary.
 */
export function worldPointToCanvas(
    p: WorldPoint,
    view: Viewport,
): { x: number; y: number } {
    return { x: timeToX(p.time, view), y: priceToY(p.price, view) };
}
```

No new type declarations in `coords.ts` — reuse the existing
`Viewport` export and helpers. The four cardinal anchors
(`xMin → x = 0`, `xMax → x = pxWidth`, `yMax → y = 0`,
`yMin → y = pxHeight`) come for free from the existing helpers
and are pinned by their existing unit tests; the new test in
§8 below pins `worldPointToCanvas` composition only.

### 2. `examples/canvas2d-adapter/src/render/draw/drawingDispatch.ts`

```ts
import type { DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { RenderCtx } from "../clear";
import type { Viewport } from "../coords";

/**
 * Dispatch a `DrawingEmission` to its per-kind renderer.
 * Tasks 5–18 each populate their kinds; the dispatch lives in
 * this one file so the switch is exhaustive at compile time
 * (`k satisfies never` in the default arm).
 */
export function drawingDispatch(
    ctx: RenderCtx,
    emission: DrawingEmission,
    view: Viewport,
): void {
    if (emission.op === "remove") return;  // canvas2d is stateless — remove is a no-op render
    switch (emission.drawingKind) {
        case "line": return renderLine(ctx, emission, view);          // Task 5
        case "horizontal-line": return renderHorizontalLine(ctx, emission, view);
        // … 59 more arms. Task 4 stubs every arm with `return;` (no-op);
        // each port task replaces its stubs with the real renderer.
        /* v8 ignore next 2 -- DRAWING_KINDS exhaustively switched. */
        default: {
            const _exhaustive: never = emission.drawingKind;
            return _exhaustive;
        }
    }
}
```

Per-category tasks (5–18) replace their kind arms with imports
of `./renderXxx.ts`. Task 4 ships the 61 no-op stubs so the file
compiles green from day one.

### 3. `examples/canvas2d-adapter/src/render/draw/fibLevels.ts`

```ts
/**
 * Canonical Fibonacci level ratios used by every fib drawing.
 * Source: invinite/src/components/trading-chart/tools/fib-* tools.
 */
export const FIB_LEVELS: ReadonlyArray<number> = Object.freeze([
    0, 0.236, 0.382, 0.5, 0.618, 0.786,
    1, 1.272, 1.414, 1.618, 2.0, 2.618, 4.236,
]);

/** Format level as a Pine-style label (e.g. `"0.618"`). */
export function formatLevel(level: number): string {
    return level === Math.floor(level) ? level.toFixed(1) : level.toFixed(3);
}
```

Consumed by `fibRetracement` (Task 11), `fibTrendExtension`
(Task 11), `fibChannel` (Task 11), `fibSpeedFan` (Task 12),
`fibSpeedArcs` (Task 12), and others.

### 4. `examples/canvas2d-adapter/src/render/draw/bezier.ts`

```ts
export type Point2 = { readonly x: number; readonly y: number };

/** Quadratic Bezier at parameter `t ∈ [0, 1]`. */
export function quadraticBezier(p0: Point2, p1: Point2, p2: Point2, t: number): Point2 {
    const u = 1 - t;
    return {
        x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
        y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
    };
}

/** Cubic Bezier at parameter `t ∈ [0, 1]`. */
export function cubicBezier(p0: Point2, p1: Point2, p2: Point2, p3: Point2, t: number): Point2 {
    const u = 1 - t;
    return {
        x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
        y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
    };
}

/** Convenience: sample a quadratic Bezier into N points (for
 *  context.beginPath() + lineTo loops). */
export function sampleQuadratic(p0: Point2, p1: Point2, p2: Point2, samples: number): ReadonlyArray<Point2> {
    const out: Point2[] = [];
    for (let i = 0; i <= samples; i++) out.push(quadraticBezier(p0, p1, p2, i / samples));
    return out;
}
// … plus sampleCubic(...)
```

Unit + property tests: endpoints (`t = 0` / `t = 1`) hit `p0` /
`p2` for quadratic, `p0` / `p3` for cubic; midpoint inside the
convex hull; sample arrays have length `samples + 1`.

### 5. `examples/canvas2d-adapter/src/capabilities.ts` update

```ts
import { capabilities } from "@invinite-org/chartlang-adapter-kit";

export const CANVAS2D_CAPABILITIES: Capabilities = {
    plots: capabilities.allPhase2Plots(),
    drawings: capabilities.allPhase3Drawings(),
    alerts: capabilities.alerts("toast", "log"),
    alertConditions: false,
    logs: false,
    inputs: new Set(),
    intervals: [],
    multiTimeframe: false,
    subPanes: 0,
    symInfoFields: new Set(),
    maxDrawingsPerScript: {
        lines: 200,
        labels: 200,
        boxes: 100,
        polylines: 100,
        other: 100,
    },
    maxLookback: 5000,
    maxTickHz: 10,
};
```

The budget numbers are sized so the `drawAll61` smoke scenario
(Task 19) fits without exhausting any bucket.

### 6. `examples/canvas2d-adapter/src/defaultAdapter.ts` update

The default adapter's `onEmissions` walks `emissions.drawings`
and dispatches each through `drawingDispatch` against the
adapter's `RenderCtx`. Under unit tests the `RenderCtx` is the
mock; the playground passes the real canvas context. The
existing test path (the `defaultAdapter.test.ts`) verifies the
`onEmissions(emissions)` no-op behaviour stays correct for
empty `drawings` arrays.

### 7. `examples/canvas2d-adapter/src/render/draw/index.ts`

Barrel — re-export `worldPointToCanvas`, `drawingDispatch`,
`FIB_LEVELS`, `formatLevel`, `quadraticBezier`, `cubicBezier`,
`sampleQuadratic`, `sampleCubic`.

### 8. Tests (§16.3 layers)

- `worldToCanvas.test.ts` — known anchor maps to known pixel
  (timeLeft → x=0; timeRight → x=width; priceMax → y=0;
  priceMin → y=height); off-screen points produce off-range
  numbers (no NaN, no Infinity for finite inputs).
- `worldToCanvas.property.test.ts` — round-trip an anchor through
  the projector and an inverse and recover the original
  `(time, price)` within float tolerance.
- `drawingDispatch.test.ts` — every `DrawingKind` (61) dispatches
  without throwing on the no-op stubs; `op: "remove"` is always
  a no-op; unknown kind is unreachable (covered via
  `// @ts-expect-error` cast test).
- `fibLevels.test.ts` — `FIB_LEVELS` cardinality + monotonicity;
  `formatLevel` round-trips for integer and fractional ratios.
- `bezier.test.ts` — endpoints, midpoint convex-hull
  containment, length monotonicity.
- `bezier.property.test.ts` — for random control points,
  `quadraticBezier(p0,p1,p2,0) === p0`,
  `quadraticBezier(p0,p1,p2,1) === p2` (float-exact);
  `sampleQuadratic(..., N).length === N+1`.
- `capabilities.test.ts` (modified) — assert
  `CANVAS2D_CAPABILITIES.drawings.size === 61`;
  `CANVAS2D_CAPABILITIES.maxDrawingsPerScript.lines > 0` etc.
- `defaultAdapter.test.ts` (modified) — `onEmissions({
  drawings: [<line-emission>], … })` dispatches through
  `drawingDispatch` (assert via spy that the mock canvas
  received the expected calls); `op: "remove"` skipped; unknown
  kind path is unreachable.
- `integration.test.ts` (modified) — run a 1-bar script that
  emits one `line` drawing (Task 5 stubs are sufficient at this
  point since Task 4 ships a no-op stub); assert the
  `RenderCtx` recorded zero stroke calls (since the per-kind
  renderers haven't shipped). Property: even with 61 stubs the
  dispatch never throws.

100% coverage. The no-op stub arms in `drawingDispatch.ts` get
covered by the dispatch unit test that walks every `DrawingKind`.

### 9. JSDoc per §17.2

- `worldPointToCanvas` — `@since 0.3`, `@example` projecting an
  anchor.
- `drawingDispatch` — `@since 0.3`, `@example`.
- `FIB_LEVELS` — `@since 0.3`.
- Bezier helpers — `@since 0.3`, `@example` quadratic + cubic.

### 10. README extension

`examples/canvas2d-adapter/README.md` — add "Drawing rendering
(Phase 3)" entry listing the shared helpers + the
`drawingDispatch` contract. Cap 100 lines.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `examples/canvas2d-adapter/src/render/draw/worldToCanvas.ts` | Create | Projection helper. |
| `examples/canvas2d-adapter/src/render/draw/drawingDispatch.ts` | Create | 61-arm dispatch (no-op stubs). |
| `examples/canvas2d-adapter/src/render/draw/fibLevels.ts` | Create | Canonical ratios. |
| `examples/canvas2d-adapter/src/render/draw/bezier.ts` | Create | Quadratic + cubic helpers. |
| `examples/canvas2d-adapter/src/render/draw/index.ts` | Create | Barrel. |
| `examples/canvas2d-adapter/src/render/draw/*.test.ts` | Create | Unit + property tests. |
| `examples/canvas2d-adapter/src/render/coords.ts` | (no edit — reuse existing `Viewport` + `timeToX` + `priceToY` + `yToPrice`) | |
| `examples/canvas2d-adapter/src/capabilities.ts` | Modify | Wire `allPhase3Drawings` + non-zero `maxDrawingsPerScript`. |
| `examples/canvas2d-adapter/src/capabilities.test.ts` | Modify | Assert cardinality + budget. |
| `examples/canvas2d-adapter/src/defaultAdapter.ts` | Modify | `onEmissions` dispatches `emissions.drawings`. |
| `examples/canvas2d-adapter/src/defaultAdapter.test.ts` | Modify | Cover the new dispatch path. |
| `examples/canvas2d-adapter/src/integration.test.ts` | Modify | 1-bar smoke through dispatch. |
| `examples/canvas2d-adapter/README.md` | Modify | "Drawing rendering (Phase 3)" entry. |
| `.changeset/phase-3-task-4-canvas2d.md` | Create | `chartlang-example-canvas2d-adapter: minor`. |

## Gates

- `pnpm -F chartlang-example-canvas2d-adapter typecheck && test`
  (100% coverage).
- `pnpm typecheck` workspace-wide.
- `pnpm lint`, `pnpm docs:check`, `pnpm readme:check`.
- `pnpm conformance` green — every existing scenario still
  passes; the Phase-3 line scenarios that ship in Task 5 run
  through this dispatch and get a real renderer there.

## Changeset

`chartlang-example-canvas2d-adapter: minor`. Description:
"Shared drawing-rendering scaffolding — `worldPointToCanvas`,
`drawingDispatch` (61-arm), `FIB_LEVELS`, quadratic + cubic
Bezier helpers. `CANVAS2D_CAPABILITIES.drawings =
allPhase3Drawings()`, non-zero per-bucket budgets sized for the
`drawAll61` smoke scenario."

## Acceptance Criteria

- `worldPointToCanvas` composes the existing `timeToX` +
  `priceToY` helpers (no inlined math); accepts the existing
  `Viewport` type — no `ViewportState` alias introduced.
- The four cardinal anchors map correctly via the existing
  helpers' own tests; the new test pins composition only.
- `drawingDispatch` covers every `DrawingKind` in its switch;
  TypeScript exhaustiveness verified via `(k satisfies never)`.
- `FIB_LEVELS` has 13 entries in monotonic order.
- Bezier helpers' endpoints are float-exact.
- `CANVAS2D_CAPABILITIES.drawings.size === 61` and every bucket
  in `maxDrawingsPerScript` ≥ 100.
- `onEmissions` correctly routes drawings; `op: "remove"`
  skipped.
- 100% coverage on `examples/canvas2d-adapter`.
- Phase-1/-2 + Tasks 1–3 gates remain green.
- Changeset committed.
