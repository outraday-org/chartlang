// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import {
    type Adapter,
    type AlertConditionEmission,
    type AlertEmission,
    type CandleEvent,
    type Capabilities,
    type DrawingEmission,
    type InteractionHandlers,
    type LogEmission,
    type PlotEmission,
    type PlotStyle,
    type RunnerEmissions,
    type ViewController,
    type Viewport,
    attachInteraction,
    createViewController,
    decomposeDrawing,
    defineAdapter,
    maxShiftedTime,
    medianBarSpacing,
    priceToY,
    shiftedBarTime,
    timeToX,
    validateEmission,
} from "@invinite-org/chartlang-adapter-kit";
import { type RenderCtx, paintPrimitive } from "@invinite-org/chartlang-adapter-kit/canvas";
import type { Bar, LineStyle } from "@invinite-org/chartlang-core";
import {
    type ScriptHost,
    type WorkerLike,
    createWorkerHost,
} from "@invinite-org/chartlang-host-worker";
import uPlot from "uplot";

import { type BgColorBand, drawBgColorBand } from "./bgColor.js";
import { type CandlePathStyle, type ProjectedCandle, drawCandlePaths } from "./candlePaths.js";
import { UPLOT_CAPABILITIES, UPLOT_SYM_INFO } from "./capabilities.js";
import { buildViewport, offsetForViewport } from "./viewport.js";

const DEFAULT_INTERVAL = "1D";
const MAX_RECENT_ALERTS = 256;
const MAX_RECENT_LOGS = 5;
// Nominal right gutter for the price axis. Only feeds `computePaneViewportFor`'s
// `pxWidth`, which now reaches just `renderFrame`'s `setScale("y", …)` (a y-range
// consumer that ignores width) — the ctx pass projects candles/hlines through
// uPlot's REAL plotting-area bbox via `buildViewport`, so the actual axis inset
// is uPlot's, not this constant. Kept so the data viewport stays a full Viewport.
const Y_AXIS_GUTTER_PX = 52;
const Y_AXIS_PADDING = 0.05;
const CANDLE_BODY_WIDTH_PX = 6;
const DEFAULT_BULL = "#26a69a";
const DEFAULT_BEAR = "#ef5350";
const HLINE_COLOR = "#787b86";
// Fallback stroke for a series carrying no per-point color (mirrors the
// echarts / konva `seriesColor` fallback). The all-blue hardcode this
// replaced was a BUG: every series read the same `#3b82f6`, so a multi-plot
// script (or the `sma-offset` sample's three SMA copies) rendered as one
// blue line.
const DEFAULT_LINE_COLOR = "#3b82f6";
// Half a bar spacing is padded onto each side of the x scale so the first /
// last candle CENTRES sit inside the plotting area instead of spilling the
// last body into the right price-axis gutter (uPlot auto-ranges x so the
// last bar lands exactly at the plot-area right edge). Mirrors the feel of
// canvas2d's reserved gutter.
const X_PAD_BARS = 0.5;

// uPlot's `AlignedData` is `[xValues, ...yValues]`; chartlang feeds the
// bar times as x and per-series values as y (`null` ⇒ gap).
type AlignedData = ReadonlyArray<ReadonlyArray<number | null>>;

/**
 * The subset of a uPlot instance the factory calls. Declared
 * structurally so the factory is testable without a DOM: tests inject a
 * `MockUplot`; production injects a real `uPlot` (which satisfies this
 * shape). `valToPos` + `ctx` are what the `hooks.draw` pass reads to
 * paint horizontal lines (and, in Task 8, drawings).
 *
 * @since 1.4
 * @stable
 * @example
 *     declare const u: UplotLike;
 *     u.setData([[0, 1], [10, 20]]);
 *     void u;
 */
export type UplotLike = {
    setData(data: AlignedData, resetScales?: boolean): void;
    setScale(scaleKey: string, limits: { min: number; max: number }): void;
    destroy(): void;
    valToPos(val: number, scaleKey: string, canvasPixels?: boolean): number;
    // Inverse of `valToPos` for the cursor pivot: a plotting-area pixel x
    // back to a world time. uPlot exposes this natively; the wheel handler
    // reads it to zoom about the cursor.
    posToVal(pos: number, scaleKey: string): number;
    // uPlot's plotting-area overlay element — the event target the
    // pan/zoom listeners attach to (`attachInteraction`). A real uPlot
    // hands its `u.over` div; `MockUplot` hands a dispatchable stub.
    readonly over: HTMLElement;
    readonly ctx: RenderCtx;
    // The scale ranges (`x` = time, `y` = price) drawings project off,
    // and the plotting-area bbox (canvas px) the drawing-pass viewport is
    // built from. A subset of uPlot's `scales` / `bbox`.
    readonly scales: Readonly<Record<string, { readonly min?: number; readonly max?: number }>>;
    readonly bbox: {
        readonly left: number;
        readonly top: number;
        readonly width: number;
        readonly height: number;
    };
};

/**
 * One uPlot series descriptor the factory builds per chartlang plot slot.
 * A subset of uPlot's `Series` carrying only the fields the factory sets;
 * `paths` selects line vs step vs bars vs band rendering.
 *
 * @since 1.4
 * @stable
 * @example
 *     const s: UplotSeriesSpec = { label: "EMA", scale: "y", stroke: "#3b82f6", paths: "line" };
 *     void s;
 */
export type UplotSeriesSpec = {
    readonly label: string;
    readonly scale: string;
    readonly stroke: string;
    readonly fill?: string;
    readonly paths: "line" | "step" | "bars" | "band" | "candle";
};

/**
 * The options object the factory hands to {@link UplotFactory} per pane.
 * A subset of uPlot's `Options`; `hooks.draw` is the ctx pass for
 * horizontal lines (extended for drawings in Task 8).
 *
 * @since 1.4
 * @stable
 * @example
 *     declare const opts: UplotOptions;
 *     void opts;
 */
export type UplotOptions = {
    readonly width: number;
    readonly height: number;
    readonly paneKey: string;
    readonly series: ReadonlyArray<UplotSeriesSpec>;
    // `draw` paints candles/hlines/drawings each redraw; `ready` runs once
    // after the instance mounts — the adapter wires pan/zoom listeners onto
    // `u.over` there (what a real uPlot does post-construct).
    readonly hooks: {
        readonly draw: ReadonlyArray<(u: UplotLike) => void>;
        readonly ready?: ReadonlyArray<(u: UplotLike) => void>;
    };
};

/**
 * Factory seam that constructs a {@link UplotLike} from built options +
 * aligned data + a DOM target. Production uses the default (real uPlot);
 * tests inject a `MockUplot` factory.
 *
 * @since 1.4
 * @stable
 * @example
 *     const f: UplotFactory = (_opts, _data, _target) => {
 *         throw new Error("test injects this");
 *     };
 *     void f;
 */
export type UplotFactory = (
    opts: UplotOptions,
    data: AlignedData,
    target: HTMLElement,
) => UplotLike;

/**
 * Constructor options for {@link createUplotAdapter}. `uplotFactory` and
 * `ctx` are test seams: production leaves them undefined (the adapter
 * constructs a real uPlot per pane against `target`); tests inject a
 * `MockUplot` factory plus a `MockCanvasContext` as the draw-hook ctx.
 * `host` / `workerLike` mirror the canvas2d adapter's host seams.
 *
 * @since 1.4
 * @stable
 * @example
 *     import { mockCandleSource } from "@invinite-org/chartlang-adapter-kit";
 *     declare const target: HTMLElement;
 *     const opts: CreateUplotAdapterOpts = {
 *         target,
 *         width: 800,
 *         height: 400,
 *         candleSource: mockCandleSource([]),
 *     };
 *     void opts;
 */
export type CreateUplotAdapterOpts = {
    readonly target: HTMLElement;
    readonly width: number;
    readonly height: number;
    readonly candleSource: AsyncIterable<CandleEvent>;
    readonly capabilities?: Capabilities;
    readonly interval?: string;
    readonly uplotFactory?: UplotFactory;
    readonly resolveInputs?: (scriptId: string) => Readonly<Record<string, unknown>>;
    readonly onAlert?: (a: AlertEmission) => void;
    readonly host?: ScriptHost;
    readonly workerLike?: WorkerLike;
    /**
     * Default visible window: when set, the chart opens framed on only the
     * most recent N bars (rest stay scrollable via pan/zoom); omit/0 = fit
     * all data, byte-identical to before. Ignored once the user interacts.
     */
    readonly initialVisibleBars?: number;
};

/**
 * Public handle the consumer drives. `host` is exposed so callers can
 * `await adapter.host.load(compiled)` before invoking {@link runUplotLoop}.
 *
 * @since 1.4
 * @stable
 * @example
 *     declare const adapter: UplotAdapterHandle;
 *     // await adapter.host.load(compiled);
 *     void adapter;
 */
export type UplotAdapterHandle = Adapter & { readonly host: ScriptHost };

type PlotPoint = {
    readonly time: number;
    readonly value: number | null;
    // The per-bar emitted color (`null` ⇒ inherit the default). The series'
    // stroke is the LAST non-null color (`seriesColor`); the all-blue
    // hardcode this carries was a BUG.
    readonly color: string | null;
    // The bar index the point was computed at + the presentation-only
    // `offset` (`xShift`; `+n` right/future, `−n` left/past). Together they
    // resolve the column the value lands in via `shiftedBarTime`; an omitted
    // / `0` `xShift` keeps the value on its own bar (aligned-data unchanged).
    readonly bar: number;
    readonly xShift?: number;
};

type PanedHLine = {
    readonly price: number;
    readonly color: string;
    readonly lineWidth: number;
    readonly lineStyle: LineStyle;
    readonly paneKey: string;
};

type AdapterState = {
    readonly target: HTMLElement;
    readonly width: number;
    readonly height: number;
    readonly uplotFactory: UplotFactory;
    readonly bars: Bar[];
    // Distinct pane keys in first-emit order; `"overlay"` is index 0.
    paneOrder: string[];
    // One built uPlot instance per pane, created lazily on first frame.
    readonly instances: Map<string, UplotLike>;
    // Keyed `${paneKey}|${slotId}` so the same slot can land in distinct
    // panes and a pane's y-scale only sees its own series.
    readonly plotSeries: Map<string, PlotPoint[]>;
    readonly plotSeriesStyle: Map<string, PlotStyle>;
    // Keyed by slotId (last-write-wins); carries its resolved pane key.
    readonly hlines: Map<string, PanedHLine>;
    // Per-bar candle-state overrides (bg / bar / candle-override,
    // horizontal-histogram) keyed `${slotId}@${time}`. Buffered like
    // canvas2d; the bg-color / bar-color subset is also projected into the
    // dedicated per-bar maps below for the overlay draw hook.
    readonly overlays: Map<string, PlotEmission>;
    // Resolved per-bar `bgcolor` bands, keyed by bar TIME (last-write-wins).
    // The `colorValue` precedence is settled at ingest (`applyPlot`), so a
    // `null` gap DELETES the bar's entry rather than enqueuing it. Painted
    // first in the overlay draw hook (behind the candles).
    readonly bgColors: Map<number, BgColorBand>;
    // Resolved per-bar `barcolor` candle tints, keyed by bar TIME. Same
    // precedence + `null`-deletes contract; threaded into the candle paint
    // (body + wick) for the matching bar.
    readonly barColors: Map<number, string>;
    // Drawings are buffered for Task 8 (not rendered here).
    readonly drawings: Map<string, DrawingEmission>;
    readonly recentAlerts: AlertEmission[];
    readonly currentAlertConditions: AlertConditionEmission[];
    readonly recentLogs: LogEmission[];
    // Shared pan/zoom controller. uPlot owns the live scales, so the
    // interaction handlers drive `setScale("x", …)` directly off the
    // controller window across EVERY pane instance (x stays synced). Once
    // `userInteracted` flips, `renderFrame` stops re-pinning y and switches
    // `setData` to `resetScales:false` so live bars don't snap the view back.
    readonly view: ViewController;
    userInteracted: boolean;
    // Detach functions returned by `attachInteraction`, one per wired pane
    // instance; called on dispose to remove the pan/zoom listeners.
    readonly interactionDetachers: Array<() => void>;
    // Default visible window: when set, the auto-follow view frames only the
    // most recent N bars (rest stay scrollable). Undefined ⇒ fit all data,
    // byte-identical to the pre-feature path. Ignored once the user interacts.
    readonly initialVisibleBars?: number;
};

const HANDLE_STATE: WeakMap<UplotAdapterHandle, AdapterState> = new WeakMap();
const HANDLE_INTERVAL: WeakMap<UplotAdapterHandle, string> = new WeakMap();

// The default factory wraps the real uPlot constructor, which needs a
// live DOM target + canvas — exercised only in a browser, never in
// headless vitest. The whole function carries a v8 exemption (tests inject
// a `MockUplot` factory instead), mirroring canvas2d's production-only
// host path exemption.
/* v8 ignore start -- real uPlot needs a live DOM canvas; tests inject MockUplot */
function defaultUplotFactory(
    opts: UplotOptions,
    data: AlignedData,
    target: HTMLElement,
): UplotLike {
    // uPlot's `AlignedData` is mutable; the adapter owns the array, so a
    // shallow copy hands uPlot a fresh mutable table without mutating ours.
    const mutableData = data.map((row) => row.slice()) as uPlot.AlignedData;
    const instance = new uPlot(
        {
            width: opts.width,
            height: opts.height,
            series: [{}, ...opts.series.map((s) => ({ label: s.label, stroke: s.stroke }))],
            // Price axis on the RIGHT (uPlot's default y axis is `side: 3`
            // = left), matching the house convention — canvas2d, echarts,
            // and lightweight-charts all carry the price scale on the right.
            // This also aligns the real axis with the `Y_AXIS_GUTTER_PX`
            // right gutter the data viewport already reserves. uPlot recomputes
            // its plotting-area bbox for the moved axis, and the ctx pass reads
            // that real bbox via `buildViewport`, so candles/hlines/drawings
            // stay aligned with no further change. Styled for the dark surface
            // (muted grid + label stroke) so the labels read on the demo.
            axes: [
                { stroke: "#9ca3af", grid: { stroke: "rgba(148, 163, 184, 0.15)" } },
                {
                    side: 1,
                    scale: "y",
                    stroke: "#9ca3af",
                    grid: { stroke: "rgba(148, 163, 184, 0.15)" },
                },
            ],
            // Disable uPlot's native drag-to-zoom-select; ALL pan/zoom flows
            // through the adapter's `attachInteraction` listeners (wired in
            // the `ready` hook) so drag pans and the wheel zooms BOTH ways.
            cursor: { drag: { x: false, y: false } },
            // Hide uPlot's built-in DOM legend. The adapter labels each series
            // by its chartlang slotId (`demo.chart.ts:12:9#0`), which is noise
            // to an end user, and the legend table renders BELOW the fixed-
            // height chart container — overflowing into whatever sits under it
            // (the demo's alert feed). No other rendering model in the example
            // set shows a legend, so hiding it keeps the surface self-contained.
            legend: { show: false },
            hooks: {
                draw: opts.hooks.draw.map((fn) => (u: uPlot) => fn(u as unknown as UplotLike)),
                ready: (opts.hooks.ready ?? []).map(
                    (fn) => (u: uPlot) => fn(u as unknown as UplotLike),
                ),
            },
        },
        mutableData,
        target,
    );
    return instance as unknown as UplotLike;
}
/* v8 ignore stop */

function paneSlotKey(paneKey: string, slotId: string): string {
    return `${paneKey}|${slotId}`;
}

// Resolve a `PlotEmission.pane` to the stable pane key the renderer stacks
// instances by. `"overlay"` is pane 0; a named string keys a stable
// sub-pane on first sight and is reused; `"new"` allocates a FRESH sub-pane
// per emitting slot (`new:${slotId}`), mirroring the lightweight-charts
// adapter, where each distinct `"new"` call site lands in its own pane.
// The key is derived from the slot (not a running counter) so the same
// call site re-emitting `"new"` every bar reuses its pane instead of
// allocating a runaway pane per frame — the runtime re-emits each slot on
// every bar close.
function resolvePaneKey(pane: string, slotId: string): string {
    return pane === "new" ? `new:${slotId}` : pane;
}

function paneKeyPrefix(paneKey: string): string {
    return `${paneKey}|`;
}

// Canonical `setLineDash` segment array per chartlang `LineStyle`. A local
// copy of the canvas2d adapter's `render/lineDash.ts` convention (`"solid"`
// → `[]`, `"dashed"` → `[6, 4]`, `"dotted"` → `[2, 4]`): the helper is not
// promoted to adapter-kit, and cross-importing another example's `src/` is
// forbidden, so the few-line convention is mirrored here.
function dashPattern(style: LineStyle): readonly number[] {
    if (style === "dashed") return [6, 4];
    if (style === "dotted") return [2, 4];
    return [];
}

// Map a chartlang `PlotStyle` to the uPlot path family the series uses.
// Override / candle-state kinds don't become series at all (they paint in
// the draw hook), so they never reach here.
function pathsFor(style: PlotStyle): UplotSeriesSpec["paths"] {
    if (style.kind === "step-line") return "step";
    if (style.kind === "histogram") return "bars";
    if (style.kind === "filled-band") return "band";
    return "line";
}

function fillFor(style: PlotStyle, color: string): string | undefined {
    if (style.kind === "area" || style.kind === "filled-band") return color;
    return undefined;
}

// A `PlotStyle` becomes a native uPlot series iff it is one of the
// continuous-series kinds. Glyphs / labels / overrides are handled in the
// draw hook (or buffered) so they are excluded here.
function isSeriesStyle(style: PlotStyle): boolean {
    return (
        style.kind === "line" ||
        style.kind === "step-line" ||
        style.kind === "histogram" ||
        style.kind === "area" ||
        style.kind === "filled-band"
    );
}

// Compute the y-range a pane should span: the overlay pane sees bars plus
// its own series + hlines; a subpane sees only its own series + hlines.
function computeYRange(state: AdapterState, paneKey: string): { yMin: number; yMax: number } {
    let yMin = Number.POSITIVE_INFINITY;
    let yMax = Number.NEGATIVE_INFINITY;
    if (paneKey === "overlay") {
        for (const bar of state.bars) {
            if (bar.low < yMin) yMin = bar.low;
            if (bar.high > yMax) yMax = bar.high;
        }
    }
    const prefix = paneKeyPrefix(paneKey);
    for (const [key, series] of state.plotSeries) {
        if (!key.startsWith(prefix)) continue;
        for (const point of series) {
            if (point.value === null || !Number.isFinite(point.value)) continue;
            if (point.value < yMin) yMin = point.value;
            if (point.value > yMax) yMax = point.value;
        }
    }
    for (const hline of state.hlines.values()) {
        if (hline.paneKey !== paneKey) continue;
        if (hline.price < yMin) yMin = hline.price;
        if (hline.price > yMax) yMax = hline.price;
    }
    return { yMin, yMax };
}

// Build the pixel viewport for one pane. Only ever called with a non-empty
// bar window (both call sites guard `bars.length > 0`), so the x-range is
// always derivable; the y-range falls back to (0, 1) when the pane has no
// finite candidate and expands a degenerate single-value range.
function computePaneViewportFor(state: AdapterState, paneKey: string): Viewport {
    const plotWidth = Math.max(1, state.width - Y_AXIS_GUTTER_PX);
    let xMin = Number.POSITIVE_INFINITY;
    let xMax = Number.NEGATIVE_INFINITY;
    for (const bar of state.bars) {
        if (bar.time < xMin) xMin = bar.time;
        if (bar.time > xMax) xMax = bar.time;
    }
    let { yMin, yMax } = computeYRange(state, paneKey);
    if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) {
        yMin = 0;
        yMax = 1;
    } else if (yMin === yMax) {
        yMin -= 1;
        yMax += 1;
    }
    const yPad = (yMax - yMin) * Y_AXIS_PADDING;
    return {
        xMin,
        xMax: xMax === xMin ? xMin + 1 : xMax,
        yMin: yMin - yPad,
        yMax: yMax + yPad,
        pxWidth: plotWidth,
        pxHeight: state.height,
    };
}

// The series' stroke colour: the LAST non-null per-point color, falling
// back to `DEFAULT_LINE_COLOR`. Mirrors the echarts / konva `seriesColor`
// helper — every adapter resolves the per-series stroke the same way, so a
// multi-plot script gets DISTINCT colours instead of the old all-blue
// hardcode (which was a BUG).
function seriesColor(points: ReadonlyArray<PlotPoint>, fallback: string): string {
    for (let i = points.length - 1; i >= 0; i--) {
        const color = points[i].color;
        if (color !== null) return color;
    }
    return fallback;
}

// Project the candles for the overlay pane into canvas (device) pixel
// space. `viewport` is uPlot's plotting-area viewport (`buildViewport`), so
// `timeToX`/`priceToY` land plotting-area-relative; `dx`/`dy` shift them to
// the absolute canvas pixel uPlot's series occupy (the plotting-area offset
// `offsetForViewport` returns). The candles paint directly to the device-px
// `hooks.draw` ctx, so the offset is folded into the coords here rather than
// via a ctx translate (the translate is reserved for the drawing pass, whose
// presence/absence the renderer's tests assert by counting translates).
function projectCandles(
    bars: ReadonlyArray<Bar>,
    viewport: Viewport,
    dx: number,
    dy: number,
    barColors: ReadonlyMap<number, string>,
): ProjectedCandle[] {
    return bars.map((bar) => {
        // A per-bar `barcolor` override tints both the body + wick; omitted
        // ⇒ no `color` key, byte-identical to the bull/bear default render.
        const color = barColors.get(bar.time);
        return {
            x: timeToX(bar.time, viewport) + dx,
            openY: priceToY(bar.open, viewport) + dy,
            closeY: priceToY(bar.close, viewport) + dy,
            highY: priceToY(bar.high, viewport) + dy,
            lowY: priceToY(bar.low, viewport) + dy,
            ...(color === undefined ? {} : { color }),
        };
    });
}

// Paint every resolved `bgcolor` band into the overlay draw hook, behind
// the candles. The `colorValue` precedence + `null` gap are settled at
// ingest (the map only holds live bands), so each paints unconditionally.
// An empty map early-returns with no ctx calls, so a band-free script keeps
// the candle/hline/drawing hash byte-identical.
function paintBgColors(state: AdapterState, viewport: Viewport, dx: number, ctx: RenderCtx): void {
    if (state.bgColors.size === 0) return;
    const barCount = state.bars.length;
    for (const band of state.bgColors.values()) {
        drawBgColorBand(ctx, band, viewport, dx, barCount);
    }
}

// The draw-hook ctx pass for a pane: paint candles (overlay only) +
// horizontal lines via the pane's viewport, to the instance's own canvas
// ctx (`u.ctx` — a real `CanvasRenderingContext2D` in production, a
// `MockCanvasContext` under test). This is the seam Task 8 extends to
// paint drawings; Task 7 establishes it for hlines + candles.
function paintPaneOverlay(state: AdapterState, paneKey: string, u: UplotLike): void {
    if (state.bars.length === 0) return;
    // uPlot's real plotting-area viewport (device px) + its canvas offset,
    // so candles + hlines land exactly where uPlot's own series + axes do —
    // not on a hand-rolled `state.width`-sized rect that ignored the axis
    // inset and `devicePixelRatio` (the Retina mis-scale fix).
    const viewport = buildViewport(u);
    const { dx, dy } = offsetForViewport(u);
    const ctx = u.ctx;
    // Confine the whole hand-rolled draw pass to uPlot's plotting-area box.
    // uPlot clips its OWN series to this rect, but the `hooks.draw` ctx is the
    // unclipped full canvas — so without this, any candle / bg-band / drawing
    // whose bar falls OUTSIDE the visible x-window (a panned/zoomed view that
    // still has bars to the left or right) paints straight into the price-axis
    // gutter, on top of the axis labels (the reported "overreaches the axis"
    // bug). Clipping to `(dx, dy, pxWidth, pxHeight)` — device px, the same
    // space the marks are projected into — makes the candle pass honour the
    // plot edges exactly as the native series already do, on both axes. The
    // matching `restore()` at the end of the hook drops the clip.
    ctx.save();
    ctx.beginPath();
    ctx.rect(dx, dy, viewport.pxWidth, viewport.pxHeight);
    ctx.clip();
    if (paneKey === "overlay") {
        // `bgcolor` bands paint FIRST so they sit behind the candles — they
        // are candle-state background, not a sub-pane series, so they only
        // wash the overlay pane.
        paintBgColors(state, viewport, dx, ctx);
        const spacing = medianBarSpacing(state.bars);
        const bodyWidth = Math.max(
            1,
            Math.min(CANDLE_BODY_WIDTH_PX, timeToX(state.bars[0].time + spacing, viewport) * 0.6),
        );
        const style: CandlePathStyle = {
            bodyWidth,
            bull: DEFAULT_BULL,
            bear: DEFAULT_BEAR,
        };
        drawCandlePaths(ctx, projectCandles(state.bars, viewport, dx, dy, state.barColors), style);
    }
    for (const hline of state.hlines.values()) {
        if (hline.paneKey !== paneKey) continue;
        // uPlot owns the y scale, so the hline's pixel y comes from the
        // instance's `valToPos` (canvas/device pixels — already offset by
        // `bbox.top`). The line spans the real plotting area: from the
        // canvas-left offset across the plot width.
        const y = u.valToPos(hline.price, "y", true);
        if (!Number.isFinite(y)) continue;
        ctx.strokeStyle = hline.color;
        ctx.lineWidth = hline.lineWidth;
        ctx.setLineDash(dashPattern(hline.lineStyle));
        ctx.beginPath();
        ctx.moveTo(dx, y);
        ctx.lineTo(dx + viewport.pxWidth, y);
        ctx.stroke();
        // Restore solid 1px so the drawing pass + later hlines are not
        // contaminated by this line's width / dash (canvas2d convention).
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
    }
    paintDrawings(state, u, ctx);
    // Drop the plotting-area clip established at the top of the hook.
    ctx.restore();
}

// Paint every buffered drawing into the pane's draw hook via the shared
// adapter-kit geometry layer: `decomposeDrawing(state, view)` →
// `paintPrimitive(ctx, prim)`. The viewport is built from uPlot's OWN
// scales + bbox (`buildViewport`) so the projected pixels match the
// instance's series; the plotting-area offset is applied once via a ctx
// translate (see `offsetForViewport`). `op: "remove"` drawings are dropped
// at ingest by `applyDrawing`, so `state.drawings` only ever holds live
// drawings here (mirrors the canvas2d adapter, which likewise carries no
// redundant remove guard in its paint loop). Drawings decompose against
// THIS pane's scales, so a sub-pane drawing projects against the sub-pane's
// price range (matching the canvas2d overlay-tail behaviour where drawings
// ride the resolved pane).
function paintDrawings(state: AdapterState, u: UplotLike, ctx: RenderCtx): void {
    if (state.drawings.size === 0) return;
    const view = buildViewport(u);
    const { dx, dy } = offsetForViewport(u);
    ctx.save();
    ctx.translate(dx, dy);
    for (const drawing of state.drawings.values()) {
        for (const prim of decomposeDrawing(drawing, view)) {
            paintPrimitive(ctx, prim);
        }
    }
    ctx.restore();
}

// The series points of one pane, flattened, for the `maxShiftedTime`
// edge-extension pass (which only reads `bar` + `xShift`).
function panePoints(state: AdapterState, paneKey: string): PlotPoint[] {
    const prefix = paneKeyPrefix(paneKey);
    const points: PlotPoint[] = [];
    for (const [key, series] of state.plotSeries) {
        if (!key.startsWith(prefix)) continue;
        points.push(...series);
    }
    return points;
}

// Build the extended x (bar-time) row for a pane: the bar times, EXTENDED
// with extrapolated future columns (`lastTime + k·spacing`) up to the
// largest world time any `+k`-shifted point reaches (`maxShiftedTime`). A
// no-offset pane appends nothing, so `xs` equals the bar times verbatim and
// the aligned rows are byte-identical to the pre-offset path. A far-past
// (`−k`) shift is NOT prepended — it is clipped at the first bar (canvas2d
// parity: "−k clipped at negative x, xMin not extended").
function buildPaneXs(state: AdapterState, paneKey: string, spacing: number): number[] {
    const xs = state.bars.map((bar) => bar.time);
    const last = state.bars.length - 1;
    if (last < 0 || spacing <= 0) return xs;
    const lastTime = state.bars[last].time;
    const xMax = maxShiftedTime(panePoints(state, paneKey), state.bars, spacing, lastTime);
    for (let t = lastTime + spacing; t <= xMax; t += spacing) {
        xs.push(t);
    }
    return xs;
}

// Build the aligned data table for a pane: row 0 is the (possibly
// future-extended) bar-time row; each subsequent row is a series' values
// placed at the column whose time === the point's SHIFTED time
// (`shiftedBarTime`). A `−k` point whose shifted time precedes the first bar
// is dropped (clipped, not prepended). A point that lands on no column (a
// non-finite gap, or a defensively missing time) contributes nothing.
function buildPaneData(state: AdapterState, paneKey: string): AlignedData {
    const spacing = medianBarSpacing(state.bars);
    const xs = buildPaneXs(state, paneKey, spacing);
    const timeToCol = new Map<number, number>();
    for (let i = 0; i < xs.length; i++) timeToCol.set(xs[i], i);
    const firstTime = state.bars.length > 0 ? state.bars[0].time : 0;
    const rows: Array<ReadonlyArray<number | null>> = [xs];
    const prefix = paneKeyPrefix(paneKey);
    for (const [key, series] of state.plotSeries) {
        if (!key.startsWith(prefix)) continue;
        const row: Array<number | null> = xs.map(() => null);
        for (const point of series) {
            if (point.value === null || !Number.isFinite(point.value)) continue;
            const t = shiftedBarTime({
                bars: state.bars,
                bar: point.bar,
                xShift: point.xShift,
                spacing,
            });
            // A far-past shift lands before the first bar — clip it (no
            // negative-time column is prepended).
            if (t < firstTime) continue;
            const col = timeToCol.get(t);
            if (col === undefined) continue;
            row[col] = point.value;
        }
        rows.push(row);
    }
    return rows;
}

// Build the per-series specs for a pane, in stable key order.
function buildPaneSeries(state: AdapterState, paneKey: string): UplotSeriesSpec[] {
    const specs: UplotSeriesSpec[] = [];
    const prefix = paneKeyPrefix(paneKey);
    for (const [key, points] of state.plotSeries) {
        if (!key.startsWith(prefix)) continue;
        const style = state.plotSeriesStyle.get(key);
        // A stored series always has a style (set in lockstep in
        // `applyPlot`); the `??` is defensive only.
        /* v8 ignore next */
        const resolved: PlotStyle = style ?? { kind: "line", lineWidth: 1, lineStyle: "solid" };
        // The stroke is the series' LAST non-null per-point color (was a
        // hardcoded blue — a BUG that collapsed every series to one colour).
        const stroke = seriesColor(points, DEFAULT_LINE_COLOR);
        const fill = fillFor(resolved, stroke);
        specs.push({
            label: key.slice(prefix.length),
            scale: "y",
            stroke,
            ...(fill === undefined ? {} : { fill }),
            paths: pathsFor(resolved),
        });
    }
    return specs;
}

function buildPaneOptions(state: AdapterState, paneKey: string): UplotOptions {
    return {
        width: state.width,
        height: state.height,
        paneKey,
        series: buildPaneSeries(state, paneKey),
        hooks: {
            draw: [(u: UplotLike): void => paintPaneOverlay(state, paneKey, u)],
            ready: [(u: UplotLike): void => wireUplotInteraction(state, u)],
        },
    };
}

// The world-x extent of the loaded bars — the data bounds the pan/zoom
// controller clamps against (and the range a reset / auto-follow snaps to).
function barsXBounds(state: AdapterState): { readonly xMin: number; readonly xMax: number } {
    const { bars } = state;
    if (bars.length === 0) return { xMin: 0, xMax: 1 };
    let xMin = Number.POSITIVE_INFINITY;
    let xMax = Number.NEGATIVE_INFINITY;
    for (const bar of bars) {
        if (bar.time < xMin) xMin = bar.time;
        if (bar.time > xMax) xMax = bar.time;
    }
    return { xMin, xMax: xMax === xMin ? xMin + 1 : xMax };
}

// The auto-follow left edge implied by `state.initialVisibleBars` — the time
// of the bar `N` back from the last, so the default view frames only the most
// recent N bars (the rest stay scrollable). `undefined` (no N, N ≤ 0, or
// fewer bars than N) ⇒ fit all data, byte-identical to the pre-feature path.
// `resolveXWindow` clamps the value into the data range and ignores it once
// the user has interacted, so the "auto-follow until interacted" semantics
// hold for free.
function autoFollowXMin(state: AdapterState): number | undefined {
    const n = state.initialVisibleBars;
    return n !== undefined && n > 0 && state.bars.length > n
        ? state.bars[state.bars.length - n]?.time
        : undefined;
}

// Pad an x-window by half a bar spacing on each side so the first / last
// candle CENTRES sit inside the plotting area instead of the last body
// spilling into the right price-axis gutter (uPlot auto-ranges x so the
// last bar lands exactly at the plot-area right edge). A single-bar / empty
// window has zero spacing, so the pad is a no-op there.
function paddedXWindow(
    state: AdapterState,
    win: { readonly xMin: number; readonly xMax: number },
): { readonly min: number; readonly max: number } {
    const pad = X_PAD_BARS * medianBarSpacing(state.bars);
    return { min: win.xMin - pad, max: win.xMax + pad };
}

// Wire wheel-zoom / drag-pan / dblclick-reset onto a pane instance's `over`
// element (the `ready` hook calls this once per pane). All panes share
// `state.view`, and a gesture pushes the resolved x-window onto EVERY
// instance, so stacked panes stay x-synced. `attachInteraction`'s listener
// plumbing lives in adapter-kit (DOM-bound); the bridge closures below are
// covered by the headless `MockUplot` dispatch test.
function wireUplotInteraction(state: AdapterState, u: UplotLike): void {
    const handlers: InteractionHandlers = {
        controller: state.view,
        pxToWorldX: (px) => u.posToVal(px, "x"),
        // World-x units per pixel = the world span of a 1px step, read
        // straight off uPlot's inverse projection (no bbox math needed).
        worldXPerPx: () => u.posToVal(1, "x") - u.posToVal(0, "x"),
        dataBounds: () => barsXBounds(state),
        requestRender: () => {
            const { xMin, xMax } = barsXBounds(state);
            const win = paddedXWindow(
                state,
                state.view.resolveXWindow(xMin, xMax, autoFollowXMin(state)),
            );
            for (const inst of state.instances.values()) {
                inst.setScale("x", win);
            }
            state.userInteracted = state.view.userInteracted;
        },
    };
    state.interactionDetachers.push(attachInteraction(u.over, handlers));
}

// Lazily build, or update, the uPlot instance for each pane in pane
// order. On first sight a pane's instance is constructed via the factory;
// thereafter `setData` refreshes it. The draw hook re-derives candles +
// hlines each redraw from `state`, so a `setData` is enough to refresh.
function renderFrame(state: AdapterState): void {
    for (const paneKey of state.paneOrder) {
        const data = buildPaneData(state, paneKey);
        let instance = state.instances.get(paneKey);
        if (instance === undefined) {
            instance = state.uplotFactory(buildPaneOptions(state, paneKey), data, state.target);
            state.instances.set(paneKey, instance);
        } else {
            // After the user pans/zooms, keep their x window (`resetScales:
            // false`) so streaming bars don't snap the view back; until then
            // re-range x to the data (auto-follow).
            instance.setData(data, state.userInteracted ? false : undefined);
        }
        // Pin the y scale to the pane's range so `valToPos` (used by the
        // draw hook for hlines, and Task 8's drawings) is anchored to the
        // chartlang-computed window rather than uPlot's auto-range — the
        // overlay pane must share the candle scale, a subpane its own. Once
        // the user interacts, uPlot owns the y scale and the re-pin stops.
        // The x scale is pinned to the HALF-SPACING-PADDED data bounds (not
        // left to uPlot's flush auto-range) so the first / last candle
        // centres sit inside the plotting area instead of the last body
        // spilling into the right price-axis gutter.
        if (!state.userInteracted && state.bars.length > 0) {
            const viewport = computePaneViewportFor(state, paneKey);
            instance.setScale("y", { min: viewport.yMin, max: viewport.yMax });
            // Frame only the most recent `initialVisibleBars` (if set) while
            // the user has not interacted; the rest of the bars stay loaded
            // and scrollable. `resolveXWindow` returns the full data span when
            // `autoFollowXMin` is undefined, so an unset option is
            // byte-identical to the prior `barsXBounds(state)` auto-range.
            const { xMin, xMax } = barsXBounds(state);
            const win = state.view.resolveXWindow(xMin, xMax, autoFollowXMin(state));
            instance.setScale("x", paddedXWindow(state, win));
        }
    }
}

function applyPlot(state: AdapterState, plot: PlotEmission): void {
    if (plot.visible === false) return;
    const paneKey = resolvePaneKey(plot.pane, plot.slotId);
    if (paneKey !== "overlay" && !state.paneOrder.includes(paneKey)) {
        state.paneOrder.push(paneKey);
    }
    if (isSeriesStyle(plot.style)) {
        const key = paneSlotKey(paneKey, plot.slotId);
        const series = state.plotSeries.get(key) ?? [];
        series.push({
            time: plot.time,
            value: plot.value,
            color: plot.color,
            bar: plot.bar,
            // Omit a `0` / undefined shift so the unshifted column mapping in
            // `buildPaneData` stays byte-identical to the pre-offset path.
            ...(plot.xShift !== undefined && plot.xShift !== 0 ? { xShift: plot.xShift } : {}),
        });
        state.plotSeries.set(key, series);
        state.plotSeriesStyle.set(key, plot.style);
        return;
    }
    if (plot.style.kind === "horizontal-line") {
        state.hlines.set(plot.slotId, {
            price: plot.value ?? 0,
            color: plot.color ?? HLINE_COLOR,
            lineWidth: plot.style.lineWidth,
            lineStyle: plot.style.lineStyle,
            paneKey,
        });
        return;
    }
    // `bg-color` / `bar-color` additionally project into the dedicated
    // per-bar maps the overlay draw hook paints from (resolving the
    // `colorValue` precedence at ingest). Both also stay in `overlays` so
    // the "all plot kinds" claim stays honest.
    if (plot.style.kind === "bg-color") {
        applyBgColor(state, plot, plot.style.color, plot.style.transp);
    } else if (plot.style.kind === "bar-color") {
        applyBarColor(state, plot, plot.style.color);
    }
    // Glyph / label / candle-state overrides (shape, marker, character,
    // arrow, label, bg-color, bar-color, candle/bar-override,
    // horizontal-histogram) are buffered per slot+bar; the "all plot kinds"
    // claim stays honest (declared in Capabilities, retained here) rather
    // than silently dropping the emission.
    state.overlays.set(`${plot.slotId}@${plot.time}`, plot);
}

// Resolve a `bg-color` emission's per-bar color via the precedence contract
// (`colorValue` present ⇒ overrides `style.color`; `null` ⇒ paint nothing
// this bar; `undefined` ⇒ the static `style.color`) and project it into the
// per-bar band map keyed by bar time. A `null` gap DELETES the bar's band so
// the draw hook never paints it.
function applyBgColor(
    state: AdapterState,
    plot: PlotEmission,
    staticColor: string,
    transp: number | undefined,
): void {
    const paint = plot.colorValue === undefined ? staticColor : plot.colorValue;
    if (paint === null) {
        state.bgColors.delete(plot.time);
        return;
    }
    state.bgColors.set(plot.time, {
        time: plot.time,
        color: paint,
        ...(transp === undefined ? {} : { transp }),
    });
}

// Resolve a `bar-color` emission's per-bar tint via the same precedence
// contract and project it into the per-bar candle-tint map keyed by bar
// time. A `null` gap DELETES the bar's tint (the candle falls back to its
// bull/bear colour).
function applyBarColor(state: AdapterState, plot: PlotEmission, staticColor: string): void {
    const paint = plot.colorValue === undefined ? staticColor : plot.colorValue;
    if (paint === null) {
        state.barColors.delete(plot.time);
        return;
    }
    state.barColors.set(plot.time, paint);
}

function applyAlert(
    state: AdapterState,
    alert: AlertEmission,
    onAlert?: (a: AlertEmission) => void,
): void {
    state.recentAlerts.push(alert);
    while (state.recentAlerts.length > MAX_RECENT_ALERTS) {
        state.recentAlerts.shift();
    }
    onAlert?.(alert);
}

function applyLog(state: AdapterState, log: LogEmission): void {
    state.recentLogs.push(log);
    while (state.recentLogs.length > MAX_RECENT_LOGS) {
        state.recentLogs.shift();
    }
}

function applyDrawing(state: AdapterState, drawing: DrawingEmission): void {
    if (drawing.op === "remove") {
        state.drawings.delete(drawing.handleId);
        return;
    }
    state.drawings.set(drawing.handleId, drawing);
}

function applyValidated<T>(items: ReadonlyArray<T>, apply: (item: T) => void): void {
    for (const item of items) {
        if (validateEmission(item).ok) apply(item);
    }
}

function ingest(
    state: AdapterState,
    emissions: RunnerEmissions,
    onAlert?: (a: AlertEmission) => void,
): void {
    applyValidated(emissions.plots, (plot) => applyPlot(state, plot));
    applyValidated(emissions.drawings, (drawing) => applyDrawing(state, drawing));
    applyValidated(emissions.alerts, (alert) => applyAlert(state, alert, onAlert));
    state.currentAlertConditions.length = 0;
    applyValidated(emissions.alertConditions, (condition) =>
        state.currentAlertConditions.push(condition),
    );
    applyValidated(emissions.logs, (log) => applyLog(state, log));
    for (const d of emissions.diagnostics) {
        if (d.severity === "warning" || d.severity === "error") {
            console.warn(`[chartlang ${d.code}]`, d.message);
        }
    }
}

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
 * Build a frozen uPlot example adapter. Maps chartlang candles + plots +
 * horizontal lines onto stacked uPlot instances (one per
 * `PlotEmission.pane`, with `"overlay"` first), a custom candlestick path
 * builder, and a `hooks.draw` ctx pass for horizontal lines. Drawings are
 * buffered for Task 8. The returned `host` is exposed so the consumer can
 * `await adapter.host.load(compiled)` before invoking {@link runUplotLoop}.
 *
 * @since 1.4
 * @stable
 * @example
 *     import { createUplotAdapter } from "chartlang-example-uplot-adapter";
 *     import { mockCandleSource } from "@invinite-org/chartlang-adapter-kit";
 *     declare const target: HTMLElement;
 *     const adapter = createUplotAdapter({
 *         target,
 *         width: 800,
 *         height: 400,
 *         candleSource: mockCandleSource([]),
 *     });
 *     void adapter;
 */
export function createUplotAdapter(opts: CreateUplotAdapterOpts): UplotAdapterHandle {
    const capabilities = opts.capabilities ?? UPLOT_CAPABILITIES;
    const state: AdapterState = {
        // uPlot only touches the target inside the real constructor (the
        // `v8 ignore`d default factory); a structural stub is fine when a
        // `uplotFactory` is injected (tests).
        target: opts.target,
        width: opts.width,
        height: opts.height,
        uplotFactory: opts.uplotFactory ?? defaultUplotFactory,
        bars: [],
        paneOrder: ["overlay"],
        instances: new Map(),
        plotSeries: new Map(),
        plotSeriesStyle: new Map(),
        hlines: new Map(),
        overlays: new Map(),
        bgColors: new Map(),
        barColors: new Map(),
        drawings: new Map(),
        recentAlerts: [],
        currentAlertConditions: [],
        recentLogs: [],
        view: createViewController(),
        userInteracted: false,
        interactionDetachers: [],
        ...(opts.initialVisibleBars !== undefined
            ? { initialVisibleBars: opts.initialVisibleBars }
            : {}),
    };
    const host =
        opts.host ??
        createWorkerHost(
            opts.workerLike !== undefined
                ? {
                      capabilities,
                      symInfo: UPLOT_SYM_INFO,
                      ...(opts.resolveInputs !== undefined
                          ? { resolveInputs: opts.resolveInputs }
                          : {}),
                      workerLike: opts.workerLike,
                  }
                : {
                      capabilities,
                      symInfo: UPLOT_SYM_INFO,
                      ...(opts.resolveInputs !== undefined
                          ? { resolveInputs: opts.resolveInputs }
                          : {}),
                  },
        );

    const adapter = defineAdapter({
        id: "uplot-example",
        name: "uPlot Example Adapter",
        capabilities,
        ...(opts.resolveInputs !== undefined ? { resolveInputs: opts.resolveInputs } : {}),
        symInfo: UPLOT_SYM_INFO,
        candles: () => opts.candleSource,
        onEmissions: (emissions) => {
            ingest(state, emissions, opts.onAlert);
            renderFrame(state);
        },
        dispose: () => {
            for (const detach of state.interactionDetachers) detach();
            state.interactionDetachers.length = 0;
            for (const instance of state.instances.values()) {
                instance.destroy();
            }
            state.instances.clear();
            state.bars.length = 0;
            state.paneOrder = ["overlay"];
            state.plotSeries.clear();
            state.plotSeriesStyle.clear();
            state.hlines.clear();
            state.overlays.clear();
            state.bgColors.clear();
            state.barColors.clear();
            state.drawings.clear();
            state.recentAlerts.length = 0;
            state.currentAlertConditions.length = 0;
            state.recentLogs.length = 0;
            host.dispose();
        },
    });

    const handle: UplotAdapterHandle = Object.freeze({ ...adapter, host });
    HANDLE_STATE.set(handle, state);
    HANDLE_INTERVAL.set(handle, opts.interval ?? DEFAULT_INTERVAL);
    return handle;
}

/**
 * Optional second argument for {@link runUplotLoop}. Pass a `signal` from
 * an `AbortController` to cancel the loop cleanly: once aborted, the loop
 * drops the remaining work, breaks out of the iterator, and resolves (no
 * throw) — the convention a React consumer needs on unmount.
 *
 * @since 1.4
 * @stable
 * @example
 *     const opts: RunUplotLoopOpts = { signal: new AbortController().signal };
 *     void opts;
 */
export type RunUplotLoopOpts = Readonly<{ signal?: AbortSignal }>;

/**
 * Drive a built adapter through one full pass of its candle source:
 * mirror each event into the renderer's bar window, `await host.push`,
 * then `host.drain()` + `onEmissions(...)`. Returns when the source
 * completes. Pass `opts.signal` to cancel cleanly (no throw on abort).
 *
 * @since 1.4
 * @stable
 * @example
 *     import { createUplotAdapter, runUplotLoop } from "chartlang-example-uplot-adapter";
 *     import { mockCandleSource } from "@invinite-org/chartlang-adapter-kit";
 *     declare const target: HTMLElement;
 *     const adapter = createUplotAdapter({
 *         target,
 *         width: 800,
 *         height: 400,
 *         candleSource: mockCandleSource([]),
 *     });
 *     // await adapter.host.load(compiled);
 *     // await runUplotLoop(adapter);
 *     const fn: typeof runUplotLoop = runUplotLoop;
 *     void fn;
 */
export async function runUplotLoop(
    handle: UplotAdapterHandle,
    opts: RunUplotLoopOpts = {},
): Promise<void> {
    const state = HANDLE_STATE.get(handle);
    const interval = HANDLE_INTERVAL.get(handle);
    if (state === undefined || interval === undefined) {
        throw new Error("runUplotLoop: handle was not produced by createUplotAdapter");
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
        // dispatch before the drain frame is processed.
        await new Promise<void>((r) => setTimeout(r, 0));
        if (aborted()) return;
        const emissions = await handle.host.drain();
        if (aborted()) return;
        handle.onEmissions(emissions);
    }
}
