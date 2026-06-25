// Ported from invinite src/components/trading-chart/webgl/Renderer.ts @ cd883292.
// WebGL2 renderer adapted to the chartlang Adapter/emission contract.
// "Translate, not transcribe": React/bus coupling dropped; world window
// comes from the shared ViewController, not invinite's frame-state.

import { type AxisRenderInfo, computeAxisTicks, packGridLines } from "../axes.js";
import type {
    LayerDescriptor,
    LineStripDescriptor,
    PaneRenderState,
    RgbaUnit,
} from "../layer-descriptor.js";
import { beginRendererFrame } from "./buffer-pool.js";
import type { GlContext } from "./gl-context.js";
import type { DisposableProgram } from "./program-cache.js";
import { CandleBodiesProgram } from "./programs/candle-bodies-program.js";
import { CandleWicksProgram } from "./programs/candle-wicks-program.js";
import { CursorsProgram } from "./programs/cursors-program.js";
import { FilledBandProgram } from "./programs/filled-band-program.js";
import { LineStripProgram } from "./programs/line-strip-program.js";
import { MarkersProgram } from "./programs/markers-program.js";
import { VerticalBarsProgram } from "./programs/vertical-bars-program.js";
import { ortho2d } from "./projection.js";
import type { DeviceRect } from "./viewport.js";
import { paneViewport } from "./viewport.js";

/**
 * Renderer construction options. `onError` is invoked (instead of throwing)
 * when a per-pane draw or a program `dispose` throws — the convention a host
 * needs so a single bad frame does not crash the unmount path. Omit it and
 * the renderer rethrows.
 *
 * @since 0.1
 * @stable
 * @example
 *     const opts: RendererOptions = { onError: (e) => console.error(e) };
 *     void opts;
 */
export type RendererOptions = {
    readonly onError?: (err: Error) => void;
    /**
     * Grid-line color (unit RGBA). When set, each pane draws price + time grid
     * lines — built from the pane's world window via {@link computeAxisTicks} /
     * {@link packGridLines} and dispatched through the SAME line-strip program
     * the plot lines use (Task 7), no new GPU program. Omit to draw no grid.
     */
    readonly gridColor?: RgbaUnit;
    /** Per-axis tick count (default 5). */
    readonly axisTickCount?: number;
    /**
     * Axis-label hook, fired once per pane per frame with the pane's CSS rect +
     * window + computed ticks ({@link AxisRenderInfo}). The 2D text overlay
     * projects + paints the labels from it — the renderer emits geometry (the
     * grid line-strip) + this data only, never touching a `RenderCtx` or the
     * DOM. (Task 12's cursor / marker / alert text rides the same overlay.)
     */
    readonly onAxes?: (info: AxisRenderInfo) => void;
};

// Grid-line stroke width (CSS-px) — thin hairline, the DPR scale happens in the
// line-strip program. Faint solid strokes, like the canvas2d reference grid.
const GRID_LINE_WIDTH_PX = 1;

/**
 * Per-pane WebGL2 frame orchestrator. Vanilla TS — no React, no third-party
 * rendering library. Ported from invinite's `Renderer`, dropping the
 * React/bus coupling and the DEV stats/forensics ("translate, not
 * transcribe"); the world window comes from the shared `ViewController`
 * (via `buildFrame`), not invinite's frame-state.
 *
 * Lifecycle:
 *  1. `new Renderer(glContext)` — captures the shared {@link GlContext}.
 *  2. `update(panes)` — stages the latest snapshot. Coalesced via
 *     `requestAnimationFrame`; only the most recent snapshot is painted.
 *  3. `drawNow()` — synchronous paint. Used by tests, by a post-resize
 *     repaint, and by the rAF callback.
 *  4. `dispose()` — cancels any pending rAF and disposes every program the
 *     renderer dispatched through. Idempotent.
 *
 * Per frame, `drawNow` clears the whole backbuffer (scissor disabled), then
 * for each pane sets `gl.viewport` / `gl.scissor` from {@link paneViewport},
 * builds the `ortho2d` matrix from the pane's world `window`, runs the optional
 * axes pass (grid line-strip + the `onAxes` label hook, Task 8), and dispatches
 * each {@link LayerDescriptor} to its program. The candle program arms are
 * wired (Task 6) through the dispatch seam ({@link Renderer.dispatchLayer});
 * the line / parity arms (Tasks 7, 10–13) plug into the same seam without
 * reworking the per-pane loop. An unarmed descriptor kind is a graceful
 * no-op.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { Renderer } from "chartlang-example-webgl-adapter";
 *     declare const glContext: import("chartlang-example-webgl-adapter").GlContext;
 *     const renderer = new Renderer(glContext);
 *     // renderer.update(buildFrame(state, layout)); renderer.scheduleDraw();
 *     void renderer;
 */
export class Renderer {
    readonly glContext: GlContext;
    readonly options: RendererOptions;

    private staged: null | ReadonlyArray<PaneRenderState> = null;
    private current: null | ReadonlyArray<PaneRenderState> = null;
    private rafId: null | number = null;
    private disposed = false;

    // Every program instance this renderer has dispatched through. Only these
    // are released in `dispose` — keeps teardown proportional to what the
    // renderer actually used (invinite's contract; the candle arms populate
    // this in Task 6, line / parity arms in Tasks 7, 10–13).
    private readonly usedPrograms = new Set<DisposableProgram>();

    constructor(glContext: GlContext, options: RendererOptions = {}) {
        this.glContext = glContext;
        this.options = options;
    }

    /**
     * Public read of the private `disposed` flag — lets a caller holding a
     * direct renderer handle null-guard before invoking `scheduleDraw()` /
     * `update()`. The renderer's own methods already no-op on `disposed`.
     */
    get isDisposed(): boolean {
        return this.disposed;
    }

    /**
     * Stage a fresh pane snapshot. Coalesced — only the latest snapshot is
     * rendered on the next rAF tick; multiple synchronous calls in one tick
     * collapse to a single `drawNow`.
     */
    update(panes: ReadonlyArray<PaneRenderState>): void {
        if (this.disposed) return;
        this.staged = panes;
        this.scheduleRaf();
    }

    /**
     * Wake the renderer to repaint the already-staged (or last-committed)
     * snapshot — e.g. after a tail-mutation tick or a view-window change with
     * no fresh `update`. A no-op when nothing has been staged yet.
     */
    scheduleDraw(): void {
        if (this.disposed) return;
        if (this.staged === null && this.current === null) return;
        this.scheduleRaf();
    }

    // Shared rAF schedule. `update` / `scheduleDraw` both call here; re-entrant
    // calls in the same tick collapse to a single rAF. `requestAnimationFrame`
    // is browser-only; under node (stub-gl unit tests) it is absent, so callers
    // drive the synchronous `drawNow` directly.
    private scheduleRaf(): void {
        if (this.rafId !== null) return;
        /* v8 ignore start -- rAF is browser-only; node tests drive drawNow directly */
        if (typeof requestAnimationFrame !== "function") return;
        this.rafId = requestAnimationFrame(() => {
            this.rafId = null;
            if (this.disposed) return;
            this.drawNow();
        });
        /* v8 ignore stop */
    }

    /**
     * Force-render the most recent pane snapshot synchronously. Commits any
     * pending `staged` snapshot and cancels the pending rAF first — a
     * synchronous caller (post-resize repaint, image export) cannot wait for
     * the next rAF tick. A no-op when disposed or when no snapshot has been
     * staged.
     */
    drawNow(): void {
        if (this.disposed) return;
        if (this.staged !== null) {
            this.current = this.staged;
            this.staged = null;
            if (this.rafId !== null) {
                /* v8 ignore next 2 -- rAF cancel is browser-only */
                cancelAnimationFrame(this.rafId);
                this.rafId = null;
            }
        }
        const panes = this.current;
        if (panes === null) return;

        // SCISSOR_TEST disabled before the clear (X-3 invariant): a prior
        // frame may have left SCISSOR_TEST enabled with a pane rect installed,
        // so a fresh `gl.clear` would only wipe that pane and let every other
        // region bleed stale fragments into this frame. Disable scissor →
        // full-canvas clear → re-enable SCISSOR_TEST + premultiplied-alpha
        // BLEND so the per-pane draws can scope their viewport via
        // `gl.scissor`. (Inlined from invinite's `frame-state.beginFrame`,
        // which Tasks 1–4 did not port — the one helper lives here.)
        this.beginFrame();
        // Bump the shared-buffer frame counter so the per-slot
        // upload-once-per-frame gate kicks in for the program arms (Tasks 6–7).
        beginRendererFrame();

        try {
            for (const pane of panes) {
                this.drawPane(pane);
            }
        } catch (err) {
            const reportable = err instanceof Error ? err : new Error(String(err));
            if (this.options.onError !== undefined) {
                this.options.onError(reportable);
                return;
            }
            throw reportable;
        }
    }

    /**
     * Release every program this renderer dispatched through and cancel any
     * pending rAF. Idempotent — a second call is a no-op. Each program's own
     * `dispose` releases its GL resources and removes itself from the per-gl
     * program cache; a throw on a lost / disposed context routes to
     * `options.onError` (or is swallowed) so the unmount path stays clean.
     */
    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        if (this.rafId !== null) {
            /* v8 ignore next 2 -- rAF cancel is browser-only */
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        try {
            for (const program of this.usedPrograms) {
                program.dispose();
            }
        } catch (err) {
            /* v8 ignore next 3 -- dispose-on-lost-context error path */
            if (this.options.onError !== undefined) {
                this.options.onError(err instanceof Error ? err : new Error(String(err)));
            }
        }
        this.usedPrograms.clear();
    }

    // Establish the canonical per-frame GL state machine before per-pane draws
    // fire. See the X-3 scissor-clear-order rationale in `drawNow`.
    private beginFrame(): void {
        const { gl } = this.glContext;
        gl.disable(gl.SCISSOR_TEST);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.enable(gl.SCISSOR_TEST);
        gl.enable(gl.BLEND);
        gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }

    // Paint one pane: scope its device-px viewport + scissor rect, build the
    // world→NDC projection from the pane's window, then dispatch each layer.
    // The pane's CSS rect (the subpane split, Task 10) scopes the viewport;
    // a pane with no `cssRect` (the single-overlay MVP shape) spans the whole
    // canvas. `paneViewport` is the single CSS→device-px rounding site, so
    // adjacent panes share a tile-tight integer seam.
    private drawPane(pane: PaneRenderState): void {
        const { gl, cssWidth, cssHeight, dpr } = this.glContext;
        const cssRect = pane.cssRect ?? { x: 0, y: 0, width: cssWidth, height: cssHeight };
        const rect = paneViewport(cssRect, cssHeight, dpr);
        gl.viewport(rect.xPx, rect.yPx, rect.widthPx, rect.heightPx);
        gl.scissor(rect.xPx, rect.yPx, rect.widthPx, rect.heightPx);

        const { window } = pane;
        const projection = ortho2d(window.xMin, window.xMax, window.yMin, window.yMax);

        // Axes pass — additive, BEFORE the layers so the grid sits behind the
        // candles / plot lines. Computes the pane's ticks once and reuses them
        // for both the GL grid line-strip and the overlay label hook. A no-op
        // unless a grid color or label hook is configured. (Tasks 10–14 add
        // their own arms after this; keep this block localized.)
        if (this.options.gridColor !== undefined || this.options.onAxes !== undefined) {
            this.drawAxes(pane, projection, rect);
        }

        for (const descriptor of pane.layers) {
            this.dispatchLayer(descriptor, projection, pane.paneKey, rect);
        }
    }

    // Compute the pane's axis ticks from its world window, draw the grid lines
    // through the line-strip program (when a grid color is set), and fire the
    // `onAxes` label hook (when set) with the pane's CSS rect — the 2D overlay
    // paints the labels from it. The renderer never touches a `RenderCtx`.
    private drawAxes(pane: PaneRenderState, projection: Float32Array, rect: DeviceRect): void {
        const { window } = pane;
        const ticks = computeAxisTicks(
            window.xMin,
            window.xMax,
            window.yMin,
            window.yMax,
            this.options.axisTickCount,
        );
        const { gridColor } = this.options;
        if (gridColor !== undefined) {
            const grid = packGridLines(window.xMin, window.xMax, window.yMin, window.yMax, ticks);
            if (grid.pointCount > 1) {
                const descriptor: LineStripDescriptor = {
                    id: `${pane.paneKey}:grid`,
                    kind: "line-strip",
                    points: grid.points,
                    pointCount: grid.pointCount,
                    color: gridColor,
                    widthPx: GRID_LINE_WIDTH_PX,
                    dash: null,
                    step: false,
                };
                this.dispatchLayer(descriptor, projection, pane.paneKey, rect);
            }
        }
        if (this.options.onAxes !== undefined) {
            const { cssWidth, cssHeight } = this.glContext;
            // The pane's own CSS band (the subpane split, Task 10); a pane
            // with no `cssRect` (single-overlay MVP) spans the whole canvas.
            const cssRect = pane.cssRect ?? { x: 0, y: 0, width: cssWidth, height: cssHeight };
            this.options.onAxes({
                paneKey: pane.paneKey,
                cssRect,
                window: {
                    xMin: window.xMin,
                    xMax: window.xMax,
                    yMin: window.yMin,
                    yMax: window.yMax,
                },
                ticks,
            });
        }
    }

    // Dispatch one layer descriptor to its GL program. Each armed kind
    // resolves its singleton program via the program-cache's `*.get(gl)`,
    // builds the {@link DrawArgs} from the per-pane `projection` + device-px
    // `rect` (the `project32` snapping shader's `uViewportSize`) + `dpr`,
    // draws, and records the instance into `this.usedPrograms` so `dispose`
    // releases it. Unarmed kinds (Tasks 10–13) stay graceful no-ops. The seam
    // is here (not in `drawPane`) so later tasks plug in without touching the
    // per-pane loop; Task 7's `line-strip` arm slots into this same `switch`.
    private dispatchLayer(
        descriptor: LayerDescriptor,
        projection: Float32Array,
        paneKey: string,
        rect: DeviceRect,
    ): void {
        const { gl, dpr } = this.glContext;
        switch (descriptor.kind) {
            case "candle-bodies": {
                const program = CandleBodiesProgram.get(gl);
                this.usedPrograms.add(program);
                program.draw({
                    descriptor,
                    dpr,
                    paneKey,
                    projection,
                    viewportHeightPx: rect.heightPx,
                    viewportWidthPx: rect.widthPx,
                });
                break;
            }
            case "candle-wicks": {
                const program = CandleWicksProgram.get(gl);
                this.usedPrograms.add(program);
                program.draw({
                    descriptor,
                    dpr,
                    paneKey,
                    projection,
                    viewportHeightPx: rect.heightPx,
                    viewportWidthPx: rect.widthPx,
                });
                break;
            }
            case "line-strip": {
                const program = LineStripProgram.get(gl);
                this.usedPrograms.add(program);
                program.draw({
                    descriptor,
                    dpr,
                    paneKey,
                    projection,
                    viewportHeightPx: rect.heightPx,
                    viewportWidthPx: rect.widthPx,
                });
                break;
            }
            case "vertical-bars": {
                const program = VerticalBarsProgram.get(gl);
                this.usedPrograms.add(program);
                program.draw({
                    descriptor,
                    dpr,
                    paneKey,
                    projection,
                    viewportHeightPx: rect.heightPx,
                    viewportWidthPx: rect.widthPx,
                });
                break;
            }
            case "filled-band": {
                const program = FilledBandProgram.get(gl);
                this.usedPrograms.add(program);
                program.draw({
                    descriptor,
                    dpr,
                    paneKey,
                    projection,
                    viewportHeightPx: rect.heightPx,
                    viewportWidthPx: rect.widthPx,
                });
                break;
            }
            case "cursor": {
                const program = CursorsProgram.get(gl);
                this.usedPrograms.add(program);
                program.draw({
                    descriptor,
                    dpr,
                    paneKey,
                    projection,
                    viewportHeightPx: rect.heightPx,
                    viewportWidthPx: rect.widthPx,
                });
                break;
            }
            case "marker": {
                // GPU perf path for high-volume markers. The CORRECTNESS
                // baseline is the shared overlay glyph helper (glyphs.ts /
                // overlay.paintGlyphs); `buildFrame` does not auto-build marker
                // descriptors (avoids double-paint), so this arm fires only when
                // a caller supplies a MarkerDescriptor explicitly.
                const program = MarkersProgram.get(gl);
                this.usedPrograms.add(program);
                program.draw({
                    descriptor,
                    dpr,
                    paneKey,
                    projection,
                    viewportHeightPx: rect.heightPx,
                    viewportWidthPx: rect.widthPx,
                });
                break;
            }
            case "drawing": {
                // Drawings paint on the 2D overlay through the shared
                // `decomposeDrawing` + `paintPrimitive` sink (overlay-pane
                // viewport — see `createWebglAdapter.paintOverlayDrawings`), so
                // `buildFrame` builds NO `DrawingDescriptor`. This GL arm is the
                // optional world-space stroke path: it fires only when a caller
                // supplies a `DrawingDescriptor` explicitly (no double-paint),
                // mirroring the `marker` arm. Each stroke is a world-space
                // `LineStripDescriptor` routed through the line-strip program.
                const program = LineStripProgram.get(gl);
                this.usedPrograms.add(program);
                for (const stroke of descriptor.strokes) {
                    program.draw({
                        descriptor: stroke,
                        dpr,
                        paneKey,
                        projection,
                        viewportHeightPx: rect.heightPx,
                        viewportWidthPx: rect.widthPx,
                    });
                }
                break;
            }
            // Task 14 adds the remaining kind (`text` — overlay-only). Until
            // then it stays a graceful no-op.
            default:
                break;
        }
    }
}
