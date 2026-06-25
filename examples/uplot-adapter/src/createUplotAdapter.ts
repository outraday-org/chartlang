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
    RENDER_BAND,
    type RenderOrderKey,
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
    sortByRenderOrder,
    timeToX,
    validateEmission,
} from "@invinite-org/chartlang-adapter-kit";
import {
    type RenderCtx,
    drawArrow,
    drawCharacter,
    drawLabel,
    drawMarker,
    drawShape,
    paintPrimitive,
} from "@invinite-org/chartlang-adapter-kit/canvas";
import type { Bar, LineStyle } from "@invinite-org/chartlang-core";
import {
    type ScriptHost,
    type WorkerLike,
    createWorkerHost,
} from "@invinite-org/chartlang-host-worker";
import uPlot from "uplot";

import { type BgColorBand, drawBgColorBand } from "./bgColor.js";
import { type CandleOverridePalette, resolveCandleOverrideColor } from "./candleOverrides.js";
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
// Default volume-profile palette + the maximum bucket bar width (the longest
// bucket spans this many px from the right edge; shorter buckets scale by
// `volume / maxVolume`). Mirrors the canvas2d reference adapter's
// `HORIZONTAL_HISTOGRAM_MAX_WIDTH_PX` / `*_ROW_HEIGHT_PX` feel.
const HORIZONTAL_HISTOGRAM_COLOR = "#3b82f6";
const HORIZONTAL_HISTOGRAM_MAX_WIDTH_PX = 80;
const HORIZONTAL_HISTOGRAM_ROW_HEIGHT_PX = 4;
// Fallback colour for a glyph (shape / character / arrow / marker / label)
// whose emission carries a `null` top-level `color`. The shared glyph helpers
// take this as a plain string (they are model-free — no palette type).
const GLYPH_DEFAULT_COLOR = "#90caf9";
// Always-on-top alert-condition + log overlay text styling, mirroring the
// canvas2d reference (`render/alertConditions.ts` + `render/logPane.ts`).
// The colour is the demo plot default (canvas2d's `palette.plotDefault`); the
// uplot adapter is palette-free, so the few constants are mirrored locally
// (cross-importing another example's `src/` is forbidden).
const OVERLAY_TEXT_COLOR = "#e2e8f0";
const OVERLAY_FONT = "11px sans-serif";
const ALERT_PANEL_X_PAD = 12;
const ALERT_PANEL_Y = 18;
const ALERT_ROW_HEIGHT = 14;
const ALERT_PANEL_RIGHT_INSET = 180;
const LOG_PANE_PADDING = 8;
const LOG_ROW_HEIGHT = 13;

// uPlot's `AlignedData` is `[xValues, ...yValues]`; chartlang feeds the
// bar times as x and per-series values as y (`null` ⇒ gap).
type AlignedData = ReadonlyArray<ReadonlyArray<number | null>>;

// The `buckets` payload of a `horizontal-histogram` plot style (the
// volume-profile rows the overlay hook paints). Extracted from the wire
// `PlotStyle` arm so the buffered map stays exactly the wire shape.
type HorizontalHistogramBuckets = ReadonlyArray<
    Readonly<{ readonly price: number; readonly volume: number; readonly color?: string }>
>;

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
    // uPlot's device-pixel ratio (`bbox.width === plotWidthCss · pxRatio`).
    // Carried onto the drawing `Viewport.pxRatio` so the screen-space `table`
    // HUD scales its CSS-px sizes up to the device-px canvas. Optional: the
    // headless `MockUplot` runs at dpr 1 and omits it (⇒ `1`).
    readonly pxRatio?: number;
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
 * One native uPlot band: the fill between two adjacent series, identified by
 * their indices into {@link UplotOptions.series}. The uPlot adapter emits one
 * per `filled-band` plot slot — `series` is `[upperIdx, lowerIdx]` and `fill`
 * is the band colour (alpha already folded in). uPlot paints the region
 * between the two edges, honouring `null` per-bar gaps on either edge.
 *
 * @since 1.7
 * @stable
 * @example
 *     const band: UplotBandSpec = { series: [1, 2], fill: "rgba(38,166,154,0.2)" };
 *     void band;
 */
export type UplotBandSpec = {
    readonly series: readonly [number, number];
    readonly fill: string;
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
    // Native uPlot bands — one per `filled-band` slot, linking its upper +
    // lower edge series so uPlot fills the region between them. Omitted when
    // the pane has no filled-band (byte-identical to the pre-band path).
    readonly bands?: ReadonlyArray<UplotBandSpec>;
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
    // For a `filled-band` slot only: the LOWER edge value (`value` carries the
    // UPPER edge). Both feed a native two-row uPlot band; `null` on either
    // edge is a per-bar gap. Absent for every other series kind.
    readonly lower?: number | null;
    // Per-bar dynamic colour (`PlotEmission.colorValue`). Omitted when absent
    // so a no-`colorValue` point is byte-identical to the pre-feature shape;
    // `resolveSeriesStroke` resolves the 3-state precedence into the series'
    // (whole-series) stroke. `null` ⇒ "no colour this bar" (skips that bar's
    // stroke-colour vote).
    readonly colorValue?: string | null;
    // Presentation `z` (default 0) + the global declaration `seq` the z-sort
    // pass orders the SERIES mark by. A series mark uses its LAST point's
    // `z`/`seq` (last-write-wins, like its stroke), matching canvas2d.
    readonly z: number;
    readonly seq: number;
};

type PanedHLine = {
    readonly price: number;
    readonly color: string;
    readonly lineWidth: number;
    readonly lineStyle: LineStyle;
    readonly paneKey: string;
    // Presentation `z` (default 0) + the global declaration `seq` the z-sort
    // pass orders this hline mark by.
    readonly z: number;
    readonly seq: number;
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
    // Per-bar `candle-override` palettes (Pine `plotcandle`), keyed by bar
    // TIME (last-write-wins). The bull/bear/doji colour is direction-resolved
    // per candle AT PAINT (`resolveCandleOverrideColor`) and threaded into the
    // candle tint (body + wick), overriding the bull/bear default.
    readonly candleOverrides: Map<number, CandleOverridePalette>;
    // Per-bar `bar-override` colours (Pine `plotbar`), keyed by bar TIME. A
    // single colour threaded into the candle tint for the matching bar.
    readonly barOverrides: Map<number, string>;
    // Buffered `horizontal-histogram` profiles (Pine volume profile), keyed
    // `${slotId}@${time}` (multiple profiles may coexist), each painted in the
    // overlay draw hook anchored at the right edge by price.
    readonly horizontalHistograms: Map<string, HorizontalHistogramBuckets>;
    // Drawings, painted in the draw hook via the shared geometry layer.
    readonly drawings: Map<string, DrawingEmission>;
    // Global declaration-order counter, bumped once per ingested sortable mark
    // (plot / hline / glyph / h-histogram / drawing). The z-sort pass breaks
    // `z`/`band` ties on this so the paint order stays total + deterministic,
    // never relying on Map iteration once `z` is in play (mirrors canvas2d).
    seq: number;
    // Declaration sequence for each glyph overlay (keyed `${slotId}@${time}`),
    // horizontal-histogram profile (keyed `${slotId}@${time}`), and drawing
    // (keyed `handleId`). The raw emissions in `overlays` /
    // `horizontalHistograms` / `drawings` carry `z` but not `seq`, so the
    // sequence lives beside them, written in lockstep (last-write-wins).
    readonly overlaySeq: Map<string, number>;
    readonly hhistSeq: Map<string, number>;
    readonly drawingSeq: Map<string, number>;
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
            // Plain `line` plots render as a smooth spline (uPlot's native
            // spline path builder) so an MA line reads as a curve rather than a
            // faceted polyline; step/bars/band keep uPlot's default builders.
            series: [
                {},
                ...opts.series.map((s) => {
                    const spline = s.paths === "line" ? uPlot.paths.spline?.() : undefined;
                    return {
                        label: s.label,
                        stroke: s.stroke,
                        ...(spline ? { paths: spline } : {}),
                    };
                }),
            ],
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
            // Native bands fill the region between a `filled-band` slot's
            // upper + lower edge series (two adjacent rows). uPlot indexes
            // `series` from 0 (the x row), so the adapter's spec indices
            // already account for the leading `{}` x series.
            ...(opts.bands && opts.bands.length > 0
                ? {
                      bands: opts.bands.map((b) => ({
                          series: [b.series[0], b.series[1]] as [number, number],
                          fill: b.fill,
                      })),
                  }
                : {}),
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
// `filled-band` is handled by `buildPaneSeries` directly (a two-edge native
// band), so it never reaches here; override / candle-state kinds don't become
// series at all (they paint in the draw hook), so they are excluded too.
function pathsFor(style: PlotStyle): UplotSeriesSpec["paths"] {
    if (style.kind === "step-line") return "step";
    if (style.kind === "histogram") return "bars";
    return "line";
}

// `area` is the only series kind that carries a uPlot `fill` here —
// `filled-band` is rendered as a native band by `buildPaneSeries`, not a
// single filled series, so it never reaches this helper.
function fillFor(style: PlotStyle, color: string): string | undefined {
    if (style.kind === "area") return color;
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

// Resolve one point's PAINT colour via the 3-state `colorValue` precedence
// (the canvas2d `resolvePaintColor` contract): `colorValue` omitted ⇒ the
// static per-point `color`; present ⇒ it OVERRIDES `color`; `null` ⇒ `null`
// (no colour this bar). Returns `null` for the suppress case so the
// whole-series stroke vote can skip it.
function resolvePointColor(point: PlotPoint): string | null {
    if (point.colorValue === undefined) return point.color;
    return point.colorValue;
}

// The series' (whole-series) stroke colour: the LAST per-point colour the
// 3-state `colorValue` precedence resolves to a real colour, falling back to
// `DEFAULT_LINE_COLOR`. Mirrors the echarts / konva `seriesColor` helper plus
// the canvas2d line-family `colorValue` contract — a present `colorValue`
// OVERRIDES the static per-point colour, a `null` `colorValue` skips that
// bar's vote (the per-bar GAP is already governed by the `value:null` aligned-
// data gap), and an omitted `colorValue` is byte-identical to the pre-feature
// `seriesColor`. uPlot paints each series from one `stroke`, so per-bar recolor
// folds into a whole-series decision here (the documented uplot structural
// bound — see CLAUDE.md); a synthetic emission carrying `colorValue` is still
// wire-honest (the override is visible). The last real colour wins so a
// crossover script's final colour reads on the line.
function seriesColor(points: ReadonlyArray<PlotPoint>, fallback: string): string {
    for (let i = points.length - 1; i >= 0; i--) {
        const color = resolvePointColor(points[i]);
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
// The single per-candle tint for a bar (body + wick), or `undefined` for the
// bull/bear default. Precedence (highest first): `candle-override`
// (direction-resolved), then `bar-override`, then `barcolor` — candle/bar
// overrides paint ON TOP of the candle in canvas2d, so they win over the
// `barcolor` tint that paints with it.
function resolveCandleTint(state: AdapterState, bar: Bar): string | undefined {
    const candleOverride = state.candleOverrides.get(bar.time);
    if (candleOverride !== undefined) return resolveCandleOverrideColor(bar, candleOverride);
    const barOverride = state.barOverrides.get(bar.time);
    if (barOverride !== undefined) return barOverride;
    return state.barColors.get(bar.time);
}

function projectCandles(
    bars: ReadonlyArray<Bar>,
    viewport: Viewport,
    dx: number,
    dy: number,
    state: AdapterState,
): ProjectedCandle[] {
    return bars.map((bar) => {
        // Resolve the single per-candle tint for this bar (body + wick),
        // omitted ⇒ no `color` key (byte-identical to the bull/bear default).
        // Precedence mirrors canvas2d, where the bar/candle overrides paint
        // ON TOP of the candle and `barcolor` paints with it: `candle-override`
        // (direction-resolved) wins, then `bar-override`, then `barcolor`.
        const color = resolveCandleTint(state, bar);
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

// Paint ONE `horizontal-histogram` profile (Pine volume profile) into the
// overlay draw hook: each bucket is a right-anchored bar whose width scales by
// `volume / maxVolume` up to `HORIZONTAL_HISTOGRAM_MAX_WIDTH_PX`, at the bucket
// price's pixel y (`u.valToPos`, already device-px and bbox-offset). Mirrors the
// canvas2d reference's `drawHorizontalHistogram` intent; uPlot owns the y scale,
// so the price→y comes from the instance's projection. A profile whose buckets
// are all zero-volume contributes nothing. The per-profile painter the z-sort
// pass dispatches to (folded into the glyph band, after the candles).
function paintHorizontalHistogram(
    buckets: HorizontalHistogramBuckets,
    u: UplotLike,
    dx: number,
    viewport: Viewport,
    ctx: RenderCtx,
): void {
    const rightEdge = dx + viewport.pxWidth;
    let maxVolume = 0;
    for (const bucket of buckets) {
        if (bucket.volume > maxVolume) maxVolume = bucket.volume;
    }
    if (maxVolume <= 0) return;
    for (const bucket of buckets) {
        const y = u.valToPos(bucket.price, "y", true);
        if (!Number.isFinite(y)) continue;
        const width = (bucket.volume / maxVolume) * HORIZONTAL_HISTOGRAM_MAX_WIDTH_PX;
        ctx.fillStyle = bucket.color ?? HORIZONTAL_HISTOGRAM_COLOR;
        ctx.fillRect(
            rightEdge - width,
            y - HORIZONTAL_HISTOGRAM_ROW_HEIGHT_PX / 2,
            width,
            HORIZONTAL_HISTOGRAM_ROW_HEIGHT_PX,
        );
    }
}

// A buffered overlay is a paintable GLYPH iff its style is one of the five
// shifted-series glyph kinds (shape / character / arrow / marker / label). The
// substrate overlays (bg-color / bar-color / candle-/bar-override) and the
// horizontal-histogram profile are kept in `state.overlays` for the "all plot
// kinds" claim but paint through their own dedicated maps, so they are excluded
// here.
function isGlyphOverlay(plot: PlotEmission): boolean {
    return (
        plot.style.kind === "shape" ||
        plot.style.kind === "character" ||
        plot.style.kind === "arrow" ||
        plot.style.kind === "marker" ||
        plot.style.kind === "label"
    );
}

// Paint ONE buffered glyph (shape / character / arrow / marker / label) in the
// overlay draw hook via the SHARED adapter-kit glyph geometry (`drawShape` /
// `drawCharacter` / `drawArrow` / `drawMarker` / `drawLabel`), consuming the one
// promoted source instead of re-deriving the geometry (the bug class the
// `shift.ts` / `renderOrder.ts` promotions exist to kill). The glyph anchors at
// its plot's SHIFTED x (`timeToX(shiftedBarTime(...))` — the same xShift funnel
// the series use — folded with the `dx` plotting-area offset) and `value` → y
// (`priceToY` + `dy`); a non-finite `value` is a per-glyph skip (no ctx calls,
// so the band-free hash stays byte-identical). The per-glyph painter the z-sort
// pass dispatches to.
function paintGlyphMark(
    state: AdapterState,
    plot: PlotEmission,
    viewport: Viewport,
    dx: number,
    dy: number,
    spacing: number,
    ctx: RenderCtx,
): void {
    if (plot.value === null || !Number.isFinite(plot.value)) return;
    const x =
        timeToX(
            shiftedBarTime({ bars: state.bars, bar: plot.bar, xShift: plot.xShift, spacing }),
            viewport,
        ) + dx;
    const y = priceToY(plot.value, viewport) + dy;
    paintGlyph(plot, x, y, ctx);
}

// Dispatch one glyph emission to its shared renderer. `plot.color` (the
// top-level emission colour) is the glyph colour; a `null` falls back to
// `GLYPH_DEFAULT_COLOR` inside the helper.
function paintGlyph(plot: PlotEmission, x: number, y: number, ctx: RenderCtx): void {
    switch (plot.style.kind) {
        case "shape":
            drawShape(
                ctx,
                {
                    x,
                    y,
                    shape: plot.style.shape,
                    size: plot.style.size,
                    ...(plot.style.location === undefined ? {} : { location: plot.style.location }),
                    color: plot.color,
                },
                GLYPH_DEFAULT_COLOR,
            );
            return;
        case "character":
            drawCharacter(
                ctx,
                {
                    x,
                    y,
                    char: plot.style.char,
                    size: plot.style.size,
                    ...(plot.style.location === undefined ? {} : { location: plot.style.location }),
                    color: plot.color,
                },
                GLYPH_DEFAULT_COLOR,
            );
            return;
        case "arrow":
            drawArrow(
                ctx,
                { x, y, direction: plot.style.direction, size: plot.style.size, color: plot.color },
                GLYPH_DEFAULT_COLOR,
            );
            return;
        case "marker":
            drawMarker(
                ctx,
                { x, y, shape: plot.style.shape, size: plot.style.size, color: plot.color },
                GLYPH_DEFAULT_COLOR,
            );
            return;
        case "label":
            drawLabel(
                ctx,
                { x, y, text: plot.style.text, position: plot.style.position, color: plot.color },
                GLYPH_DEFAULT_COLOR,
            );
            return;
        // No default: `paintGlyphs` only forwards the shape / character /
        // arrow / marker / label subset (`isGlyphOverlay`), so no other
        // `plot.style.kind` reaches here.
    }
}

// Paint ONE horizontal line into the pane's draw hook. uPlot owns the y scale,
// so the pixel y comes from the instance's `valToPos` (canvas/device pixels —
// already offset by `bbox.top`); a non-finite y (scale not yet ranged) skips it.
// The line spans the real plotting area (`dx → dx + pxWidth`) and resets to
// solid 1px after so a later mark is not contaminated by its width / dash.
function paintHLineMark(
    hline: PanedHLine,
    u: UplotLike,
    dx: number,
    viewport: Viewport,
    ctx: RenderCtx,
): void {
    const y = u.valToPos(hline.price, "y", true);
    if (!Number.isFinite(y)) return;
    ctx.strokeStyle = hline.color;
    ctx.lineWidth = hline.lineWidth;
    ctx.setLineDash(dashPattern(hline.lineStyle));
    ctx.beginPath();
    ctx.moveTo(dx, y);
    ctx.lineTo(dx + viewport.pxWidth, y);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
}

// Paint ONE buffered drawing into the pane's draw hook via the shared
// adapter-kit geometry layer: `decomposeDrawing(state, view)` →
// `paintPrimitive(ctx, prim)`. The plotting-area offset is applied via a ctx
// translate bracketing THIS drawing's prims (one save/translate/restore per
// drawing — the z-sort can interleave a glyph / hline between two drawings, so a
// single shared bracket would be wrong). `op: "remove"` drawings are dropped at
// ingest by `applyDrawing`, so `state.drawings` only ever holds live drawings.
// Drawings decompose against THIS pane's scales, so a sub-pane drawing projects
// against the sub-pane's price range.
function paintDrawingMark(
    drawing: DrawingEmission,
    view: Viewport,
    dx: number,
    dy: number,
    ctx: RenderCtx,
): void {
    ctx.save();
    ctx.translate(dx, dy);
    for (const prim of decomposeDrawing(drawing, view)) {
        paintPrimitive(ctx, prim);
    }
    ctx.restore();
}

// A z-sortable draw-hook mark for one pane. Native uPlot series (line / step /
// area / histogram / band) are NOT here — uPlot paints them itself, beneath the
// draw hook. The marks the hook owns (glyphs / hlines / horizontal-histograms /
// drawings) ARE fully z-sorted among themselves; their `band` reproduces the
// pre-`z` phase order (glyph + h-histogram → hline → drawing) at `z = 0`.
type PaneMark = RenderOrderKey &
    (
        | { readonly kind: "glyph"; readonly plot: PlotEmission }
        | { readonly kind: "hhist"; readonly buckets: HorizontalHistogramBuckets }
        | { readonly kind: "hline"; readonly hline: PanedHLine }
        | { readonly kind: "drawing"; readonly drawing: DrawingEmission }
    );

// Collect every z-sortable draw-hook mark for one pane, tagged with `(z, band,
// seq)`, then stable-sort by the SHARED comparator. Glyphs + horizontal-
// histograms (overlay pane only) ride the `glyph` band (they painted after the
// candles before `z`); hlines ride the `hline` band; drawings (overlay pane
// only) ride the `drawing` band. At the default `z = 0` the key reduces to
// `(band, seq)` — byte-identical to the pre-`z` paint order. Native series are
// excluded (uPlot owns them); the residual native-vs-hook bound is documented
// in CLAUDE.md.
function collectPaneMarks(state: AdapterState, paneKey: string): PaneMark[] {
    const marks: PaneMark[] = [];
    if (paneKey === "overlay") {
        for (const [overlayKey, plot] of state.overlays) {
            if (!isGlyphOverlay(plot)) continue;
            // `overlaySeq` is written in lockstep with `overlays` (`applyPlot`),
            // so the sequence is always present.
            /* v8 ignore next -- lockstep with overlays; ?? never taken */
            const seq = state.overlaySeq.get(overlayKey) ?? 0;
            marks.push({ kind: "glyph", z: plot.z ?? 0, band: RENDER_BAND.glyph, seq, plot });
        }
        for (const [hhistKey, buckets] of state.horizontalHistograms) {
            // The buffered emission carries `z` on `state.overlays` (same key);
            // read it there so a `z`-bearing volume profile sorts correctly.
            const z = state.overlays.get(hhistKey)?.z ?? 0;
            /* v8 ignore next -- lockstep with horizontalHistograms; ?? never taken */
            const seq = state.hhistSeq.get(hhistKey) ?? 0;
            marks.push({ kind: "hhist", z, band: RENDER_BAND.glyph, seq, buckets });
        }
    }
    for (const hline of state.hlines.values()) {
        if (hline.paneKey !== paneKey) continue;
        marks.push({ kind: "hline", z: hline.z, band: RENDER_BAND.hline, seq: hline.seq, hline });
    }
    // Drawings render in EVERY pane (not overlay-only): each decomposes against
    // THIS pane's own scales, so a sub-pane drawing projects into the sub-pane's
    // price range (the Task-8 behaviour — uplot paints drawings per pane).
    for (const [handleId, drawing] of state.drawings) {
        // `drawingSeq` is written in lockstep with `drawings` (`applyDrawing`),
        // so the sequence is always present.
        /* v8 ignore next -- lockstep with drawings; ?? never taken */
        const seq = state.drawingSeq.get(handleId) ?? 0;
        marks.push({ kind: "drawing", z: drawing.z ?? 0, band: RENDER_BAND.drawing, seq, drawing });
    }
    return sortByRenderOrder(marks);
}

// Paint one sortable mark by routing it to its per-kind renderer. Order — not
// per-mark drawing — is what the z-sort changed.
function paintPaneMark(
    state: AdapterState,
    mark: PaneMark,
    u: UplotLike,
    viewport: Viewport,
    dx: number,
    dy: number,
    spacing: number,
    ctx: RenderCtx,
): void {
    switch (mark.kind) {
        case "glyph":
            paintGlyphMark(state, mark.plot, viewport, dx, dy, spacing, ctx);
            return;
        case "hhist":
            paintHorizontalHistogram(mark.buckets, u, dx, viewport, ctx);
            return;
        case "hline":
            paintHLineMark(mark.hline, u, dx, viewport, ctx);
            return;
        case "drawing":
            paintDrawingMark(mark.drawing, viewport, dx, dy, ctx);
            return;
    }
}

// Paint the always-on-top alert conditions (fired only) as a compact right-side
// text panel, mirroring canvas2d's `render/alertConditions.ts` visual design at
// the uPlot plotting-area box (device px, offset by `(dx, dy)`). Painted AFTER
// the z-sorted pass (pinned on top, NOT z-sorted — canvas2d's v1 posture). An
// empty / no-fired list adds NO ctx calls, so a condition-free script keeps the
// hash byte-identical.
function paintAlertConditions(
    state: AdapterState,
    viewport: Viewport,
    dx: number,
    dy: number,
    ctx: RenderCtx,
): void {
    const fired = state.currentAlertConditions.filter((condition) => condition.fired);
    if (fired.length === 0) return;
    const x = dx + Math.max(ALERT_PANEL_X_PAD, viewport.pxWidth - ALERT_PANEL_RIGHT_INSET);
    ctx.fillStyle = OVERLAY_TEXT_COLOR;
    ctx.font = OVERLAY_FONT;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    for (let i = 0; i < fired.length; i++) {
        const condition = fired[i];
        const label = `${condition.conditionId}: ${condition.defaultMessage}`;
        ctx.fillText(label, x, dy + ALERT_PANEL_Y + i * ALERT_ROW_HEIGHT);
    }
}

// Paint the always-on-top latest-log pane (cap 5) at the bottom-left of the
// plotting area, mirroring canvas2d's `render/logPane.ts`. Device px, offset by
// `(dx, dy)`; painted after the z-sorted pass. Empty ⇒ no ctx calls.
function paintLogs(
    state: AdapterState,
    viewport: Viewport,
    dx: number,
    dy: number,
    ctx: RenderCtx,
): void {
    const visible = state.recentLogs.slice(-MAX_RECENT_LOGS);
    if (visible.length === 0) return;
    const x = dx + LOG_PANE_PADDING;
    const y =
        dy +
        Math.max(
            LOG_PANE_PADDING,
            viewport.pxHeight - LOG_PANE_PADDING - visible.length * LOG_ROW_HEIGHT,
        );
    ctx.fillStyle = OVERLAY_TEXT_COLOR;
    ctx.font = OVERLAY_FONT;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    for (let i = 0; i < visible.length; i++) {
        const log = visible[i];
        ctx.fillText(`[${log.level}] ${log.message}`, x, y + i * LOG_ROW_HEIGHT);
    }
}

// The draw-hook ctx pass for a pane, to the instance's own canvas ctx (`u.ctx`
// — a real `CanvasRenderingContext2D` in production, a `MockCanvasContext` under
// test). Order: substrate (bg-color + candles, overlay only) paints FIRST and
// is z-INDEPENDENT; then ONE z-sorted pass over the hook-owned marks (glyphs /
// h-histograms / hlines / drawings) via the shared `sortByRenderOrder`; then the
// always-on-top alert/log overlay (overlay only), also z-independent — matching
// canvas2d's substrate-below / alerts-above v1 posture.
function paintPaneOverlay(state: AdapterState, paneKey: string, u: UplotLike): void {
    if (state.bars.length === 0) return;
    // uPlot's real plotting-area viewport (device px) + its canvas offset,
    // so candles + hlines land exactly where uPlot's own series + axes do —
    // not on a hand-rolled `state.width`-sized rect that ignored the axis
    // inset and `devicePixelRatio` (the Retina mis-scale fix).
    const viewport = buildViewport(u);
    const { dx, dy } = offsetForViewport(u);
    const ctx = u.ctx;
    const spacing = medianBarSpacing(state.bars);
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
        const bodyWidth = Math.max(
            1,
            Math.min(CANDLE_BODY_WIDTH_PX, timeToX(state.bars[0].time + spacing, viewport) * 0.6),
        );
        const style: CandlePathStyle = {
            bodyWidth,
            bull: DEFAULT_BULL,
            bear: DEFAULT_BEAR,
        };
        drawCandlePaths(ctx, projectCandles(state.bars, viewport, dx, dy, state), style);
    }
    // One global z-ordered paint pass for this pane: glyphs / h-histograms /
    // hlines / drawings, stable-sorted by `(z, band, seq)`, dispatched to their
    // per-kind renderers. At the default `z = 0` the key reduces to `(band,
    // seq)` — byte-identical to the pre-`z` paint order. Native series are
    // painted by uPlot beneath this pass.
    for (const mark of collectPaneMarks(state, paneKey)) {
        paintPaneMark(state, mark, u, viewport, dx, dy, spacing, ctx);
    }
    if (paneKey === "overlay") {
        // Alert conditions + logs pin on top of the z-sorted pass (overlay
        // pane only), matching canvas2d's always-on-top v1 posture.
        paintAlertConditions(state, viewport, dx, dy, ctx);
        paintLogs(state, viewport, dx, dy, ctx);
    }
    // Drop the plotting-area clip established at the top of the hook.
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
    // The shifted column a point lands in, or `undefined` when it is clipped
    // (far-past) or falls on no existing column (defensive). Shared by the
    // single-row series path and the filled-band two-row path.
    const columnFor = (point: PlotPoint): number | undefined => {
        const t = shiftedBarTime({
            bars: state.bars,
            bar: point.bar,
            xShift: point.xShift,
            spacing,
        });
        // A far-past shift lands before the first bar — clip it (no
        // negative-time column is prepended).
        if (t < firstTime) return undefined;
        return timeToCol.get(t);
    };
    for (const [key, series] of state.plotSeries) {
        if (!key.startsWith(prefix)) continue;
        // A `filled-band` slot becomes TWO aligned rows (upper then lower) so
        // uPlot's native band fills the region between them; `null` on either
        // edge is a per-bar gap. Every other kind is one value row.
        if (state.plotSeriesStyle.get(key)?.kind === "filled-band") {
            const upperRow: Array<number | null> = xs.map(() => null);
            const lowerRow: Array<number | null> = xs.map(() => null);
            for (const point of series) {
                const col = columnFor(point);
                if (col === undefined) continue;
                const upper = point.value;
                if (upper !== null && Number.isFinite(upper)) upperRow[col] = upper;
                // `lower` is always set for a filled-band point (it carries
                // `style.lower`, a `number | null`); `!= null` folds the
                // never-`undefined` case into the gap branch.
                const lower = point.lower;
                if (lower != null && Number.isFinite(lower)) lowerRow[col] = lower;
            }
            rows.push(upperRow, lowerRow);
            continue;
        }
        const row: Array<number | null> = xs.map(() => null);
        for (const point of series) {
            if (point.value === null || !Number.isFinite(point.value)) continue;
            const col = columnFor(point);
            if (col === undefined) continue;
            row[col] = point.value;
        }
        rows.push(row);
    }
    return rows;
}

// Convert a `#rgb` / `#rrggbb` hex colour to an `rgba()` string at the given
// alpha (the band fill). A non-hex colour (a named colour, an existing rgba) is
// returned unchanged — the alpha can only be folded into a parseable hex.
function hexToRgba(color: string, alpha: number): string {
    const hex = color.startsWith("#") ? color.slice(1) : "";
    const expand =
        hex.length === 3 ? `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}` : hex;
    if (expand.length !== 6 || /[^0-9a-fA-F]/.test(expand)) return color;
    const r = Number.parseInt(expand.slice(0, 2), 16);
    const g = Number.parseInt(expand.slice(2, 4), 16);
    const b = Number.parseInt(expand.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Build the per-series specs (and any native bands) for a pane, in stable key
// order. A `filled-band` slot becomes TWO adjacent specs (upper edge carrying
// the band `fill`, lower edge a plain stroke) plus a `UplotBandSpec` linking
// their uPlot series indices — uPlot series index `i` is spec `i - 1` (the
// leading `{}` x series is index 0). Every other kind is one spec, no band.
function buildPaneSeries(
    state: AdapterState,
    paneKey: string,
): { series: UplotSeriesSpec[]; bands: UplotBandSpec[] } {
    const specs: UplotSeriesSpec[] = [];
    const bands: UplotBandSpec[] = [];
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
        const label = key.slice(prefix.length);
        if (resolved.kind === "filled-band") {
            // The upper edge owns the band fill (the stroke colour at the
            // band's alpha); the lower edge is a matching-stroke plain edge.
            // uPlot series indices are 1-based after the x series, so the next
            // two specs are series `specs.length + 1` (upper) + `+ 2` (lower).
            const upperIdx = specs.length + 1;
            specs.push({ label: `${label}:upper`, scale: "y", stroke, paths: "band" });
            specs.push({ label: `${label}:lower`, scale: "y", stroke, paths: "band" });
            bands.push({
                series: [upperIdx, upperIdx + 1],
                fill: hexToRgba(stroke, resolved.alpha),
            });
            continue;
        }
        const fill = fillFor(resolved, stroke);
        specs.push({
            label,
            scale: "y",
            stroke,
            ...(fill === undefined ? {} : { fill }),
            paths: pathsFor(resolved),
        });
    }
    return { series: specs, bands };
}

function buildPaneOptions(state: AdapterState, paneKey: string): UplotOptions {
    const { series, bands } = buildPaneSeries(state, paneKey);
    return {
        width: state.width,
        height: state.height,
        paneKey,
        series,
        ...(bands.length > 0 ? { bands } : {}),
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
    const paneKey = resolvePaneKey(plot.pane, plot.slotId);
    if (paneKey !== "overlay" && !state.paneOrder.includes(paneKey)) {
        state.paneOrder.push(paneKey);
    }
    // `visible: false` KEEPS the slot listed but paints nothing and never
    // stretches the y-scale — mirroring canvas2d's "hidden but declared"
    // semantics. A hidden SERIES still registers its key + style (so
    // `buildPaneSeries` lists the spec) with no points (an all-null row, no
    // y candidate); a hidden non-series kind registers nothing painted.
    const hidden = plot.visible === false;
    // One declaration-sequence number per ingested mark (ingest order = script
    // declaration order; the runtime drains in script order). `z` defaults to
    // `0`, omitted-on-the-wire ⇒ byte-identical band+declaration order.
    const seq = state.seq++;
    const z = plot.z ?? 0;
    if (isSeriesStyle(plot.style)) {
        const key = paneSlotKey(paneKey, plot.slotId);
        const series = state.plotSeries.get(key) ?? [];
        if (!hidden) {
            series.push({
                time: plot.time,
                value: plot.value,
                color: plot.color,
                bar: plot.bar,
                // Omit a `0` / undefined shift so the unshifted column mapping
                // in `buildPaneData` stays byte-identical to the pre-offset path.
                ...(plot.xShift !== undefined && plot.xShift !== 0 ? { xShift: plot.xShift } : {}),
                // A `filled-band` carries its LOWER edge alongside `value`
                // (the upper edge) so the two-row native band can be built.
                ...(plot.style.kind === "filled-band" ? { lower: plot.style.lower } : {}),
                // Per-bar dynamic colour. Omit when absent so a no-`colorValue`
                // point is byte-identical to the pre-feature shape;
                // `seriesColor` resolves the 3-state into the whole-series stroke.
                ...(plot.colorValue === undefined ? {} : { colorValue: plot.colorValue }),
                z,
                seq,
            });
        }
        state.plotSeries.set(key, series);
        state.plotSeriesStyle.set(key, plot.style);
        return;
    }
    if (hidden) return;
    if (plot.style.kind === "horizontal-line") {
        state.hlines.set(plot.slotId, {
            price: plot.value ?? 0,
            color: plot.color ?? HLINE_COLOR,
            lineWidth: plot.style.lineWidth,
            lineStyle: plot.style.lineStyle,
            paneKey,
            z,
            seq,
        });
        return;
    }
    // `bg-color` / `bar-color` / `candle-override` / `bar-override` /
    // `horizontal-histogram` additionally project into the dedicated per-bar
    // maps the overlay draw hook paints from (resolving the `colorValue`
    // precedence at ingest where applicable). All also stay in `overlays` so
    // the "all plot kinds" claim stays honest.
    if (plot.style.kind === "bg-color") {
        applyBgColor(state, plot, plot.style.color, plot.style.transp);
    } else if (plot.style.kind === "bar-color") {
        applyBarColor(state, plot, plot.style.color);
    } else if (plot.style.kind === "candle-override") {
        state.candleOverrides.set(plot.time, {
            bull: plot.style.bull,
            bear: plot.style.bear,
            ...(plot.style.doji === undefined ? {} : { doji: plot.style.doji }),
        });
    } else if (plot.style.kind === "bar-override") {
        state.barOverrides.set(plot.time, plot.style.color);
    } else if (plot.style.kind === "horizontal-histogram") {
        const hhistKey = `${plot.slotId}@${plot.time}`;
        state.horizontalHistograms.set(hhistKey, plot.style.buckets);
        // The volume profile's declaration sequence beside the emission (which
        // carries `z` in `overlays`), so the z-sort pass orders it.
        state.hhistSeq.set(hhistKey, seq);
    }
    // Glyph / label kinds (shape, marker, character, arrow, label) are
    // buffered per slot+bar; the "all plot kinds" claim stays honest
    // (declared in Capabilities, retained here) rather than silently
    // dropping the emission. They paint via the shared glyph geometry in the
    // z-sorted draw-hook pass (`collectPaneMarks`). Substrate overlays
    // (bg-color / bar overrides) land here harmlessly — the z-sort only reads
    // the glyph subset's `overlaySeq`.
    const overlayKey = `${plot.slotId}@${plot.time}`;
    state.overlays.set(overlayKey, plot);
    state.overlaySeq.set(overlayKey, seq);
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
        state.drawingSeq.delete(drawing.handleId);
        return;
    }
    state.drawings.set(drawing.handleId, drawing);
    // Declaration sequence beside the emission (which carries `z`).
    // Last-write-wins per handle, matching the drawing's own dedup.
    state.drawingSeq.set(drawing.handleId, state.seq++);
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
        candleOverrides: new Map(),
        barOverrides: new Map(),
        horizontalHistograms: new Map(),
        drawings: new Map(),
        seq: 0,
        overlaySeq: new Map(),
        hhistSeq: new Map(),
        drawingSeq: new Map(),
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
            state.candleOverrides.clear();
            state.barOverrides.clear();
            state.horizontalHistograms.clear();
            state.drawings.clear();
            state.seq = 0;
            state.overlaySeq.clear();
            state.hhistSeq.clear();
            state.drawingSeq.clear();
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
