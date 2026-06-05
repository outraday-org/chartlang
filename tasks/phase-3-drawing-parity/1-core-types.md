# Task 1 — Core: `DrawingKind` / `DrawingState` / `WorldPoint` + `STATEFUL_PRIMITIVES` + bucket map

> **Status: TODO**

## Goal

Land the canonical Phase-3 type surface in
`@invinite-org/chartlang-core`: the full 61-entry `DrawingKind`
discriminated union (kebab-case wire format + camelCase TS surface
pinned in one place), the `DrawingState` discriminated union (one
variant per kind, collab-only fields stripped per §10.4), the
`WorldPoint` + per-kind anchor tuple types, the per-kind style bag
types (`LineDrawStyle`, `ShapeStyle`, `FibOpts`, …), the
`DrawingHandle` script-facing shape, the kind → `DrawingCounts`
bucket map, and the 61-entry extension of `STATEFUL_PRIMITIVES`.

## Prerequisites

None. This is the foundational task — every downstream task (Tasks
2–22) imports from here.

## Current Behavior

- `packages/core/src/draw/` does not exist.
- `STATEFUL_PRIMITIVES` ends at 93 entries (90 `ta.*` + `plot` +
  `hline` + `alert`).
- `DrawingHandle` is documented in PLAN.md §10.3 but undeclared in
  code.
- `WorldPoint` is referenced in PLAN.md §10.2 but undeclared.
- `Bar`, `Time`, `Price`, `Color`, `LineStyle`, `JsonValue` are
  declared in `packages/core/src/types.ts` and reused by Phase 3 as-is.

## Desired Behavior

After this task:

- `import { draw } from "@invinite-org/chartlang-core"` exposes the
  script-facing `DrawNamespace` type (impl lives in the runtime —
  this task ships only the type).
- `DrawingKind` is the canonical 61-entry kebab-case union pinned in
  `packages/core/src/draw/drawingKind.ts` and re-exported from the
  package barrel.
- `DRAWING_KINDS: ReadonlyArray<DrawingKind>` is iterable at runtime
  for validator dispatch + docs generation.
- `KIND_CAMELCASE: ReadonlyMap<DrawingKind, string>` and
  `KIND_KEBABCASE: ReadonlyMap<string, DrawingKind>` pin the bijection.
- `DrawingState` is the per-kind discriminated union — every variant
  carries `kind: DrawingKind` plus geometry + style fields only.
- `WorldPoint = { time: Time; price: Price }` is exported.
- `bucketFor(kind: DrawingKind): keyof DrawingCounts` returns the
  canonical bucket for every kind. Tested over all 61 kinds.
- `STATEFUL_PRIMITIVES` cardinality is **154 entries** (93 from
  Phase 2 + 61 new `draw.<kind>` entries with `slot: true`).
- `DrawingHandle` script-facing type exported from `core` (impl in
  runtime).

## Requirements

### 1. `packages/core/src/draw/drawingKind.ts`

Pin the 61-entry union + the camelCase ↔ kebab-case bijection.

```ts
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * The full set of 61 drawing kinds chartlang supports through
 * `draw.*`. The wire format is kebab-case; the TypeScript script
 * surface is camelCase (`draw.horizontalLine(...)`). See
 * {@link KIND_CAMELCASE} for the canonical bijection.
 *
 * Variant collapses pinned in §3.1:
 * - `ray` / `extended-line` collapse into `line` with
 *   `extendLeft` / `extendRight` flags on the state.
 * - The 4 invinite pitchfork tools (standard / schiff /
 *   modifiedSchiff / inside) collapse into `pitchfork` with a
 *   `variant` discriminator on the state.
 * - `cypher-pattern` has no standalone tool — emittable only
 *   through `defineDrawing` (Task 20).
 *
 * Order pinned: lines (6) → boxes (8) → curves (3) →
 * freehand (3) → annotations (5) → channels (4) → fib (10) →
 * gann (4) → pitchforks (2) → patterns (6) → elliott (5) →
 * cycles (3) → containers (2) = 61. The order is wire-stable —
 * downstream consumers iterate {@link DRAWING_KINDS} in this
 * order for diagnostic readability.
 *
 * @since 0.3
 * @experimental
 * @example
 *     const k: DrawingKind = "fib-retracement";
 */
export type DrawingKind =
    // Lines / Rays (6)
    | "line"
    | "horizontal-line"
    | "horizontal-ray"
    | "vertical-line"
    | "cross-line"
    | "trend-angle"
    // Boxes / Shapes (8)
    | "rectangle"
    | "rotated-rectangle"
    | "triangle"
    | "polyline"
    | "circle"
    | "ellipse"
    | "path"
    | "marker"
    // Curves (3)
    | "arc"
    | "curve"
    | "double-curve"
    // Freehand (3)
    | "pen"
    | "highlighter"
    | "brush"
    // Annotations (5)
    | "text"
    | "arrow"
    | "arrow-marker"
    | "arrow-mark-up"
    | "arrow-mark-down"
    // Channels (4)
    | "trend-channel"
    | "flat-top-bottom"
    | "disjoint-channel"
    | "regression-trend"
    // Fibonacci (10)
    | "fib-retracement"
    | "fib-trend-extension"
    | "fib-channel"
    | "fib-time-zone"
    | "fib-wedge"
    | "fib-speed-fan"
    | "fib-speed-arcs"
    | "fib-spiral"
    | "fib-circles"
    | "fib-trend-time"
    // Gann (4)
    | "gann-box"
    | "gann-square-fixed"
    | "gann-square"
    | "gann-fan"
    // Pitchforks (2)
    | "pitchfork"
    | "pitchfan"
    // Harmonic Patterns (6)
    | "xabcd-pattern"
    | "cypher-pattern"
    | "head-and-shoulders"
    | "abcd-pattern"
    | "triangle-pattern"
    | "three-drives-pattern"
    // Elliott Waves (5)
    | "elliott-impulse-wave"
    | "elliott-correction-wave"
    | "elliott-triangle-wave"
    | "elliott-double-combo"
    | "elliott-triple-combo"
    // Cycles (3)
    | "cyclic-lines"
    | "time-cycles"
    | "sine-line"
    // Containers (2)
    | "group"
    | "frame";

/** Iterable form of {@link DrawingKind}. Order matches the union. */
export const DRAWING_KINDS: ReadonlyArray<DrawingKind> = Object.freeze([
    "line", "horizontal-line", "horizontal-ray", "vertical-line", "cross-line", "trend-angle",
    "rectangle", "rotated-rectangle", "triangle", "polyline", "circle", "ellipse", "path", "marker",
    "arc", "curve", "double-curve",
    "pen", "highlighter", "brush",
    "text", "arrow", "arrow-marker", "arrow-mark-up", "arrow-mark-down",
    "trend-channel", "flat-top-bottom", "disjoint-channel", "regression-trend",
    "fib-retracement", "fib-trend-extension", "fib-channel", "fib-time-zone", "fib-wedge",
    "fib-speed-fan", "fib-speed-arcs", "fib-spiral", "fib-circles", "fib-trend-time",
    "gann-box", "gann-square-fixed", "gann-square", "gann-fan",
    "pitchfork", "pitchfan",
    "xabcd-pattern", "cypher-pattern", "head-and-shoulders", "abcd-pattern",
    "triangle-pattern", "three-drives-pattern",
    "elliott-impulse-wave", "elliott-correction-wave", "elliott-triangle-wave",
    "elliott-double-combo", "elliott-triple-combo",
    "cyclic-lines", "time-cycles", "sine-line",
    "group", "frame",
]);

/**
 * camelCase TS surface name for every kind. Used by the editor
 * + gen-docs to surface `draw.horizontalLine` etc.
 */
export const KIND_CAMELCASE: ReadonlyMap<DrawingKind, string> = new Map([
    ["line", "line"],
    ["horizontal-line", "horizontalLine"],
    ["horizontal-ray", "horizontalRay"],
    ["vertical-line", "verticalLine"],
    ["cross-line", "crossLine"],
    ["trend-angle", "trendAngle"],
    ["rectangle", "rectangle"],
    ["rotated-rectangle", "rotatedRectangle"],
    ["triangle", "triangle"],
    ["polyline", "polyline"],
    ["circle", "circle"],
    ["ellipse", "ellipse"],
    ["path", "path"],
    ["marker", "marker"],
    ["arc", "arc"], ["curve", "curve"], ["double-curve", "doubleCurve"],
    ["pen", "pen"], ["highlighter", "highlighter"], ["brush", "brush"],
    ["text", "text"], ["arrow", "arrow"],
    ["arrow-marker", "arrowMarker"],
    ["arrow-mark-up", "arrowMarkUp"],
    ["arrow-mark-down", "arrowMarkDown"],
    ["trend-channel", "trendChannel"],
    ["flat-top-bottom", "flatTopBottom"],
    ["disjoint-channel", "disjointChannel"],
    ["regression-trend", "regressionTrend"],
    ["fib-retracement", "fibRetracement"],
    ["fib-trend-extension", "fibTrendExtension"],
    ["fib-channel", "fibChannel"],
    ["fib-time-zone", "fibTimeZone"],
    ["fib-wedge", "fibWedge"],
    ["fib-speed-fan", "fibSpeedFan"],
    ["fib-speed-arcs", "fibSpeedArcs"],
    ["fib-spiral", "fibSpiral"],
    ["fib-circles", "fibCircles"],
    ["fib-trend-time", "fibTrendTime"],
    ["gann-box", "gannBox"],
    ["gann-square-fixed", "gannSquareFixed"],
    ["gann-square", "gannSquare"],
    ["gann-fan", "gannFan"],
    ["pitchfork", "pitchfork"], ["pitchfan", "pitchfan"],
    ["xabcd-pattern", "xabcdPattern"],
    ["cypher-pattern", "cypherPattern"],
    ["head-and-shoulders", "headAndShoulders"],
    ["abcd-pattern", "abcdPattern"],
    ["triangle-pattern", "trianglePattern"],
    ["three-drives-pattern", "threeDrivesPattern"],
    ["elliott-impulse-wave", "elliottImpulseWave"],
    ["elliott-correction-wave", "elliottCorrectionWave"],
    ["elliott-triangle-wave", "elliottTriangleWave"],
    ["elliott-double-combo", "elliottDoubleCombo"],
    ["elliott-triple-combo", "elliottTripleCombo"],
    ["cyclic-lines", "cyclicLines"],
    ["time-cycles", "timeCycles"],
    ["sine-line", "sineLine"],
    ["group", "group"], ["frame", "frame"],
]);

/** Inverse of {@link KIND_CAMELCASE}. */
export const KIND_KEBABCASE: ReadonlyMap<string, DrawingKind> = new Map(
    Array.from(KIND_CAMELCASE, ([k, v]) => [v, k]),
);
```

Unit test asserts `DRAWING_KINDS.length === 61`,
`KIND_CAMELCASE.size === 61`, and `KIND_KEBABCASE.size === 61`.
Property test asserts the bijection round-trips.

### 2. `packages/core/src/draw/worldPoint.ts`

```ts
import type { Price, Time } from "../types";

/**
 * World coordinate — `(time, price)` is the only persisted frame
 * for drawings. The adapter projects to its own pixel space.
 *
 * @since 0.3
 * @experimental
 * @example
 *     const anchor: WorldPoint = { time: 1_700_000_000_000, price: 42.31 };
 */
export type WorldPoint = { readonly time: Time; readonly price: Price };

/** Anchor tuple helpers — one per common arity. */
export type AnchorPair = readonly [WorldPoint, WorldPoint];
export type AnchorTriple = readonly [WorldPoint, WorldPoint, WorldPoint];
export type AnchorQuad = readonly [WorldPoint, WorldPoint, WorldPoint, WorldPoint];
export type AnchorQuint = readonly [WorldPoint, WorldPoint, WorldPoint, WorldPoint, WorldPoint];
export type AnchorHept = readonly [WorldPoint, WorldPoint, WorldPoint, WorldPoint, WorldPoint, WorldPoint, WorldPoint];
```

### 3. `packages/core/src/draw/drawingStyle.ts`

Pin every style bag pictured in PLAN.md §10.2. Each type carries
`readonly` fields and is JsonValue-clean. Examples:

```ts
import type { Color, LineStyle } from "../types";

export type LineDrawStyle = {
    readonly color?: Color;
    readonly lineWidth?: number;
    readonly lineStyle?: LineStyle;
    /** Phase-3 line-collapse — `ray` → `extendLeft: false, extendRight: true`. */
    readonly extendLeft?: boolean;
    readonly extendRight?: boolean;
};

export type ShapeStyle = {
    readonly stroke?: Color;
    readonly fill?: Color;
    readonly lineWidth?: number;
    readonly lineStyle?: LineStyle;
    readonly fillAlpha?: number;
};

export type HighlighterStyle = { readonly color: Color; readonly alpha: number };
export type BrushStyle = { readonly stroke: Color; readonly fill: Color };

export type TextOpts = {
    readonly color?: Color;
    readonly size?: "tiny" | "small" | "normal" | "large" | "huge";
    readonly halign?: "left" | "center" | "right";
    readonly valign?: "top" | "middle" | "bottom";
    readonly bgColor?: Color;
};

export type ArrowOpts = LineDrawStyle & { readonly label?: string };

export type ArrowMarkerOpts = {
    readonly color?: Color;
    readonly text?: string;
};

export type PathOpts = LineDrawStyle & { readonly closed?: boolean };

export type FibOpts = {
    readonly levels?: ReadonlyArray<number>;
    readonly showLabels?: boolean;
    readonly color?: Color;
    readonly extendLeft?: boolean;
    readonly extendRight?: boolean;
};

export type RegressionTrendOpts = {
    readonly source?: "close" | "open" | "high" | "low" | "hl2" | "hlc3" | "ohlc4" | "hlcc4";
    readonly stdevMultiplier?: number;
    readonly showUpperBand?: boolean;
    readonly showLowerBand?: boolean;
    readonly color?: Color;
};

export type FrameOpts = { readonly label?: string; readonly bgColor?: Color };
```

Per-kind style bags MUST be JsonValue-clean — no functions / dates /
maps. Type test (`drawingStyle.types.test.ts`) asserts each is
`assignable to Readonly<Record<string, JsonValue | undefined>>`.

### 4. `packages/core/src/draw/drawingState.ts`

The discriminated union. One variant per kind. Lift geometry +
style fields from
`../invinite/shared/trading-chart-collab-yjs/y-doc-bridge.ts` per
the per-kind specs in Tasks 5–18; collab-only fields (Yjs `id`,
`layerId`, `createdAt`, `authorId`, `parentGroupId`,
`parentFrameId`, `visibleIntervals`) are stripped.

```ts
import type {
    AnchorHept, AnchorPair, AnchorQuad, AnchorQuint, AnchorTriple, WorldPoint,
} from "./worldPoint";
import type { DrawingKind } from "./drawingKind";
import type {
    ArrowMarkerOpts, ArrowOpts, BrushStyle, FibOpts, FrameOpts,
    HighlighterStyle, LineDrawStyle, PathOpts, RegressionTrendOpts,
    ShapeStyle, TextOpts,
} from "./drawingStyle";
import type { Color, Price, Time } from "../types";

/** Optional `name` / `visible` script-mutable metadata (§10.0). */
export type DrawingMeta = {
    readonly name?: string;
    readonly visible?: boolean;
};

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

// … one variant per kind. Full enumeration lives in this file.

export type DrawingState =
    | LineState
    | HorizontalLineState
    // … 59 more (full set fleshed out per-task in Tasks 5–18; this
    // task ships the 61 variant declarations, each populated only
    // with anchor tuple + style bag + DrawingMeta. The detailed
    // semantics (e.g. fib level set, elliott label arrays) are
    // refined in the per-category task that lands the impl.)
    ;
```

The shell of every variant ships in this task (60+ minimal
declarations); per-category tasks (5–18) refine each variant's
fields against the invinite source. A property test asserts every
`DrawingKind` has a matching variant in the union (compile-time
exhaustiveness via the `exhaustive(k satisfies never)` switch
pattern).

### 5. `packages/core/src/draw/handle.ts`

```ts
import type { DrawingState } from "./drawingState";

/**
 * Script-facing handle returned by every `draw.<kind>(...)` call.
 * The runtime keys it by `slotId#subId` — same loop iteration
 * across bars yields the same handle. `update(patch)` re-emits the
 * full merged state; `remove()` emits one final `op: "remove"`.
 *
 * @since 0.3
 * @experimental
 * @example
 *     const support = draw.horizontalLine(supportLevel, { color: "#22c55e" });
 *     // next bar:
 *     support.update({ price: newSupportLevel });
 */
export type DrawingHandle = {
    readonly id: string;
    update(patch: Partial<DrawingState>): void;
    remove(): void;
};
```

### 6. `packages/core/src/draw/draw.ts`

```ts
import type { DrawingHandle } from "./handle";
// … per-kind argument types per §10.2

/**
 * The script-facing `draw.*` namespace. Each method is stateful
 * across calls (compiler injects the callsite slot id) and returns
 * a {@link DrawingHandle}.
 *
 * Phase-3 impls live in `@invinite-org/chartlang-runtime`; this
 * file ships the script-author type only. Tasks 5–18 land the
 * runtime impl per category.
 *
 * @since 0.3
 * @experimental
 */
export type DrawNamespace = {
    line(from: WorldPoint, to: WorldPoint, style?: LineDrawStyle): DrawingHandle;
    horizontalLine(price: Price, style?: LineDrawStyle): DrawingHandle;
    // … 59 more
    readonly fib: FibSubNamespace;
    readonly gann: GannSubNamespace;
    readonly elliott: ElliottSubNamespace;
    readonly pattern: PatternSubNamespace;
};
```

Plus a throwing-stub `draw` value declared next to the type in
`packages/core/src/draw/draw.ts` (mirrors `plot/plot.ts:129`
which exports `plot()` as a sentinel-error stub):

```ts
function throwStub(method: string): never {
    throw new Error(
        `draw.${method} called outside an active script step — ` +
        `the runtime swaps the core stub at boot (PLAN.md §5.5).`,
    );
}

export const draw: DrawNamespace = new Proxy({} as DrawNamespace, {
    get(_t, p) { return () => throwStub(String(p)); },
});
```

`packages/runtime/src/emit/draw/index.ts` (Task 3) exports a
real `draw` namespace; the compiler rewrites
`import { draw } from "@invinite-org/chartlang-core"` to import
from `@invinite-org/chartlang-runtime` per the same
`primitives.ts` seam Phase 1 established for `ta` / `plot`.

### 7. `packages/core/src/draw/buckets.ts`

```ts
import type { DrawingKind } from "./drawingKind";

/** `keyof DrawingCounts` — re-exported from adapter-kit. Pinned
 *  here so the bucket map can live in core and be consumed by
 *  both adapter-kit and the runtime. */
export type DrawingBucket = "lines" | "labels" | "boxes" | "polylines" | "other";

/**
 * Canonical kind → bucket map. Pinned table; covers all 61 kinds
 * exhaustively. Test asserts every kind appears exactly once.
 */
export const KIND_BUCKET: ReadonlyMap<DrawingKind, DrawingBucket> = new Map([
    ["line", "lines"],
    ["horizontal-line", "lines"],
    ["horizontal-ray", "lines"],
    ["vertical-line", "lines"],
    ["cross-line", "lines"],
    ["trend-angle", "lines"],
    ["rectangle", "boxes"],
    ["rotated-rectangle", "boxes"],
    ["triangle", "boxes"],
    ["polyline", "polylines"],
    ["circle", "boxes"],
    ["ellipse", "boxes"],
    ["path", "polylines"],
    ["marker", "labels"],
    ["arc", "polylines"],
    ["curve", "polylines"],
    ["double-curve", "polylines"],
    ["pen", "polylines"],
    ["highlighter", "polylines"],
    ["brush", "polylines"],
    ["text", "labels"],
    ["arrow", "labels"],
    ["arrow-marker", "labels"],
    ["arrow-mark-up", "labels"],
    ["arrow-mark-down", "labels"],
    ["trend-channel", "polylines"],
    ["flat-top-bottom", "polylines"],
    ["disjoint-channel", "polylines"],
    ["regression-trend", "polylines"],
    ["fib-retracement", "other"],
    ["fib-trend-extension", "other"],
    ["fib-channel", "other"],
    ["fib-time-zone", "other"],
    ["fib-wedge", "other"],
    ["fib-speed-fan", "other"],
    ["fib-speed-arcs", "other"],
    ["fib-spiral", "other"],
    ["fib-circles", "other"],
    ["fib-trend-time", "other"],
    ["gann-box", "other"],
    ["gann-square-fixed", "other"],
    ["gann-square", "other"],
    ["gann-fan", "other"],
    ["pitchfork", "polylines"],
    ["pitchfan", "polylines"],
    ["xabcd-pattern", "polylines"],
    ["cypher-pattern", "polylines"],
    ["head-and-shoulders", "polylines"],
    ["abcd-pattern", "polylines"],
    ["triangle-pattern", "polylines"],
    ["three-drives-pattern", "polylines"],
    ["elliott-impulse-wave", "polylines"],
    ["elliott-correction-wave", "polylines"],
    ["elliott-triangle-wave", "polylines"],
    ["elliott-double-combo", "polylines"],
    ["elliott-triple-combo", "polylines"],
    ["cyclic-lines", "other"],
    ["time-cycles", "other"],
    ["sine-line", "other"],
    ["group", "other"],
    ["frame", "other"],
]);

export function bucketFor(kind: DrawingKind): DrawingBucket {
    const b = KIND_BUCKET.get(kind);
    /* v8 ignore next 2 -- KIND_BUCKET is exhaustive (test pins). */
    if (b === undefined) throw new Error(`No bucket for drawing kind '${kind}'`);
    return b;
}
```

Unit test: `for (const k of DRAWING_KINDS) expect(KIND_BUCKET.has(k)).toBe(true)`.
Property test: `bucketFor(k)` for every `k ∈ DRAWING_KINDS` returns
a non-empty bucket string.

### 8. `packages/core/src/draw/index.ts`

Barrel — re-export every public type + the `bucketFor` function +
`DRAWING_KINDS` + `KIND_CAMELCASE` / `KIND_KEBABCASE`.

### 9. `packages/core/src/index.ts` updates

Add the draw barrel re-export:

```ts
export type { DrawingHandle, DrawingKind, DrawingState, DrawNamespace, WorldPoint } from "./draw";
export { DRAWING_KINDS, KIND_CAMELCASE, KIND_KEBABCASE, bucketFor } from "./draw";
export { draw } from "./draw";  // throwing stub — runtime swaps at boot
```

### 10. `packages/core/src/statefulPrimitives.ts` extension

Append 61 entries (one per kind, the camelCase form prefixed with
`draw.`) all `slot: true`. Cardinality after this task: **154
entries**.

```ts
// Append AFTER the existing plot / hline / alert entries
// (statefulPrimitives.ts:108-110 today) — i.e. at the very end
// of STATEFUL_PRIMITIVE_ENTRIES, so the array order stays:
// 90 ta.* → ta.nz → plot → hline → alert → 61 draw.*:
{ name: "draw.line", slot: true },
{ name: "draw.horizontalLine", slot: true },
{ name: "draw.horizontalRay", slot: true },
// … 58 more in KIND_CAMELCASE order, then:
{ name: "draw.frame", slot: true },
```

Unit test extension: `STATEFUL_PRIMITIVES.size === 154` (a
`ReadonlySet`, so `.size` not `.length`) and every
`KIND_CAMELCASE.get(k)` is present prefixed by `"draw."`.

### 11. Tests

- `packages/core/src/draw/drawingKind.test.ts` — cardinality (61),
  bijection round-trip, `DRAWING_KINDS` order matches the union
  declaration.
- `packages/core/src/draw/buckets.test.ts` — every kind has a
  bucket; `bucketFor` returns valid `DrawingBucket` for every
  kind.
- `packages/core/src/draw/worldPoint.types.test.ts` — `WorldPoint`
  assignable to `Readonly<Record<string, Time | Price>>`.
- `packages/core/src/draw/drawingState.types.test.ts` — every
  variant carries `kind` field; the `kind` field is assignable to
  `DrawingKind`; exhaustiveness via `(k satisfies never)` switch.
- `packages/core/src/draw/handle.types.test.ts` — `DrawingHandle`
  matches PLAN.md §10.3.
- `packages/core/src/statefulPrimitives.test.ts` — extend existing
  cardinality test from 93 to 154; add per-kind presence test.

Coverage stays 100% on `packages/core`. The `index.ts` barrels and
`types.ts` are §16.4 exemptions; `drawingKind.ts` /
`worldPoint.ts` / `drawingStyle.ts` are type-only modules and join
the `types.ts` exemption pattern (mark via the same
`vitest.config.ts` exclude pattern OR keep `bucketFor` + the
`DRAWING_KINDS` / `KIND_CAMELCASE` exports in `buckets.ts` /
`drawingKind.ts` where they DO have runtime code, which is the
default — verify the config excludes the right files).

### 12. JSDoc per §17.2

Every export carries `@since 0.3`, `@experimental`, `@example`.
The `@example` for `DrawingKind` compiles through the existing
`docs:check` executor. `DrawNamespace`'s `@example` references the
runtime impl that lands in Tasks 3–18; until Task 3 lands, the
example uses the camelCase TS surface only.

### 13. `ScriptManifest.maxDrawings?` + `DefineIndicatorOpts.maxDrawings?`

`packages/core/src/types.ts` — extend `ScriptManifest` with an
optional per-bucket cap:

```ts
export type ScriptManifest = {
    // … existing 9 fields (apiVersion, kind, name, inputs,
    // capabilities, requestedIntervals, userPickableInterval,
    // seriesCapacities, maxLookback) unchanged …

    /**
     * Per-bucket cap on the number of `draw.*` emissions the
     * script intends to produce per bar. The runtime enforces
     * `min(this, adapter.capabilities.maxDrawingsPerScript)`
     * per §10 / §4.1. Omit to default to the adapter's cap.
     *
     * @since 0.3
     * @experimental
     */
    readonly maxDrawings?: DrawingCounts;
};
```

`DrawingCounts` is imported into `core/src/types.ts` from
`@invinite-org/chartlang-adapter-kit` — already a stable Phase-1
shape (`{ lines, labels, boxes, polylines, other }`). The import
direction (core ← adapter-kit) is acceptable per PLAN.md §16.2 —
core consumes adapter-kit's wire-shape declarations through type
imports only.

`packages/core/src/define/defineIndicator.ts` — extend
`DefineIndicatorOpts` with the same optional field and propagate
it into the manifest the constructor emits:

```ts
export type DefineIndicatorOpts = Readonly<{
    // … existing fields unchanged …
    readonly maxDrawings?: DrawingCounts;
}>;

// inside defineIndicator(opts):
return {
    manifest: {
        // … existing fields …
        maxDrawings: opts.maxDrawings,  // pass through; undefined if omitted
    },
    compute: opts.compute,
};
```

Task 20 (`defineDrawing`) consumes the same field; Task 3
(`createScriptRunner.ts`) reads `compiled.manifest.maxDrawings`
to populate `ctx.scriptMaxDrawings`.

Add `maxDrawings` to `DefineIndicatorOpts`'s JSDoc; bump
`@since 0.3` on the field only.

### 14. README extension

`packages/core/README.md` adds a "Drawing types (Phase 3)" entry
to the public-surface section. Cap at 100 lines per §17 — trim
existing entries if needed.

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `packages/core/src/draw/drawingKind.ts` | Create | 61-kind union + `DRAWING_KINDS` + camelCase/kebab-case maps. |
| `packages/core/src/draw/worldPoint.ts` | Create | `WorldPoint` + anchor tuple helpers. |
| `packages/core/src/draw/drawingStyle.ts` | Create | Per-kind style bag types. |
| `packages/core/src/draw/drawingState.ts` | Create | Discriminated `DrawingState` union (61 variants — shells). |
| `packages/core/src/draw/handle.ts` | Create | `DrawingHandle` script-facing type. |
| `packages/core/src/draw/draw.ts` | Create | `DrawNamespace` type + throwing-stub `draw` value. |
| `packages/core/src/draw/buckets.ts` | Create | Kind → bucket map + `bucketFor`. |
| `packages/core/src/draw/index.ts` | Create | Barrel. |
| `packages/core/src/draw/drawingKind.test.ts` | Create | Cardinality + bijection tests. |
| `packages/core/src/draw/buckets.test.ts` | Create | Bucket-map exhaustiveness. |
| `packages/core/src/draw/drawingState.types.test.ts` | Create | Exhaustiveness + kind-field consistency. |
| `packages/core/src/draw/worldPoint.types.test.ts` | Create | `WorldPoint` shape pinning. |
| `packages/core/src/draw/handle.types.test.ts` | Create | `DrawingHandle` shape pinning. |
| `packages/core/src/draw/drawingStyle.types.test.ts` | Create | Style-bag shape pinning. |
| `packages/core/src/statefulPrimitives.ts` | Modify | Append 61 `draw.<camelKind>` entries. |
| `packages/core/src/statefulPrimitives.test.ts` | Modify | Bump cardinality from 93 → 154; add per-kind presence test. |
| `packages/core/src/index.ts` | Modify | Re-export draw barrel + `draw` throwing stub. |
| `packages/core/src/types.ts` | Modify | Add `ScriptManifest.maxDrawings?: DrawingCounts`. |
| `packages/core/src/define/defineIndicator.ts` | Modify | Add `DefineIndicatorOpts.maxDrawings?: DrawingCounts`; propagate into manifest. |
| `packages/core/src/define/defineIndicator.test.ts` | Modify | Cover the `maxDrawings` propagation path. |
| `packages/core/README.md` | Modify | Add "Drawing types (Phase 3)" entry. |
| `.changeset/phase-3-task-1-core-types.md` | Create | `@invinite-org/chartlang-core` minor. |

## Gates

- `pnpm -F @invinite-org/chartlang-core typecheck`
- `pnpm -F @invinite-org/chartlang-core test` (coverage 100%)
- `pnpm lint`
- `pnpm docs:check` (every new `@example` compiles)
- `pnpm readme:check` (`packages/core/README.md` ≤ 100 lines)

`pnpm conformance` is unchanged at this task — nothing emits
drawings yet.

## Changeset

`.changeset/phase-3-task-1-core-types.md` —
`@invinite-org/chartlang-core: minor`. Description: "Add `draw.*`
type surface — `DrawingKind` / `DrawingState` / `WorldPoint` /
`DrawingHandle`, the kind → bucket map, the 61-entry extension of
`STATEFUL_PRIMITIVES`. Phase 3 foundation. No runtime behavior
change; `draw` is a throwing stub until Task 3 wires the runtime."

## Acceptance Criteria

- `pnpm typecheck` green across the workspace.
- `DRAWING_KINDS.length === 61`, `KIND_CAMELCASE.size === 61`,
  `KIND_BUCKET.size === 61` enforced by tests.
- `STATEFUL_PRIMITIVES.size === 154`; every `KIND_CAMELCASE.get(k)`
  is present prefixed by `"draw."`.
- `ScriptManifest.maxDrawings?: DrawingCounts` ships;
  `DefineIndicatorOpts.maxDrawings?` propagates into the
  manifest (test pinned).
- Every `DrawingState` variant declares `kind: DrawingKind`;
  exhaustiveness asserted via `(k satisfies never)`.
- 100% coverage on `packages/core` (line / statement / branch /
  function).
- `pnpm docs:check` green — every `@example` compiles.
- `pnpm readme:check` green — `packages/core/README.md` ≤ 100
  lines.
- Phase-2 gates remain green.
- Changeset committed.
