// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

// ---------------------------------------------------------------------------
// Drawing series-primitive (Task 6). lightweight-charts has no native facility
// for the 63 chartlang drawing kinds, so they paint as an overlay through the
// v5 series-primitive plugin API. The factory buffers every live
// `DrawingEmission` (Task 5's `state.drawings`); this primitive's pane-view
// renderer paints them each frame:
//
//   decomposeDrawing(emission, view)  → adapter-kit's renderer-agnostic IR.
//   paintPrimitive(ctx, prim)         → the shared canvas sink.
//   buildViewport(series, ts, scope)  → the LC-converter viewport (see §2).
//
// The buffer is the single source of truth: a scroll / zoom re-invokes `draw`
// with a fresh viewport, and an `op: "remove"` (dropped from the buffer by the
// factory) simply vanishes next frame. The primitive owns NO drawing state.
//
// Type seam: `draw(target)` accepts the real fancy-canvas
// `CanvasRenderingTarget2D` (so `DrawingPrimitive` satisfies LC's
// `ISeriesPrimitive`); the only DOM-bound work is unwrapping its bitmap scope
// and narrowing the real `CanvasRenderingContext2D` to the adapter-kit
// `RenderCtx` (whose setters are `string`, where the DOM widens to
// `string | CanvasGradient | CanvasPattern`). That single narrowing is the
// documented seam — the same one the factory's `defaultCreateChart` uses — so
// `paintInto` (the actual painting) stays fully testable against a mock scope.
// ---------------------------------------------------------------------------

import {
    type DrawingEmission,
    type Viewport,
    decomposeDrawing,
} from "@invinite-org/chartlang-adapter-kit";
import { type RenderCtx, paintPrimitive } from "@invinite-org/chartlang-adapter-kit/canvas";

import {
    type BitmapScope,
    type LwcSeriesProjector,
    type LwcTimeScaleProjector,
    buildViewport,
} from "./viewport.js";

/**
 * The bitmap rendering scope {@link DrawingPrimitive} paints into — the
 * adapter-kit {@link RenderCtx} (a `CanvasRenderingContext2D` in the browser,
 * a `MockCanvasContext` in tests) plus the fancy-canvas size / pixel-ratio
 * fields {@link buildViewport} reads. This is the testable seam: a test
 * constructs one directly with a mock context.
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const ctx: RenderCtx;
 *     const scope: PaintScope = {
 *         context: ctx,
 *         bitmapSize: { width: 800, height: 400 },
 *         mediaSize: { width: 400, height: 200 },
 *         horizontalPixelRatio: 2,
 *         verticalPixelRatio: 2,
 *     };
 *     void scope;
 */
export type PaintScope = BitmapScope & { readonly context: RenderCtx };

/**
 * The fancy-canvas target lightweight-charts passes to a pane renderer's
 * `draw`. A narrow structural subset of fancy-canvas's `CanvasRenderingTarget2D`
 * (not a direct dependency, so re-declared here): only
 * `useBitmapCoordinateSpace` is touched, and its scope is the
 * {@link BitmapScope} fields plus the live drawing context. The DOM context is
 * narrowed to {@link RenderCtx} at the single documented seam in `draw`.
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const target: BitmapDrawTarget;
 *     target.useBitmapCoordinateSpace(() => undefined);
 *     void target;
 */
export type BitmapDrawTarget = {
    useBitmapCoordinateSpace(f: (scope: BitmapScope & { readonly context: unknown }) => void): void;
};

/**
 * The lightweight-charts references the drawing primitive needs once attached:
 * the `series` it hangs off (price converters) and the `chart` (for the time
 * scale). A narrow structural subset of v5's `SeriesAttachedParameter` so the
 * primitive is testable without a real chart; the real attach parameter is
 * structurally assignable.
 *
 * @since 0.1
 * @stable
 * @example
 *     const param: DrawingPrimitiveAttach = {
 *         series: { priceToCoordinate: (p) => p, coordinateToPrice: (y) => y },
 *         chart: { timeScale: () => ({ getVisibleRange: () => null, timeToCoordinate: () => null }) },
 *     };
 *     void param;
 */
export type DrawingPrimitiveAttach = {
    readonly series: LwcSeriesProjector;
    readonly chart: { timeScale(): LwcTimeScaleProjector };
};

/**
 * A `lightweight-charts` series primitive (`ISeriesPrimitive`-shaped) that
 * paints every buffered chartlang {@link DrawingEmission} as an overlay. The
 * factory attaches one instance via `series.attachPrimitive(...)` and feeds it
 * the live drawings buffer; each frame the pane renderer decomposes the live
 * drawings to the shared IR and paints them through the canvas sink against a
 * viewport derived from LC's own converters.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { DrawingPrimitive } from "chartlang-example-lightweight-charts-adapter";
 *     const buffer = new Map();
 *     const primitive = new DrawingPrimitive(buffer);
 *     // series.attachPrimitive(primitive);
 *     void primitive;
 */
export class DrawingPrimitive {
    private attachment: DrawingPrimitiveAttach | undefined;
    private readonly view: DrawingPrimitivePaneView;

    constructor(drawings: ReadonlyMap<string, DrawingEmission>) {
        this.view = new DrawingPrimitivePaneView(() => this.attachment, drawings);
    }

    /**
     * Capture the attach parameter (series + chart) so the renderer can reach
     * LC's converters. Called by lightweight-charts on
     * `series.attachPrimitive(...)`.
     */
    attached(param: DrawingPrimitiveAttach): void {
        this.attachment = param;
    }

    /** Drop the attach parameter on detach so a stale chart isn't retained. */
    detached(): void {
        this.attachment = undefined;
    }

    /** The single pane view whose renderer paints the buffered drawings. */
    paneViews(): readonly DrawingPrimitivePaneView[] {
        return [this.view];
    }
}

/** One pane view backing {@link DrawingPrimitive}; owns the pane renderer. */
class DrawingPrimitivePaneView {
    private readonly paneRenderer: DrawingPrimitivePaneRenderer;

    constructor(
        getAttachment: () => DrawingPrimitiveAttach | undefined,
        drawings: ReadonlyMap<string, DrawingEmission>,
    ) {
        this.paneRenderer = new DrawingPrimitivePaneRenderer(getAttachment, drawings);
    }

    renderer(): DrawingPrimitivePaneRenderer {
        return this.paneRenderer;
    }
}

/** The pane renderer that paints buffered drawings into the bitmap scope. */
class DrawingPrimitivePaneRenderer {
    constructor(
        private readonly getAttachment: () => DrawingPrimitiveAttach | undefined,
        private readonly drawings: ReadonlyMap<string, DrawingEmission>,
    ) {}

    // lightweight-charts hands a real fancy-canvas target. Unwrapping its
    // bitmap scope and narrowing the DOM `CanvasRenderingContext2D` to
    // `RenderCtx` are the only DOM-bound lines (covered by the headless
    // `paintInto` path, exercised directly in tests — same seam as the
    // factory's `defaultCreateChart`).
    /* v8 ignore start -- exercised only against a real fancy-canvas target */
    draw(target: BitmapDrawTarget): void {
        target.useBitmapCoordinateSpace((scope) => {
            this.paintInto({ ...scope, context: scope.context as RenderCtx });
        });
    }
    /* v8 ignore stop */

    /**
     * Paint every live buffered drawing into `scope`. The headless core the
     * DOM `draw` delegates to: builds the LC-converter viewport, then
     * decomposes + paints each non-removed drawing. A test drives this with a
     * mock context + scope.
     */
    paintInto(scope: PaintScope): void {
        const attachment = this.getAttachment();
        // Not attached yet (or detached) → nothing to project against.
        if (attachment === undefined) return;
        const series = attachment.series;
        const timeScale = attachment.chart.timeScale();
        const view: Viewport = buildViewport(series, timeScale, scope);
        for (const drawing of this.drawings.values()) {
            // The factory drops `op: "remove"` from the buffer, but guard
            // defensively so a stale removal never reaches the geometry.
            if (drawing.op === "remove") continue;
            for (const prim of decomposeDrawing(drawing, view)) {
                paintPrimitive(scope.context, prim);
            }
        }
    }
}
