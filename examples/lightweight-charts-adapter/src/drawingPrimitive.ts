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
// Task 12 layers three more overlay passes onto the SAME primitive — LC has no
// native facility for any of them either:
//
//   - bg-color bands: per-bar background stripes (LC's background is a single
//     chart-layout option, not a per-bar band) painted full-pane-height,
//     honouring the 3-state `colorValue` + `transp` opacity.
//   - alertConditions + logs: always-on-top panels mirroring canvas2d's
//     `render/alertConditions.ts` + `render/logPane.ts`.
//
// Z-ORDER: drawings, bg-color bands, and overlay-routed glyphs are the
// overlay-painted marks. They share ONE `(z, band, seq)` sort via the shared
// adapter-kit `sortByRenderOrder` + `RENDER_BAND` (no hand-port), so a `z:-1`
// drawing sits beneath a `z:0` band. Native LC series (lines / candles / price
// lines) are LC-managed and CANNOT be repainted, so their z is best-effort via
// series-creation order only — the shared sort governs the overlay layer.
// Alert conditions + logs are NOT in the sort: per the v1 deferral they paint
// always-on-top, after the sorted pass.
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
    type AlertConditionEmission,
    type DrawingEmission,
    type LogEmission,
    type PlotStyle,
    type RenderOrderKey,
    type Viewport,
    RENDER_BAND,
    decomposeDrawing,
    priceToY,
    sortByRenderOrder,
    timeToX,
} from "@invinite-org/chartlang-adapter-kit";
import {
    type RenderCtx,
    drawMarker,
    drawShape,
    paintPrimitive,
} from "@invinite-org/chartlang-adapter-kit/canvas";

import {
    type BitmapScope,
    type LwcSeriesProjector,
    type LwcTimeScaleProjector,
    buildViewport,
} from "./viewport.js";

/**
 * An overlay-routed glyph the {@link DrawingPrimitive} paints via the shared
 * adapter-kit glyph helper — a `shape` / `marker` whose shape LC's native
 * markers plugin cannot express (triangle / diamond / cross / xcross / flag).
 * `time` is the glyph's already-shifted bar time and `value` its price; the
 * primitive projects both through the same `Viewport` it uses for drawings.
 *
 * @since 1.8
 * @stable
 * @example
 *     const g: GlyphMark = {
 *         time: 1000,
 *         value: 42,
 *         color: "#26a69a",
 *         style: { kind: "marker", shape: "diamond", size: 8 },
 *     };
 *     void g;
 */
export type GlyphMark = {
    readonly time: number;
    readonly value: number;
    readonly color: string | null;
    readonly style: Extract<PlotStyle, { kind: "shape" } | { kind: "marker" }>;
};

/**
 * A per-bar `bg-color` background band the {@link DrawingPrimitive} paints as a
 * full-pane-height stripe centred on the bar's projected x. lightweight-charts'
 * background is a single chart-layout option — not a per-bar band — so a
 * `bg-color` emission paints through this overlay instead. The factory resolves
 * the 3-state `colorValue` at ingest (so `color` here is the concrete colour to
 * paint; a `null` gap bar is never buffered) and `transp` (0–100) maps to the
 * stripe's opacity. `spacing` is the world-time width of one bar (the projected
 * stripe width), resolved at ingest from the run's median bar spacing.
 *
 * @since 1.9
 * @stable
 * @example
 *     const b: BgBand = {
 *         time: 1000,
 *         color: "#26a69a",
 *         transp: 70,
 *         spacing: 86_400_000,
 *         z: 0,
 *         band: 3,
 *         seq: 0,
 *     };
 *     void b;
 */
export type BgBand = RenderOrderKey & {
    readonly time: number;
    readonly color: string;
    readonly transp?: number;
    readonly spacing: number;
};

// Default glyph colour when the emission carries a `null` top-level colour —
// matches the canvas-family glyph fallback so overlay glyphs read consistently.
const GLYPH_DEFAULT_COLOR = "#3b82f6";

// One overlay-painted mark in the z-sorted pass: a buffered drawing, a
// bg-color band, or an overlay-routed glyph. Each carries its `(z, band, seq)`
// key (the shared `sortByRenderOrder` contract) plus a discriminant payload so
// the sorted pass dispatches to the right painter. Alert conditions + logs are
// NOT marks here — they paint always-on-top after the sort (v1 deferral).
type OverlayMark = RenderOrderKey &
    (
        | { readonly kind: "drawing"; readonly drawing: DrawingEmission }
        | { readonly kind: "bgBand"; readonly bgBand: BgBand }
        | { readonly kind: "glyph"; readonly glyph: GlyphMark }
    );

// The default bands the parallel-key fallbacks use (the factory normally writes
// a concrete key per mark). Glyphs sit in the glyph band, drawings + bg-color
// bands in the drawing band (bg bands are drawing-like overlay fills).
const GLYPH_BAND = RENDER_BAND.glyph;
const DRAWING_BAND = RENDER_BAND.drawing;

/**
 * The bitmap rendering scope {@link DrawingPrimitive} paints into — the
 * adapter-kit {@link RenderCtx} (a `CanvasRenderingContext2D` in the browser,
 * a `MockCanvasContext` in tests) plus the fancy-canvas size / pixel-ratio
 * fields {@link buildViewport} reads. This is the testable seam: a test
 * constructs one directly with a mock context.
 *
 * @since 1.4
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
 * @since 1.4
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
 * @since 1.4
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
 * The live overlay buffers the {@link DrawingPrimitive} reads each frame, all
 * owned by the factory (the primitive holds NO state of its own). `drawings`
 * and `glyphs` are the Task-6 / Task-11 buffers; `drawingKeys` / `glyphKeys`
 * carry their parallel `(z, band, seq)` ingest keys (the raw `DrawingEmission`
 * carries `z` but no `seq`, and a `GlyphMark` carries neither), written by the
 * factory in lockstep so the z-sort is total + deterministic. `bgBands` are the
 * Task-12 per-bar background bands (already key-bearing). `alertConditions` /
 * `logs` paint always-on-top, after the sorted pass (NOT in the z-sort — the
 * v1 deferral). Every field defaults empty so a drawing-only frame is
 * byte-identical to the pre-Task-12 overlay.
 *
 * @since 1.9
 * @stable
 * @example
 *     const buffers: OverlayBuffers = {
 *         drawings: new Map(),
 *         glyphs: new Map(),
 *         drawingKeys: new Map(),
 *         glyphKeys: new Map(),
 *         bgBands: new Map(),
 *         alertConditions: [],
 *         logs: [],
 *     };
 *     void buffers;
 */
export type OverlayBuffers = {
    readonly drawings: ReadonlyMap<string, DrawingEmission>;
    readonly glyphs: ReadonlyMap<string, GlyphMark>;
    readonly drawingKeys: ReadonlyMap<string, RenderOrderKey>;
    readonly glyphKeys: ReadonlyMap<string, RenderOrderKey>;
    readonly bgBands: ReadonlyMap<string, BgBand>;
    readonly alertConditions: ReadonlyArray<AlertConditionEmission>;
    readonly logs: ReadonlyArray<LogEmission>;
};

// The default empty buffer bundle — a drawing/glyph-only primitive (the
// Task-6 / Task-11 construction shape) opts out of the Task-12 passes.
function emptyOverlayBuffers(
    drawings: ReadonlyMap<string, DrawingEmission>,
    glyphs: ReadonlyMap<string, GlyphMark>,
): OverlayBuffers {
    return {
        drawings,
        glyphs,
        drawingKeys: new Map(),
        glyphKeys: new Map(),
        bgBands: new Map(),
        alertConditions: [],
        logs: [],
    };
}

/**
 * A `lightweight-charts` series primitive (`ISeriesPrimitive`-shaped) that
 * paints every buffered chartlang {@link DrawingEmission} as an overlay. The
 * factory attaches one instance via `series.attachPrimitive(...)` and feeds it
 * the live drawings buffer; each frame the pane renderer decomposes the live
 * drawings to the shared IR and paints them through the canvas sink against a
 * viewport derived from LC's own converters.
 *
 * @since 1.4
 * @stable
 * The same overlay also paints the overlay-routed {@link GlyphMark}s (the glyph
 * kinds LC's native markers plugin cannot express) via the shared adapter-kit
 * glyph helper, plus (Task 12) per-bar `bg-color` {@link BgBand} stripes and
 * the always-on-top alert-condition + log panels — all against the same
 * viewport. Drawings, bands, and glyphs share ONE `(z, band, seq)` sort via the
 * shared adapter-kit `sortByRenderOrder`; alert/log panels paint after it
 * (never z-sorted). Pass the third {@link OverlayBuffers} argument to opt into
 * the Task-12 passes; the two-argument form is the drawing/glyph-only overlay.
 *
 * @example
 *     import { DrawingPrimitive } from "chartlang-example-lightweight-charts-adapter";
 *     const buffer = new Map();
 *     const glyphs = new Map();
 *     const primitive = new DrawingPrimitive(buffer, glyphs);
 *     // series.attachPrimitive(primitive);
 *     void primitive;
 */
export class DrawingPrimitive {
    private attachment: DrawingPrimitiveAttach | undefined;
    private readonly view: DrawingPrimitivePaneView;

    constructor(
        drawings: ReadonlyMap<string, DrawingEmission>,
        glyphs: ReadonlyMap<string, GlyphMark> = new Map(),
        overlay: OverlayBuffers = emptyOverlayBuffers(drawings, glyphs),
    ) {
        this.view = new DrawingPrimitivePaneView(() => this.attachment, overlay);
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

    constructor(getAttachment: () => DrawingPrimitiveAttach | undefined, overlay: OverlayBuffers) {
        this.paneRenderer = new DrawingPrimitivePaneRenderer(getAttachment, overlay);
    }

    renderer(): DrawingPrimitivePaneRenderer {
        return this.paneRenderer;
    }
}

/** The pane renderer that paints buffered drawings into the bitmap scope. */
class DrawingPrimitivePaneRenderer {
    constructor(
        private readonly getAttachment: () => DrawingPrimitiveAttach | undefined,
        private readonly overlay: OverlayBuffers,
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
     * Paint every live overlay mark into `scope`. The headless core the DOM
     * `draw` delegates to: builds the LC-converter viewport, collects the
     * z-sortable marks (drawings + bg-color bands + overlay glyphs), sorts them
     * by the shared `(z, band, seq)` order, dispatches each to its painter,
     * then paints the always-on-top alert-condition + log panels (NOT z-sorted,
     * the v1 deferral). A test drives this with a mock context + scope.
     */
    paintInto(scope: PaintScope): void {
        const attachment = this.getAttachment();
        // Not attached yet (or detached) → nothing to project against.
        if (attachment === undefined) return;
        const series = attachment.series;
        const timeScale = attachment.chart.timeScale();
        const view: Viewport = buildViewport(series, timeScale, scope);
        for (const mark of this.collectSortedMarks()) {
            paintOverlayMark(scope.context, mark, view);
        }
        // Always-on-top panels — painted AFTER the sorted overlay pass, never
        // z-sorted (the v1 deferral mirroring canvas2d's `renderOverlayTail`).
        paintAlertConditions(scope.context, this.overlay.alertConditions, view);
        paintLogs(scope.context, this.overlay.logs, view);
    }

    // Gather every z-sortable overlay mark (drawings, bg-color bands, overlay
    // glyphs) tagged with its `(z, band, seq)` key, then sort by the shared
    // comparator. A drawing missing a key (defensive) defaults to band/seq 0.
    private collectSortedMarks(): OverlayMark[] {
        const marks: OverlayMark[] = [];
        for (const [id, drawing] of this.overlay.drawings) {
            // The factory drops `op: "remove"` from the buffer, but guard
            // defensively so a stale removal never reaches the geometry.
            if (drawing.op === "remove") continue;
            const key = this.overlay.drawingKeys.get(id) ?? defaultKey(DRAWING_BAND);
            marks.push({ ...key, kind: "drawing", drawing });
        }
        for (const bgBand of this.overlay.bgBands.values()) {
            marks.push({ ...bgBandKey(bgBand), kind: "bgBand", bgBand });
        }
        for (const [id, glyph] of this.overlay.glyphs) {
            if (!Number.isFinite(glyph.value)) continue;
            const key = this.overlay.glyphKeys.get(id) ?? defaultKey(GLYPH_BAND);
            marks.push({ ...key, kind: "glyph", glyph });
        }
        return sortByRenderOrder(marks);
    }
}

// The `(z, band, seq)` key a mark falls back to when its parallel key map has
// no entry (defensive — the factory always writes one). Band is the mark's
// default band; z + seq are 0.
function defaultKey(band: number): RenderOrderKey {
    return { z: 0, band, seq: 0 };
}

// A bg-color band carries its own `(z, band, seq)` (it is `RenderOrderKey`).
function bgBandKey(band: BgBand): RenderOrderKey {
    return { z: band.z, band: band.band, seq: band.seq };
}

// Dispatch one sorted overlay mark to its painter against the LC viewport.
function paintOverlayMark(ctx: RenderCtx, mark: OverlayMark, view: Viewport): void {
    if (mark.kind === "drawing") {
        for (const prim of decomposeDrawing(mark.drawing, view)) {
            paintPrimitive(ctx, prim);
        }
        return;
    }
    if (mark.kind === "bgBand") {
        paintBgBand(ctx, mark.bgBand, view);
        return;
    }
    paintGlyph(ctx, mark.glyph, view);
}

// Paint one `bg-color` band as a full-pane-height vertical stripe centred on
// the bar's projected x. The stripe width is one bar-spacing in world time,
// projected to pixels (`timeToX(time + spacing) - timeToX(time)`); a zero /
// non-finite width falls back to a 1px hairline so the band stays visible. The
// `transp` (0–100) maps to opacity `1 - transp/100`; the band's concrete colour
// was already resolved (3-state `colorValue`) at ingest.
function paintBgBand(ctx: RenderCtx, band: BgBand, view: Viewport): void {
    const centre = timeToX(band.time, view);
    const edge = timeToX(band.time + band.spacing, view);
    const rawWidth = Math.abs(edge - centre);
    const width = Number.isFinite(rawWidth) && rawWidth > 0 ? rawWidth : 1;
    const alpha = 1 - (band.transp ?? 0) / 100;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = band.color;
    ctx.fillRect(centre - width / 2, 0, width, view.pxHeight);
    ctx.globalAlpha = 1;
}

const PANEL_FONT = "11px sans-serif";
const PANEL_TEXT_COLOR = "#94a3b8";
const ALERT_PANEL_X_PAD = 12;
const ALERT_PANEL_Y = 18;
const ALERT_ROW_HEIGHT = 14;
const ALERT_PANEL_WIDTH = 180;
const LOG_PADDING = 8;
const LOG_ROW_HEIGHT = 13;

// Paint the fired alert conditions for the current bar as a compact top-right
// side panel (mirrors canvas2d's `render/alertConditions.ts`). Non-fired
// conditions still travel on the wire but are not painted. An empty fired list
// adds no ctx calls.
function paintAlertConditions(
    ctx: RenderCtx,
    conditions: ReadonlyArray<AlertConditionEmission>,
    view: Viewport,
): void {
    const fired = conditions.filter((condition) => condition.fired);
    if (fired.length === 0) return;
    const x = Math.max(ALERT_PANEL_X_PAD, view.pxWidth - ALERT_PANEL_WIDTH);
    ctx.fillStyle = PANEL_TEXT_COLOR;
    ctx.font = PANEL_FONT;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    for (let i = 0; i < fired.length; i++) {
        const condition = fired[i];
        ctx.fillText(
            `${condition.conditionId}: ${condition.defaultMessage}`,
            x,
            ALERT_PANEL_Y + i * ALERT_ROW_HEIGHT,
        );
    }
}

// Paint the latest logs (last 5) as a compact bottom-left pane (mirrors
// canvas2d's `render/logPane.ts`). An empty list adds no ctx calls.
function paintLogs(ctx: RenderCtx, logs: ReadonlyArray<LogEmission>, view: Viewport): void {
    if (logs.length === 0) return;
    const x = LOG_PADDING;
    const y = Math.max(LOG_PADDING, view.pxHeight - LOG_PADDING - logs.length * LOG_ROW_HEIGHT);
    ctx.fillStyle = PANEL_TEXT_COLOR;
    ctx.font = PANEL_FONT;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    for (let i = 0; i < logs.length; i++) {
        const log = logs[i];
        ctx.fillText(`[${log.level}] ${log.message}`, x, y + i * LOG_ROW_HEIGHT);
    }
}

// Paint one overlay-routed glyph through the shared adapter-kit helper. Only
// the `shape` / `marker` kinds whose shape LC's native plugin cannot express
// reach the buffer, so the dispatch covers exactly those two.
function paintGlyph(ctx: RenderCtx, glyph: GlyphMark, view: Viewport): void {
    const x = timeToX(glyph.time, view);
    const y = priceToY(glyph.value, view);
    if (glyph.style.kind === "shape") {
        drawShape(
            ctx,
            {
                x,
                y,
                shape: glyph.style.shape,
                size: glyph.style.size,
                ...(glyph.style.location === undefined ? {} : { location: glyph.style.location }),
                color: glyph.color,
            },
            GLYPH_DEFAULT_COLOR,
        );
        return;
    }
    drawMarker(
        ctx,
        { x, y, shape: glyph.style.shape, size: glyph.style.size, color: glyph.color },
        GLYPH_DEFAULT_COLOR,
    );
}
