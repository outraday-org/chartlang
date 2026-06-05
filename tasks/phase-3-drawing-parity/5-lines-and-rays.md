# Task 5 — Lines / Rays — `line` / `horizontalLine` / `horizontalRay` / `verticalLine` / `crossLine` / `trendAngle`

> **Status: TODO**

## Goal

Port the 6 line-family drawing kinds: the runtime emit functions
(replacing the Task-3 `notYetImplemented` stubs), the per-kind
canvas2d renderers (replacing the Task-4 no-op stubs), the
per-kind `validateEmission` validator functions, the per-kind
conformance scenarios (using `inlineSource`), and the
auto-generated `docs/primitives/draw/<kind>.md` page each. All
6 kinds share the `lines` `DrawingCounts` bucket per Task 1.

## Prerequisites

- Tasks 1–4 (core types, adapter-kit validation dispatch +
  builders, runtime emit infra, canvas2d helpers).

## Kinds Landed

| Kind (kebab) | Kind (camel) | Anchors | State shape | Invinite source |
|---|---|---|---|---|
| `line` | `line` | 2 (from, to) | `from`, `to`, `style` (LineDrawStyle w/ `extendLeft`/`extendRight`) | `tools/line-tool.ts`, `tools/ray-tool.ts`, `tools/extended-line-tool.ts` (collapse) |
| `horizontal-line` | `horizontalLine` | 1 (price) | `price: Price`, `style` | `tools/horizontal-line-tool.ts` |
| `horizontal-ray` | `horizontalRay` | 1 (origin) | `origin: WorldPoint`, `style` | `tools/horizontal-ray-tool.ts` |
| `vertical-line` | `verticalLine` | 1 (time) | `time: Time`, `style` | `tools/vertical-line-tool.ts` |
| `cross-line` | `crossLine` | 1 (at) | `at: WorldPoint`, `style` | `tools/cross-line-tool.ts` |
| `trend-angle` | `trendAngle` | 2 (from, to) | `from`, `to`, `style` | `tools/trend-angle-tool.ts` |

Bucket: all `lines`. Variant-collapse: `ray` and `extendedLine`
tools both emit the `line` kind with `extendLeft` / `extendRight`
flags on `LineDrawStyle`.

## Requirements

### 1. Runtime — `packages/runtime/src/emit/draw/<kind>.ts` (×6)

Each file ships:

- Two-line MIT header + 4-line provenance header (citing
  `y-doc-bridge.ts` + the relevant `*-tool.ts` files at SHA
  `078f41fe2569d659d5aba726da8bcb5d3e2ced02`).
- Overloaded export pair: `(slotId, ...args)` (compiler-injected)
  and `(...args)` (script-author throw — sentinel error when
  `ACTIVE_RUNTIME_CONTEXT.current` is null, mirroring the
  Phase-1 `plot` overload pattern).
- Constructs the initial `DrawingState` from args, calls
  `createDrawingHandle(slotId, nextSubId(ctx, slotId), <kind>,
  initialState)`, returns the handle.
- JSDoc: `@since 0.3`, `@experimental`, `@anchors`, `@example`,
  `@example` (Pine equivalent comment).

Example — `line.ts`:

```ts
import type { DrawingHandle, LineDrawStyle, WorldPoint } from "@invinite-org/chartlang-core";
import { createDrawingHandle } from "./handle";
import { nextSubId } from "./subIdAllocator";
import { ACTIVE_RUNTIME_CONTEXT } from "../../runtimeContext";

export function line(slotId: string, from: WorldPoint, to: WorldPoint, style?: LineDrawStyle): DrawingHandle;
export function line(from: WorldPoint, to: WorldPoint, style?: LineDrawStyle): DrawingHandle;
export function line(...args: unknown[]): DrawingHandle {
    if (typeof args[0] !== "string") {
        throw new Error("draw.line called outside an active script step");
    }
    const [slotId, from, to, style] = args as [string, WorldPoint, WorldPoint, LineDrawStyle | undefined];
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (!ctx) throw new Error("draw.line called outside an active script step");
    return createDrawingHandle(slotId, nextSubId(ctx, slotId), "line", {
        kind: "line",
        from, to,
        style: style ?? {},
    });
}
```

Each remaining kind follows the same pattern. `horizontal-line`
takes a `Price` first; `vertical-line` takes a `Time`; etc.

### 2. Runtime — `packages/runtime/src/emit/draw/index.ts`

Replace the 6 `notYetImplemented(<kind>)` slots with real exports:

```ts
import { line } from "./line";
import { horizontalLine } from "./horizontalLine";
// … etc

export const draw: DrawNamespace = {
    line, horizontalLine, horizontalRay, verticalLine, crossLine, trendAngle,
    // remaining 55 still notYetImplemented stubs
    rectangle: notYetImplemented("rectangle"),
    // …
    fib: { /* still throws */ },
    gann: { /* still throws */ },
    elliott: { /* still throws */ },
    pattern: { /* still throws */ },
} as unknown as DrawNamespace;
```

### 3. Core — `packages/core/src/draw/drawingState.ts`

Refine the 6 line-family `DrawingState` variants beyond Task 1's
shells:

```ts
export type LineState = DrawingMeta & {
    readonly kind: "line";
    readonly from: WorldPoint;
    readonly to: WorldPoint;
    readonly style: LineDrawStyle;
};
export type HorizontalLineState = DrawingMeta & {
    readonly kind: "horizontal-line";
    readonly price: Price;
    readonly style: LineDrawStyle;
};
export type HorizontalRayState = DrawingMeta & {
    readonly kind: "horizontal-ray";
    readonly origin: WorldPoint;
    readonly style: LineDrawStyle;
};
export type VerticalLineState = DrawingMeta & {
    readonly kind: "vertical-line";
    readonly time: Time;
    readonly style: LineDrawStyle;
};
export type CrossLineState = DrawingMeta & {
    readonly kind: "cross-line";
    readonly at: WorldPoint;
    readonly style: LineDrawStyle;
};
export type TrendAngleState = DrawingMeta & {
    readonly kind: "trend-angle";
    readonly from: WorldPoint;
    readonly to: WorldPoint;
    readonly style: LineDrawStyle;
};
```

### 4. Adapter-kit — `validateEmission.ts` per-kind validators

Add 6 functions next to `validateLineLikeStyle`:

```ts
function validateLineState(s: Record<string, unknown>): ValidationResult {
    if (!isWorldPoint(s.from)) return bad("line.state.from: not a WorldPoint");
    if (!isWorldPoint(s.to)) return bad("line.state.to: not a WorldPoint");
    return validateLineDrawStyle(s.style, "line.state.style");
}
// + validateHorizontalLineState, validateHorizontalRayState,
//   validateVerticalLineState, validateCrossLineState, validateTrendAngleState
```

Wire each into `validateStateByKind`'s switch.

### 5. Canvas2d — `examples/canvas2d-adapter/src/render/draw/<kind>.ts` (×6)

Each renderer is a pure function taking `(ctx, emission, view)`.
For lines:

```ts
export function renderLine(ctx: RenderCtx, e: DrawingEmission, view: Viewport): void {
    const state = e.state as LineState;
    const a = worldPointToCanvas(state.from, view);
    const b = worldPointToCanvas(state.to, view);
    const { from: aExt, to: bExt } = extendLineSegment(a, b, state.style.extendLeft, state.style.extendRight, view);
    applyLineStyle(ctx, state.style);
    ctx.beginPath();
    ctx.moveTo(aExt.x, aExt.y);
    ctx.lineTo(bExt.x, bExt.y);
    ctx.stroke();
}
```

(Renderer signature is `(ctx, e, view: Viewport)` — the
canonical viewport type from `coords.ts`. Tasks 6–18 follow the
same signature for every per-kind renderer.)

`extendLineSegment` is a new shared helper in
`packages/canvas2d-adapter/src/render/draw/lineExtend.ts` —
projects the segment to the viewport edges in the appropriate
direction; consumed by `line` + `horizontal-ray`.

`horizontalLine` renders a full-width stroke at the projected y.
`verticalLine` renders a full-height stroke at the projected x.
`crossLine` strokes both.
`trendAngle` strokes the line + draws a small arc + angle text
at the `from` anchor — uses `Math.atan2` for the angle, formats
as `123.4°`.

Wire each renderer into `drawingDispatch`'s switch (replace the
6 no-op stubs).

### 6. Conformance — 6 per-kind scenarios + 1 category bundle

`packages/conformance/src/scenarios/drawLine.scenario.ts`:

```ts
import type { Scenario } from "../runConformanceSuite";

const SOURCE = `
import { defineIndicator, draw } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "drawLine demo",
    apiVersion: 1,
    compute({ bar }) {
        if (bar.time === 1_700_000_000_000) {
            draw.line(
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_086_400_000, price: 110 },
                { color: "#3b82f6", lineWidth: 2 }
            );
        }
    },
});
`.trim();

const SCENARIO: Scenario = {
    id: "draw-line",
    title: "draw.line on a single bar",
    inlineSource: SOURCE,
    intervalCount: 1,
    assertions: [
        { kind: "drawing-hash", sha256: "<pin-from-first-run>" },
        { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
        { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
    ],
};
export default SCENARIO;
```

Five more scenarios for the remaining kinds plus one
`drawLinesAll.scenario.ts` that emits one of each. All inline
sources reference `goldenBars` anchor times (e.g.
`bars[0].time`, `bars[1000].time`).

`scenarios/index.ts` re-exports the 7 new scenarios.

### 7. Tests (§22.10 set per kind)

Per kind:

- `<kind>.test.ts` — unit: handle creation, update path,
  remove path, capability-gated drop, budget-exceeded drop,
  active-context throw.
- `<kind>.property.test.ts` — N updates same bar collapse to one
  emission; cross-bar same iteration retains handle id.
- `<kind>.golden.test.ts` — emit against `goldenBars`; pin
  SHA-256 of the drawings array.
- `<kind>.bench.ts` + `<kind>.bench.test.ts` — `ceil(median × 3)`
  threshold.
- Type test in `<kind>.types.test.ts` — `draw.<kind>(...)` returns
  `DrawingHandle`.

Coverage stays 100% on `packages/runtime`, `packages/adapter-kit`,
`examples/canvas2d-adapter`, `packages/conformance`.

### 8. Docs auto-generation

Run `pnpm docs:generate` (or invoke the gen-docs entry point
Phase 2 shipped) after the JSDoc lands. Six new pages under
`docs/primitives/draw/`: `line.md`, `horizontal-line.md`,
`horizontal-ray.md`, `vertical-line.md`, `cross-line.md`,
`trend-angle.md`. Each carries the `@since`, `@anchors`,
`@example`, stability marker sourced from the JSDoc.

### 9. JSDoc per §17.2

```ts
/**
 * Draw a straight line between two world points.
 *
 * @anchors `from`, `to` — two `WorldPoint`s.
 * @anchorCount 2
 * @bucket lines
 * @since 0.3
 * @experimental
 * @example
 *     import { defineIndicator, draw } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "draw.line demo",
 *         apiVersion: 1,
 *         compute({ bar }) {
 *             draw.line(
 *                 { time: bar.time, price: bar.high },
 *                 { time: bar.time, price: bar.low },
 *                 { color: "#3b82f6" }
 *             );
 *         },
 *     });
 */
export function line(...) { … }
```

`@anchors`, `@anchorCount`, `@bucket` are new doc tags the
gen-docs walker (Task 21 extends) consumes. Task 5 ships only
the tags on the 6 line kinds; subsequent port tasks add them on
their kinds; Task 21 extends the walker.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/runtime/src/emit/draw/{line,horizontalLine,horizontalRay,verticalLine,crossLine,trendAngle}.ts` | Create | Per-kind emit functions. |
| `packages/runtime/src/emit/draw/{...}.test.ts` (×6) | Create | Unit. |
| `packages/runtime/src/emit/draw/{...}.property.test.ts` (×6) | Create | Property. |
| `packages/runtime/src/emit/draw/{...}.golden.test.ts` (×6) | Create | Golden hash. |
| `packages/runtime/src/emit/draw/{...}.bench.ts` + `.bench.test.ts` (×6) | Create | Bench + threshold. |
| `packages/runtime/src/emit/draw/{...}.types.test.ts` (×6) | Create | Type pinning. |
| `packages/runtime/src/emit/draw/index.ts` | Modify | Wire 6 real exports. |
| `packages/core/src/draw/drawingState.ts` | Modify | Refine 6 variants. |
| `packages/adapter-kit/src/validation/validateEmission.ts` | Modify | 6 per-kind validators. |
| `packages/adapter-kit/src/validation/validateEmission.test.ts` | Modify | 6 happy + ≥3 sad path per kind. |
| `examples/canvas2d-adapter/src/render/draw/{line,horizontalLine,horizontalRay,verticalLine,crossLine,trendAngle}.ts` | Create | Renderers. |
| `examples/canvas2d-adapter/src/render/draw/lineExtend.ts` | Create | Viewport-edge extension helper. |
| `examples/canvas2d-adapter/src/render/draw/{...}.test.ts` (×6) | Create | Renderer unit (MockCanvas2DContext call assertions). |
| `examples/canvas2d-adapter/src/render/draw/drawingDispatch.ts` | Modify | Replace 6 no-op stubs. |
| `packages/conformance/src/scenarios/{drawLine,drawHorizontalLine,drawHorizontalRay,drawVerticalLine,drawCrossLine,drawTrendAngle,drawLinesAll}.scenario.ts` | Create | 7 scenarios. |
| `packages/conformance/src/scenarios/index.ts` | Modify | Re-export 7 new scenarios. |
| `docs/primitives/draw/{line,horizontal-line,horizontal-ray,vertical-line,cross-line,trend-angle}.md` | Create | Auto-generated. |
| `.changeset/phase-3-task-5-lines.md` | Create | Minor bumps on runtime, core, adapter-kit, canvas2d, conformance. |

## Gates

- `pnpm typecheck` workspace-wide.
- `pnpm test` (100% coverage on all five packages touched).
- `pnpm conformance` — 7 new scenarios pass; all Phase-1/-2 +
  Tasks 3–4 scenarios still pass.
- `pnpm bench:ci` — 6 new bench thresholds pass.
- `pnpm docs:check`, `pnpm readme:check`.

## Changeset

Minor bumps on `@invinite-org/chartlang-runtime`,
`@invinite-org/chartlang-core`,
`@invinite-org/chartlang-adapter-kit`,
`chartlang-example-canvas2d-adapter`,
`@invinite-org/chartlang-conformance`.

## Acceptance Criteria

- All 6 kinds emit through `draw.<kind>(...)` and round-trip via
  `validateEmission` + `decodeDrawing`.
- Canvas2d renders each kind (visual fidelity acceptable —
  pinned by golden + by conformance scenario hash).
- Per-kind golden hashes pinned.
- 7 conformance scenarios pass (6 per-kind + 1 category bundle).
- Auto-generated docs pages committed.
- 100% coverage maintained across the five touched packages.
- Phase-1/-2 + Tasks 1–4 gates remain green.
- Changeset committed.
