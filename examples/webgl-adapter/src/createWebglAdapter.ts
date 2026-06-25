// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import {
    type Adapter,
    type AlertEmission,
    type CandleEvent,
    type Capabilities,
    type PlotEmission,
    defineAdapter,
    medianBarSpacing,
} from "@invinite-org/chartlang-adapter-kit";
import type { RenderCtx } from "@invinite-org/chartlang-adapter-kit/canvas";
import {
    type ScriptHost,
    type WorkerLike,
    createWorkerHost,
} from "@invinite-org/chartlang-host-worker";

import type { AxisRenderInfo } from "./axes.js";
import { type PaneLayoutRect, buildFrame } from "./buildFrame.js";
import { WEBGL_CAPABILITIES, WEBGL_SYM_INFO } from "./capabilities.js";
import { drawingPrimitives } from "./drawings.js";
import { alertBadgeAnchor, glyphAnchor, isGlyphOverlay } from "./glyphs.js";
import { applyEmissions } from "./ingest.js";
import { attachChartInteraction } from "./interaction.js";
import { type Palette, hexToRgbaUnit } from "./layer-descriptor.js";
import { computePaneLayout } from "./layout.js";
import {
    type AlertBadgePaintItem,
    type GlyphPaintItem,
    type TextOverlay,
    createTextOverlay,
} from "./overlay.js";
import { resolveHorizontalHistogram, resolveOverridePaint } from "./overrides.js";
import { BAND, type RenderOrderMark, applyRenderOrder } from "./renderOrder.js";
import { type AdapterState, createAdapterState, resetAdapterState } from "./state.js";
import { Renderer } from "./webgl/Renderer.js";
import { type GlContext, WebGl2UnsupportedError, createGlContext } from "./webgl/gl-context.js";

const DEFAULT_INTERVAL = "1D";

/**
 * Constructor options for {@link createWebglAdapter}. Mirrors
 * `CreateCanvas2dAdapterOpts` so the WebGL adapter is a drop-in for the
 * react-starter seam + demo driver: a `canvas` (a real
 * `HTMLCanvasElement` / `OffscreenCanvas` — WebGL2 supports both — or a
 * structural `{ width, height }` for the headless path), an optional `gl`
 * test seam (a `WebGL2RenderingContext` injected by browser tests in place
 * of `canvas.getContext("webgl2")`), a candle source, and the usual
 * host/window/HiDPI knobs.
 *
 * The GPU rendering layers land in later tasks behind THIS surface; for
 * Task 1 the factory is a minimal headless shell (host + capabilities +
 * no-op render), so it must be constructible from `{ width, height }` alone
 * and never resolves a real GL context unless a `canvas` / `gl` seam is
 * supplied.
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const canvas: HTMLCanvasElement;
 *     declare const candleSource: AsyncIterable<CandleEvent>;
 *     const opts: CreateWebglAdapterOpts = { canvas, candleSource };
 *     void opts;
 */
export type CreateWebglAdapterOpts = {
    readonly canvas: HTMLCanvasElement | OffscreenCanvas | { width: number; height: number };
    /**
     * Test seam: a `WebGL2RenderingContext` supplied directly so a browser
     * test can drive the GPU pipeline without `canvas.getContext("webgl2")`.
     * Production callers pass a real `canvas` and let the adapter resolve the
     * context (later tasks). Headless callers supply neither and the adapter
     * runs the emission pipeline with no GL.
     */
    readonly gl?: WebGL2RenderingContext;
    readonly candleSource: AsyncIterable<CandleEvent>;
    readonly capabilities?: Capabilities;
    readonly interval?: string;
    /**
     * Colour palette for candles / plots / axes. Omit to use
     * {@link import("./layer-descriptor.js").DEFAULT_PALETTE} (the canonical
     * TradingView bull / bear hexes). Threaded into the shared
     * {@link import("./state.js").createAdapterState} so the descriptor
     * builders resolve colors against it.
     */
    readonly palette?: Palette;
    readonly resolveInputs?: (scriptId: string) => Readonly<Record<string, unknown>>;
    readonly onAlert?: (a: AlertEmission) => void;
    /**
     * When supplied, only alerts for which this returns `true` are kept in the
     * on-canvas badge buffer. `onAlert` still receives every alert. The
     * badge buffer itself lands with the cursor/glyph overlay (Task 12); the
     * opt is declared here so that task has the Task-1 filter to read.
     */
    readonly alertBadgeFilter?: (a: AlertEmission) => boolean;
    /**
     * Default visible window: when set, the chart opens framed on only the
     * most recent `initialVisibleBars` bars (the rest stay scrollable). Omit
     * (or `0`) to fit all data. Consumed by the shared `ViewController` once
     * the renderer lands (Task 4).
     */
    readonly initialVisibleBars?: number;
    /**
     * Device-pixel ratio of the canvas the caller mounted (default `1`).
     * Consumed by the GL projection / line-width math (later tasks) so HiDPI
     * strokes render full-thickness.
     */
    readonly devicePixelRatio?: number;
    readonly host?: ScriptHost;
    readonly workerLike?: WorkerLike;
};

/**
 * Public handle the consumer drives. `host` is exposed so callers can
 * `await adapter.host.load(compiled)` before invoking {@link runWebglLoop}.
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const adapter: WebglAdapterHandle;
 *     // await adapter.host.load(compiled);
 *     void adapter;
 */
export type WebglAdapterHandle = Adapter & { readonly host: ScriptHost };

// Renderer state held off the public handle (via the WeakMap below) so
// `runWebglLoop` can mirror candle events into the bar window without
// exposing it on the `Adapter` surface. The full {@link AdapterState}
// (Task 4) carries the bar window, plot/hline/overlay stores, the shared
// `ViewController`, and the palette the GL pipeline reads from.
const HANDLE_STATE: WeakMap<WebglAdapterHandle, AdapterState> = new WeakMap();
const HANDLE_INTERVAL: WeakMap<WebglAdapterHandle, string> = new WeakMap();

// Wrap a bare injected `WebGL2RenderingContext` (the `opts.gl` test seam) in
// a minimal structural {@link GlContext} so the `Renderer` consumes one shape
// whether the context was resolved from a real canvas or injected by a
// browser test. `resize` / `dispose` are no-ops here — a test owns the
// injected context's lifetime; the factory's own `createGlContext` (real
// canvas) is the one it disposes.
function wrapInjectedGl(
    gl: WebGL2RenderingContext,
    canvas: { width: number; height: number },
    dpr: number,
): GlContext {
    return {
        gl,
        // A real `HTMLCanvasElement` is not available on the injected-seam
        // path; the structural `{ width, height }` is all the Renderer reads
        // (it uses `cssWidth` / `cssHeight` / `dpr`, never `canvas.*`).
        canvas: canvas as HTMLCanvasElement,
        dpr,
        cssWidth: canvas.width,
        cssHeight: canvas.height,
        resize: () => {},
        dispose: () => {},
    };
}

// Resolve a {@link GlContext} for the factory, or `undefined` for the
// headless path. Precedence: the injected `opts.gl` seam (wrapped) first;
// otherwise a real `<canvas>` element (`getContext`) is sized + handed to
// `createGlContext`; a bare `{ width, height }` (no `getContext`) yields
// `undefined` — no GL, no Renderer, a no-op draw. Returns the context plus a
// `created` flag so `dispose` only tears down the context the factory built
// (never the injected-seam one a test owns).
function resolveGlContext(
    opts: CreateWebglAdapterOpts,
    dpr: number,
): {
    glContext: GlContext | undefined;
    created: boolean;
} {
    if (opts.gl !== undefined) {
        return {
            glContext: wrapInjectedGl(opts.gl, opts.canvas, dpr),
            created: false,
        };
    }
    const maybeEl = opts.canvas as {
        getContext?: unknown;
        clientWidth?: number;
        clientHeight?: number;
        width: number;
        height: number;
    };
    /* v8 ignore start -- real-canvas GL resolution is browser-only (demo / build matrix) */
    if (typeof maybeEl.getContext === "function") {
        let glContext: GlContext;
        try {
            glContext = createGlContext(opts.canvas as HTMLCanvasElement);
        } catch (err) {
            // A real canvas on a WebGL2-unavailable environment (hardware
            // acceleration off, software rendering blocked, an old WebView)
            // throws WebGl2UnsupportedError. Degrade to the headless no-op path
            // rather than hard-crashing the host — the same "no usable GL ⇒ no
            // Renderer, no-op draw" contract the bare { width, height } path
            // already honours. createGlContext keeps throwing for direct
            // callers; only the factory's own resolution absorbs it.
            if (err instanceof WebGl2UnsupportedError) {
                return { glContext: undefined, created: false };
            }
            throw err;
        }
        const cssWidth = maybeEl.clientWidth ?? maybeEl.width;
        const cssHeight = maybeEl.clientHeight ?? maybeEl.height;
        glContext.resize(cssWidth, cssHeight, dpr);
        return { glContext, created: true };
    }
    /* v8 ignore stop */
    return { glContext: undefined, created: false };
}

// Build a 2D text overlay layered over a real GL canvas (Task 8). A sibling
// `<canvas>` is positioned over the GL canvas (same CSS box) and sized to the
// device-px backbuffer; axis labels (and, from Task 12, marker / alert text)
// paint here while the GL canvas paints geometry. Returns `undefined` on the
// headless path (no real `<canvas>` element / no `document`) so the no-op draw
// is preserved. The DOM construction is browser-only.
/* v8 ignore start -- 2D overlay mount is browser-only (demo / build matrix) */
function mountOverlay(glContext: GlContext): TextOverlay | undefined {
    const glCanvas = glContext.canvas;
    // The injected-gl seam (tests) supplies a structural `{ width, height }`
    // cast, not a real element with `ownerDocument` — guard before touching DOM.
    const doc = (glCanvas as Partial<HTMLCanvasElement>).ownerDocument;
    if (doc === undefined || doc === null || typeof doc.createElement !== "function") {
        return undefined;
    }
    const overlayCanvas = doc.createElement("canvas");
    overlayCanvas.style.position = "absolute";
    overlayCanvas.style.left = "0";
    overlayCanvas.style.top = "0";
    overlayCanvas.style.pointerEvents = "none";
    // Type `getContext` to return the structural `RenderCtx` directly (the
    // canvas2d pattern) — a real `CanvasRenderingContext2D`'s `strokeStyle` is
    // wider (`string | CanvasGradient | CanvasPattern`) than `RenderCtx`'s, so
    // the plain return type is not assignable; the overlay only touches the
    // `RenderCtx` subset.
    const getCtx = overlayCanvas.getContext as unknown as (id: "2d") => RenderCtx | null;
    const ctx = getCtx("2d");
    if (ctx === null) return undefined;
    const parent = glCanvas.parentElement;
    if (parent !== null) parent.appendChild(overlayCanvas);
    const overlay = createTextOverlay({
        ctx,
        cssWidth: glContext.cssWidth,
        cssHeight: glContext.cssHeight,
        dpr: glContext.dpr,
        canvas: overlayCanvas,
    });
    overlay.resize(glContext.cssWidth, glContext.cssHeight, glContext.dpr);
    return overlay;
}
/* v8 ignore stop */

// Project + paint the overlay pane's glyph plot marks + alert badges through
// the shared adapter-kit glyph geometry. Glyph overlays (shape / character /
// arrow / marker / label) are ordered by their ingest `(seq)` so the paint
// order matches the z-pass; a non-finite-value glyph is a per-glyph skip
// (`glyphAnchor` returns null). Alert badges anchor at their bar's (time, high)
// — the buffer is already `alertBadgeFilter`-gated at ingest (Task 1 opt). The
// 2D draw is browser-only (the overlay mounts only behind a real canvas); the
// pure positioning + dispatch live in `glyphs.ts` and are node-tested.
function paintOverlayGlyphs(state: AdapterState, info: AxisRenderInfo, overlay: TextOverlay): void {
    const spacing = medianBarSpacing(state.bars);
    // Collect glyph overlays tagged `(z, glyph-band, seq)` and order them
    // through the SHARED `applyRenderOrder` (never a local comparator) so a
    // per-glyph `z` override reorders the glyph band — parity with canvas2d's
    // `collectSortableMarks`, which tags each glyph `z: plot.z ?? 0`. At the
    // default `z = 0` this reduces to ingest order (`overlaySeq`). Overlay pane
    // only.
    const marks: RenderOrderMark<PlotEmission>[] = [];
    for (const [key, emission] of state.plotOverlays) {
        if (emission.pane !== "overlay") continue;
        if (!isGlyphOverlay(emission.style)) continue;
        marks.push({
            z: emission.z ?? 0,
            band: BAND.glyph,
            seq: state.overlaySeq.get(key) ?? 0,
            payload: emission,
        });
    }
    const ordered = applyRenderOrder(marks);
    const glyphItems: GlyphPaintItem[] = [];
    for (const emission of ordered) {
        const anchor = glyphAnchor(emission, info, state.bars, spacing);
        if (anchor === null) continue;
        glyphItems.push({ emission, anchor });
    }
    if (glyphItems.length > 0) overlay.paintGlyphs(glyphItems);

    const badgeItems: AlertBadgePaintItem[] = [];
    for (const alert of state.recentAlerts) {
        const anchor = alertBadgeAnchor(alert, info, state.bars);
        if (anchor === null) continue;
        badgeItems.push({ alert, anchor });
    }
    if (badgeItems.length > 0) overlay.paintAlertBadges(badgeItems, state.palette);
}

// Reduce every live drawing to pixel-space `DrawPrimitive`s via the SHARED
// `decomposeDrawing` (the adapter-kit contract — never forked) and paint them
// through the SHARED `paintPrimitive` overlay sink, byte-consistent with
// canvas2d / uplot / lwc. Drawings ride the SAME overlay-pane pixel viewport the
// glyphs / badges use (`drawings.ts` builds it from `info`), so all four
// overlay layers share ONE projection per frame. Overlay pane only (the glyph
// precedent); the 2D draw is browser-only (the overlay mounts only behind a
// real canvas) and the pure mapping lives in `drawings.ts` (node-tested).
function paintOverlayDrawings(
    state: AdapterState,
    info: AxisRenderInfo,
    overlay: TextOverlay,
): void {
    const prims = drawingPrimitives(state, info);
    if (prims.length > 0) overlay.paintDrawings(prims);
}

// Paint the override SUBSTRATE on the overlay (overlay pane only), BEFORE the
// z-sorted glyph / drawing pass — the canvas2d `renderBackgroundOverlays` /
// `renderBarOverlays` order. GL paints the candle geometry; these tint over it
// on the overlay (the deliberate GL-geometry / overlay-paint split, README §4):
// translucent `bg-color` bands behind everything, then per-bar `candle-override`
// / `bar-override` / `bar-color` over the candles, then the right-edge
// `horizontal-histogram` volume profile. The pure resolution lives in
// `overrides.ts` (node-tested); the 2D paint is browser-only.
function paintOverlaySubstrate(
    state: AdapterState,
    info: AxisRenderInfo,
    overlay: TextOverlay,
): void {
    const paint = resolveOverridePaint(state, info);
    if (paint.backgrounds.length > 0) overlay.paintBackgroundOverlays(paint.backgrounds);
    if (paint.bars.length > 0) overlay.paintBarOverlays(paint.bars);
    const histogram = resolveHorizontalHistogram(state, info);
    if (histogram.length > 0) overlay.paintHorizontalHistogram(histogram);
}

// Mirror a candle event into the renderer's bar window — the same projection
// the GL pipeline reads from once it lands. `streamKey`-tagged secondary
// feeds (MTF / multi-symbol) are ignored by the main bar window.
function applyCandleEvent(state: AdapterState, event: CandleEvent): void {
    if (event.streamKey !== undefined) return;
    if (event.kind === "history") {
        state.bars.push(...event.bars);
        return;
    }
    if (event.kind === "close") {
        state.bars.push(event.bar);
        return;
    }
    if (state.bars.length === 0) {
        state.bars.push(event.bar);
        return;
    }
    state.bars[state.bars.length - 1] = event.bar;
}

/**
 * Build a frozen WebGL reference adapter. Wires the capabilities, a worker
 * host (or the supplied `opts.host`), a candle source, the shared
 * {@link AdapterState}, and — when a GL context is available — a {@link
 * Renderer} into one `Adapter`. `onEmissions` ingests each drained batch via
 * `applyEmissions` (Task 4), then, when mounted on a real canvas / `gl` seam,
 * stages `buildFrame(state, layout)` on the renderer and schedules a draw.
 *
 * Headless-constructible from `{ width, height }` alone: it does NOT call
 * `canvas.getContext("webgl2")` and builds NO renderer unless a real `canvas`
 * (with `getContext`) or the `opts.gl` test seam is supplied. With no GL the
 * adapter still runs the full ingestion pipeline — `onEmissions` updates state
 * — but the draw is a safe no-op, so the conformance / node tests pass without
 * a canvas. The returned `host` is exposed so the consumer can
 * `await adapter.host.load(compiled)` before invoking {@link runWebglLoop}.
 *
 * The GPU program arms (candle bodies / wicks, line strips, …) land in Tasks
 * 6–13 behind the renderer's dispatch seam; until then a real canvas clears
 * per pane but draws no geometry.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { createWebglAdapter } from "chartlang-example-webgl-adapter";
 *     import { mockCandleSource } from "@invinite-org/chartlang-adapter-kit";
 *     const adapter = createWebglAdapter({
 *         canvas: { width: 320, height: 240 },
 *         candleSource: mockCandleSource([]),
 *     });
 *     void adapter;
 */
export function createWebglAdapter(opts: CreateWebglAdapterOpts): WebglAdapterHandle {
    const capabilities = opts.capabilities ?? WEBGL_CAPABILITIES;
    // A non-finite or non-positive dpr would poison the device-px rounding, so
    // clamp anything other than a finite positive ratio back to `1`.
    const dprRaw = opts.devicePixelRatio ?? 1;
    const dpr = Number.isFinite(dprRaw) && dprRaw > 0 ? dprRaw : 1;
    const state = createAdapterState({
        ...(opts.palette !== undefined ? { palette: opts.palette } : {}),
        ...(opts.initialVisibleBars !== undefined
            ? { initialVisibleBars: opts.initialVisibleBars }
            : {}),
    });
    const { glContext, created: createdGlContext } = resolveGlContext(opts, dpr);

    // The 2D text overlay (Task 8) is mounted only on a real GL canvas; the
    // injected-gl seam + headless paths skip it (no `<canvas>` element).
    const overlay = glContext === undefined ? undefined : mountOverlay(glContext);
    const gridColor = hexToRgbaUnit(state.palette.gridLine, 1);

    // The last overlay-pane window the renderer painted — captured in `onAxes`
    // each frame so the interaction px↔world closures use the current scale
    // (the window changes every pan / zoom). Defaults to the empty-bars window.
    let lastOverlayWindow = { xMin: 0, xMax: 1 };
    let lastOverlayCssWidth = glContext?.cssWidth ?? 1;

    // The axis-label hook: clear the overlay on the first (overlay) pane of the
    // frame, then paint that pane's labels. The overlay pane is always drawn
    // first (paneOrder index 0), so clearing on it clears once per frame even
    // when subpanes arrive (Task 10). Also captures the overlay window for the
    // interaction closures.
    const onAxes = (info: AxisRenderInfo): void => {
        if (info.paneKey === "overlay") {
            lastOverlayWindow = { xMin: info.window.xMin, xMax: info.window.xMax };
            lastOverlayCssWidth = info.cssRect.width;
            overlay?.clear();
        }
        overlay?.paintAxisLabels(info, state.palette);
        // Override SUBSTRATE (bg-color / candle-override / bar-override /
        // bar-color / horizontal-histogram) paints BEFORE the z-sorted glyph /
        // drawing pass — the canvas2d `renderBackgroundOverlays` /
        // `renderBarOverlays` order. Overlay pane only; independent of
        // `state.bars` (`resolveOverridePaint` skips per-bar overrides whose
        // bar is absent, but a `bg-color` / `horizontal-histogram` anchors by
        // time / price alone).
        if (overlay !== undefined && info.paneKey === "overlay") {
            paintOverlaySubstrate(state, info, overlay);
        }
        // Glyph plot styles + alert badges paint via the SHARED adapter-kit
        // glyph geometry on the overlay (the correctness baseline; the GPU
        // marker programs are the optional perf path). Overlay pane only — the
        // glyph anchors project against the overlay window; sub-pane glyphs
        // arrive with the per-pane split (Task 10). `glyphs.ts` owns the pure
        // anchor projection; the overlay paints the shared shape at it.
        if (overlay !== undefined && info.paneKey === "overlay" && state.bars.length > 0) {
            paintOverlayGlyphs(state, info, overlay);
        }
        // Drawings (`draw.*`) paint on the overlay too, through the shared
        // `decomposeDrawing` + `paintPrimitive` sink — the same overlay-pane
        // viewport the glyphs use. Overlay pane only (Task 14 finalizes the
        // global z-order); independent of `state.bars` (a drawing can anchor by
        // absolute time without bars in the window).
        if (overlay !== undefined && info.paneKey === "overlay") {
            paintOverlayDrawings(state, info, overlay);
        }
    };

    const renderer =
        glContext === undefined ? undefined : new Renderer(glContext, { gridColor, onAxes });
    const host =
        opts.host ??
        createWorkerHost(
            opts.workerLike !== undefined
                ? {
                      capabilities,
                      symInfo: WEBGL_SYM_INFO,
                      ...(opts.resolveInputs !== undefined
                          ? { resolveInputs: opts.resolveInputs }
                          : {}),
                      workerLike: opts.workerLike,
                  }
                : {
                      capabilities,
                      symInfo: WEBGL_SYM_INFO,
                      ...(opts.resolveInputs !== undefined
                          ? { resolveInputs: opts.resolveInputs }
                          : {}),
                  },
        );

    // Subpane layout (Task 10): split the canvas into the overlay (price) pane
    // plus a stacked subpane per non-overlay `paneOrder` entry (volume / RSI /
    // …), each with its own CSS-px band. Resolved fresh each frame from
    // `state.paneOrder` (which grows as subpane series arrive) + the GL
    // context's CSS dims so the renderer's `paneViewport` rounds correctly. A
    // single-pane chart (no subpanes) collapses to the overlay spanning the
    // whole canvas — the Task-5 MVP shape.
    const layout = (): ReadonlyArray<PaneLayoutRect> =>
        glContext === undefined
            ? []
            : computePaneLayout(state.paneOrder, glContext.cssWidth, glContext.cssHeight);

    // Re-run the frame: rebuild the descriptors from the current state +
    // window, stage them, and schedule a draw. The run loop only repaints on
    // candle events, so interaction (pan / zoom / reset) calls this to repaint
    // on a view change. A no-op without a renderer (headless).
    const requestRender = (): void => {
        if (renderer === undefined) return;
        renderer.update(buildFrame(state, layout()));
        renderer.scheduleDraw();
    };

    // Wire pan / zoom / reset to the SHARED `ViewController` (the same one
    // `buildFrame` resolves its window from) via the shared `attachInteraction`
    // — not invinite's `ChartController`, so the held-window + auto-follow
    // semantics match canvas2d / uplot. Only a real canvas (with
    // `addEventListener`) attaches listeners; the headless + injected-gl paths
    // skip it. `requestRender` repaints after each gesture.
    let detachInteraction: (() => void) | undefined;
    /* v8 ignore start -- DOM event wiring is browser-only */
    const interactionEl = opts.canvas as Partial<HTMLElement>;
    if (glContext !== undefined && typeof interactionEl.addEventListener === "function") {
        detachInteraction = attachChartInteraction(opts.canvas as HTMLElement, {
            controller: state.view,
            getViewport: () => ({
                xMin: lastOverlayWindow.xMin,
                xMax: lastOverlayWindow.xMax,
                pxWidth: lastOverlayCssWidth,
            }),
            dataBounds: () => {
                const { bars } = state;
                if (bars.length === 0) return { xMin: 0, xMax: 1 };
                return { xMin: bars[0].time, xMax: bars[bars.length - 1].time };
            },
            requestRender,
        });
    }
    /* v8 ignore stop */

    const adapter = defineAdapter({
        id: "webgl-reference",
        name: "WebGL Reference Adapter",
        capabilities,
        ...(opts.resolveInputs !== undefined ? { resolveInputs: opts.resolveInputs } : {}),
        symInfo: WEBGL_SYM_INFO,
        candles: () => opts.candleSource,
        onEmissions: (emissions) => {
            applyEmissions(state, emissions, opts.onAlert, opts.alertBadgeFilter);
            // With no GL context (headless / conformance), the draw is a safe
            // no-op — state still accumulated above.
            requestRender();
        },
        dispose: () => {
            detachInteraction?.();
            overlay?.dispose();
            renderer?.dispose();
            // Only tear down a context the factory created — the injected
            // `opts.gl` seam's lifetime belongs to the test that supplied it.
            if (createdGlContext) glContext?.dispose();
            resetAdapterState(state);
            host.dispose();
        },
    });

    const handle: WebglAdapterHandle = Object.freeze({ ...adapter, host });
    HANDLE_STATE.set(handle, state);
    HANDLE_INTERVAL.set(handle, opts.interval ?? DEFAULT_INTERVAL);
    return handle;
}

/**
 * Optional second argument for {@link runWebglLoop}. Pass a `signal` from an
 * `AbortController` to cancel the loop cleanly: once the signal aborts, the
 * loop drops the current iteration's remaining work, breaks out of the
 * async-iterator, and resolves (no throw) — the convention a React consumer
 * needs when it unmounts mid-stream.
 *
 * @since 0.1
 * @stable
 * @example
 *     const opts: RunWebglLoopOpts = { signal: new AbortController().signal };
 *     void opts;
 */
export type RunWebglLoopOpts = Readonly<{
    signal?: AbortSignal;
}>;

/**
 * Drive a built adapter through one full pass of its candle source: iterate
 * the events, mirror each into the renderer's bar window, `await
 * host.push(event)`, yield once (so an async worker host can dispatch the
 * event), then `host.drain()` + `adapter.onEmissions(...)`. Returns when the
 * source completes; throws whatever the source / host throws.
 *
 * Pass `opts.signal` (typically from an `AbortController`) to cancel the loop
 * cleanly. On abort the loop returns silently — no throw — after finishing at
 * most one in-flight `host.push` / `host.drain`. Mirrors canvas2d's
 * `runRendererLoop` so the seam wiring (Task 9) is identical across adapters.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { createWebglAdapter, runWebglLoop } from "chartlang-example-webgl-adapter";
 *     import { mockCandleSource } from "@invinite-org/chartlang-adapter-kit";
 *     const adapter = createWebglAdapter({
 *         canvas: { width: 320, height: 240 },
 *         candleSource: mockCandleSource([]),
 *     });
 *     // await adapter.host.load(compiled);
 *     // await runWebglLoop(adapter);
 *     const fn: typeof runWebglLoop = runWebglLoop;
 *     void fn;
 */
export async function runWebglLoop(
    handle: WebglAdapterHandle,
    opts: RunWebglLoopOpts = {},
): Promise<void> {
    const state = HANDLE_STATE.get(handle);
    const interval = HANDLE_INTERVAL.get(handle);
    if (state === undefined || interval === undefined) {
        throw new Error("runWebglLoop: handle was not produced by createWebglAdapter");
    }
    const signal = opts.signal;
    const aborted = (): boolean => signal?.aborted ?? false;
    if (aborted()) return;
    for await (const event of handle.candles({ interval })) {
        if (aborted()) return;
        applyCandleEvent(state, event);
        await handle.host.push(event);
        if (aborted()) return;
        // Yield once so an async worker host can complete its candle-event
        // dispatch before the drain frame is processed. In-process hosts
        // resolve `push` synchronously and the microtask flush is a no-op.
        await new Promise<void>((r) => setTimeout(r, 0));
        if (aborted()) return;
        const emissions = await handle.host.drain();
        if (aborted()) return;
        handle.onEmissions(emissions);
    }
}
