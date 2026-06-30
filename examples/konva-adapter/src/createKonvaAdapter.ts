// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import {
    type Adapter,
    type AlertConditionEmission,
    type CandleEvent,
    type Capabilities,
    type DrawingEmission,
    type InteractionHandlers,
    type LogEmission,
    type PlotEmission,
    type PlotStyle,
    RENDER_BAND,
    type RunnerEmissions,
    type ViewController,
    type Viewport,
    type WindowYInput,
    type XWindow,
    attachInteraction,
    createViewController,
    decomposeDrawing,
    defineAdapter,
    maxShiftedTime,
    medianBarSpacing,
    priceToY,
    projectShiftedX,
    sortByRenderOrder,
    timeToX,
    validateEmission,
    yRangeInWindow,
} from "@invinite-org/chartlang-adapter-kit";
import type { Bar } from "@invinite-org/chartlang-core";
import {
    type ScriptHost,
    type WorkerLike,
    createWorkerHost,
} from "@invinite-org/chartlang-host-worker";

import { formatTick, niceTicks, tickStep } from "./axis.js";
import { KONVA_CAPABILITIES, KONVA_SYM_INFO } from "./capabilities.js";
import { DEFAULT_PALETTE, type KonvaPalette } from "./palette.js";
import { type PaneLayoutEntry, computePaneLayout } from "./paneLayout.js";
import {
    type ShapeGlyph,
    primitiveToNode,
    resolvePaintColor,
    shapeGlyphNodes,
    withAlpha,
} from "./primitiveToNode.js";
import type { KonvaGroup, KonvaLayer, KonvaNamespace, KonvaNode, KonvaStage } from "./types.js";

const DEFAULT_INTERVAL = "1D";
const Y_AXIS_PADDING = 0.05;
// Right-edge gutter reserved on every pane, matching the canvas2d reference
// adapter's `Y_AXIS_GUTTER_PX` so konva's candle x-extent (and therefore its
// scale) lines up with canvas2d. Konva paints no axis labels into it — this
// is scale parity, not a label reservation.
const Y_AXIS_GUTTER_PX = 52;
// Price-axis labels: ~5 nice ticks, an 11px sans label sitting 6px into the
// right gutter `Y_AXIS_GUTTER_PX` reserves.
const AXIS_TICK_COUNT = 5;
const AXIS_LABEL_FONT_SIZE = 11;
const AXIS_LABEL_GAP_PX = 6;
const BODY_WIDTH_RATIO = 0.6;
// Candle bodies never collapse below this width, so a densely-packed (or
// initially-framed) view still shows a visible body per bar.
const MIN_BODY_WIDTH_PX = 1;
const HISTOGRAM_BAR_WIDTH_PX = 4;
const GLYPH_FONT_FAMILY = "sans-serif";
const GLYPH_LABEL_FONT_SIZE = 11;
const HORIZONTAL_HISTOGRAM_MAX_WIDTH_PX = 96;
const HORIZONTAL_HISTOGRAM_ROW_HEIGHT_PX = 6;
// `shape` plots offset their glyph above / below the plot value by
// `size * GLYPH_LOCATION_OFFSET_RATIO`, matching the canvas2d reference
// (`render/shape.ts`'s `OFFSET_RATIO`). `absolute` pins it at the value.
const GLYPH_LOCATION_OFFSET_RATIO = 1.25;

// Always-on-top alert-condition strip (top-right) + log pane (bottom-left),
// mirroring the canvas2d reference's `render/alertConditions.ts` +
// `render/logPane.ts` layout constants in the konva node model.
const TAIL_FONT_SIZE = 11;
const ALERT_CONDITION_PANEL_X_PAD = 12;
const ALERT_CONDITION_PANEL_Y = 18;
const ALERT_CONDITION_ROW_HEIGHT = 14;
const ALERT_CONDITION_STRIP_WIDTH = 180;
const LOG_PANE_PADDING = 8;
const LOG_PANE_ROW_HEIGHT = 13;
// Latest-N logs shown in the bottom-left pane (matches canvas2d's
// `MAX_VISIBLE_LOGS`); the buffer is capped at the same count at ingest.
const MAX_VISIBLE_LOGS = 5;

// Resolve a `shape` glyph's anchored y from its plot location: `above`
// lifts it, `below` drops it, `absolute` (the default) pins it.
function anchoredGlyphY(
    y: number,
    size: number,
    location: "above" | "below" | "absolute" | undefined,
): number {
    if (location === "above") return y - size * GLYPH_LOCATION_OFFSET_RATIO;
    if (location === "below") return y + size * GLYPH_LOCATION_OFFSET_RATIO;
    return y;
}

// A plot value is renderable when it is a finite number — a `null` "skip
// this bar" gap or a non-finite value is not drawn.
function isFiniteValue(value: number | null): value is number {
    return value !== null && Number.isFinite(value);
}

/**
 * Constructor options for {@link createKonvaAdapter}. `konva` is the
 * injected Konva namespace — the factory never statically imports
 * `konva` (that pulls the native `canvas` dependency and breaks the
 * headless portability target), so production callers pass the real
 * `Konva` and tests pass {@link import("./testing").MockKonva}. This
 * mirrors the canvas2d reference adapter's `opts.ctx` "caller provides
 * the surface" seam. `host` / `workerLike` are test seams identical to
 * canvas2d's.
 *
 * @since 1.4
 * @stable
 * @example
 *     import Konva from "konva";
 *     import { createKonvaAdapter } from "chartlang-example-konva-adapter";
 *     declare const candleSource: AsyncIterable<CandleEvent>;
 *     const adapter = createKonvaAdapter({
 *         konva: Konva,
 *         stage: { width: 800, height: 400 },
 *         candleSource,
 *     });
 *     void adapter;
 */
export type CreateKonvaAdapterOpts = {
    readonly konva: KonvaNamespace;
    readonly stage: { readonly width: number; readonly height: number };
    // Production callers pass the mount element so Konva attaches the
    // stage's content `<div>` to the DOM (parallel to the canvas2d
    // adapter's `opts.ctx` "caller provides the surface" seam). Tests omit
    // it and pass `MockKonva`, whose `Stage` records the config without a
    // real DOM.
    readonly container?: HTMLElement;
    readonly candleSource: AsyncIterable<CandleEvent>;
    readonly capabilities?: Capabilities;
    readonly interval?: string;
    readonly palette?: KonvaPalette;
    readonly resolveInputs?: (scriptId: string) => Readonly<Record<string, unknown>>;
    readonly feedExternalSeries?: Adapter["feedExternalSeries"];
    /**
     * Default visible window: when set, the chart opens framed on only the
     * most recent N bars (rest stay scrollable); omit/0 = fit all data,
     * byte-identical to before.
     */
    readonly initialVisibleBars?: number;
    readonly host?: ScriptHost;
    readonly workerLike?: WorkerLike;
};

/**
 * Public handle the consumer drives. `host` is exposed so callers can
 * `await adapter.host.load(compiled)` before pushing candle events; the
 * adapter renders inline from its `onEmissions` callback (each drain
 * rebuilds the series layer and `batchDraw`s, matching the canvas2d
 * reference adapter's stateless redraw).
 *
 * @since 1.4
 * @stable
 * @example
 *     declare const adapter: KonvaAdapterHandle;
 *     // await adapter.host.load(compiled);
 *     void adapter;
 */
export type KonvaAdapterHandle = Adapter & { readonly host: ScriptHost };

// One accumulated plot-series point keyed by `${pane}|${slotId}`. `band`
// is set only for `filled-band` series — it carries the per-bar upper /
// lower bounds + fill alpha the band shape reads (a `null` bound marks a
// per-bar gap).
type SeriesPoint = {
    readonly time: number;
    readonly value: number | null;
    readonly color: string | null;
    readonly bar: number;
    // Presentation `z` (default 0) + global declaration `seq` (ingest
    // order = script order), assigned in `applyPlot`. The series mark uses
    // its LAST point's `z`/`seq` (last-write-wins, like its style) in the
    // z-sort pass.
    readonly z: number;
    readonly seq: number;
    // The universal `ta` `offset` (signed integer bars; `+n` right/future,
    // `−n` left/past). Stored ONLY when non-zero (mirroring canvas2d), so a
    // no-offset point's projected x is byte-identical to the pre-feature
    // `timeToX(point.time)`.
    readonly xShift?: number;
    // The per-bar dynamic-color channel for line / step-line / area /
    // histogram (the normative `PlotEmission.colorValue` 3-state). Stored
    // ONLY when present on the wire (conditional-spread in `applyPlot`), so a
    // no-`colorValue` point is byte-identical to the pre-feature shape and
    // every existing golden / pinned hash holds. `null` ⇒ paint-nothing gap;
    // a string ⇒ overrides the static color for this bar's segment.
    readonly colorValue?: string | null;
    readonly band?: {
        readonly upper: number | null;
        readonly lower: number | null;
        readonly alpha: number;
    };
};

// Horizontal line keyed by slot id (last-write-wins), carrying its pane
// plus its presentation `z` / declaration `seq` for the z-sort pass.
type PanedHLine = {
    readonly price: number;
    readonly color: string | null;
    readonly paneKey: string;
    readonly z: number;
    readonly seq: number;
};

// One sortable mark collected for a pane's single z-ordered paint pass.
// The tagged union routes each mark to its existing per-kind builder after
// the stable sort. `z` is the presentation layer key (default 0), `band`
// the default phase (`RENDER_BAND.*`), `seq` the global declaration-order
// tiebreak — the structural key the shared `sortByRenderOrder` reads.
type SortableMark =
    | {
          readonly kind: "series";
          readonly z: number;
          readonly band: number;
          readonly seq: number;
          readonly entry: { style: PlotStyle; points: SeriesPoint[] };
      }
    | {
          readonly kind: "glyph";
          readonly z: number;
          readonly band: number;
          readonly seq: number;
          readonly plot: PlotEmission;
      }
    | {
          readonly kind: "hline";
          readonly z: number;
          readonly band: number;
          readonly seq: number;
          readonly hline: PanedHLine;
      }
    | {
          readonly kind: "drawing";
          readonly z: number;
          readonly band: number;
          readonly seq: number;
          readonly drawing: DrawingEmission;
      };

type AdapterState = {
    readonly konva: KonvaNamespace;
    readonly stage: KonvaStage;
    // Plots, glyphs, hlines AND drawings paint into ONE layer's per-pane
    // groups so the z-sort can interleave them (a `z:-1` drawing below a
    // `z:0` plot, a `z:1` plot above a drawing) — Konva layers paint in a
    // fixed stage order, so a separate drawings layer could not interleave.
    readonly seriesLayer: KonvaLayer;
    // Price-axis labels painted into each pane's right gutter, rebuilt every
    // drain on its own top layer (`rebuildAxisLayer`).
    readonly axisLayer: KonvaLayer;
    readonly stageSize: { readonly width: number; readonly height: number };
    readonly bars: Bar[];
    // `bar.time → bar` index kept in sync with `bars` in `applyCandleEvent`,
    // so per-override bar lookups in `buildOverlay` (candle-/bar-override /
    // bar-color) are O(1) instead of an O(bars) `find` per drain.
    readonly barsByTime: Map<number, Bar>;
    // Distinct pane keys in first-emit order; `"overlay"` is always index 0.
    paneOrder: string[];
    // One entry per `${pane}|${slotId}` series, holding its accumulated
    // points AND its (last-write-wins) style together so the style is never
    // separately absent.
    readonly plotSeries: Map<string, { style: PlotStyle; points: SeriesPoint[] }>;
    // Glyph / per-bar overlays keyed by `${slotId}@${time}` so a callsite
    // that emits on many bars accumulates one overlay per bar.
    readonly plotOverlays: Map<string, PlotEmission>;
    readonly hlines: Map<string, PanedHLine>;
    // Live drawing emissions keyed by `handleId` (last-write-wins;
    // `op:"remove"` drops the key in `applyDrawing`). Rendered every drain
    // in the overlay pane's z-sorted pass through the shared
    // `decomposeDrawing` IR + `primitiveToNode`.
    readonly drawings: Map<string, DrawingEmission>;
    // Fired alert conditions for the CURRENT drain, rebuilt each drain
    // (cleared then re-pushed in `ingest`) — the always-on-top condition
    // strip reads them. Latest runtime logs, capped at `MAX_VISIBLE_LOGS`,
    // for the always-on-top bottom-left log pane. Both mirror canvas2d's
    // `currentAlertConditions` / `recentLogs`.
    readonly currentAlertConditions: AlertConditionEmission[];
    readonly recentLogs: LogEmission[];
    // Global monotonic declaration sequence (ingest order = script order)
    // assigned at every ingested mark; the z-sort tiebreak. `overlaySeq` /
    // `drawingSeq` carry the `seq` for the stores that hold the raw
    // emission (which has no `seq` field), written in lockstep.
    seq: number;
    readonly overlaySeq: Map<string, number>;
    readonly drawingSeq: Map<string, number>;
    readonly palette: KonvaPalette;
    // Pan/zoom controller (adapter-kit); see the canvas2d adapter for the
    // identical wiring. `resolveXWindow` picks the per-frame x window;
    // `lastOverlayViewport` feeds the DOM handlers' pixel↔world mapping;
    // `detachInteraction` removes the listeners on dispose.
    readonly view: ViewController;
    // Default visible-window size (most-recent bars shown on load); undefined
    // ⇒ fit all data. Resolved into `autoFollowXMin` each frame.
    readonly initialVisibleBars?: number;
    lastOverlayViewport?: Viewport;
    detachInteraction?: () => void;
};

const HANDLE_STATE: WeakMap<KonvaAdapterHandle, AdapterState> = new WeakMap();
const HANDLE_INTERVAL: WeakMap<KonvaAdapterHandle, string> = new WeakMap();

function paneSlotKey(paneKey: string, slotId: string): string {
    return `${paneKey}|${slotId}`;
}

function paneKeyPrefix(paneKey: string): string {
    return `${paneKey}|`;
}

// Map a `LineStyle` to Konva's `dash` segment array. Solid omits `dash`
// entirely (Konva treats `undefined`/`[]` as solid); dashed / dotted use
// the same patterns the canvas2d renderer uses.
function dashFor(lineStyle: "solid" | "dashed" | "dotted"): ReadonlyArray<number> | undefined {
    if (lineStyle === "dashed") return [6, 4];
    if (lineStyle === "dotted") return [2, 3];
    return undefined;
}

// Collect the y-range a single pane should span, auto-fit to the VISIBLE x
// window (so a zoomed-in view re-scales the price axis to what's on screen,
// matching lightweight-charts). The overlay pane sees bars ∪ overlay-keyed
// series; a subpane sees only its own series (so an RSI band in 0-100 never
// stretches the price scale). Horizontal lines span the whole chart, so they
// fold in unconditionally (not x-window filtered). Returns ±Infinity when no
// finite candidate was observed — the caller maps that to the (0, 1) fallback.
function computeYRange(
    state: AdapterState,
    paneKey: string,
    win: XWindow,
): { yMin: number; yMax: number } {
    const candidates: WindowYInput[] = [];
    if (paneKey === "overlay") {
        for (const bar of state.bars) {
            candidates.push({ x: bar.time, lo: bar.low, hi: bar.high });
        }
    }
    const prefix = paneKeyPrefix(paneKey);
    for (const [key, entry] of state.plotSeries) {
        if (!key.startsWith(prefix)) continue;
        for (const point of entry.points) {
            if (point.value !== null) {
                candidates.push({ x: point.time, lo: point.value, hi: point.value });
            }
        }
    }
    const windowed = yRangeInWindow(candidates, win);
    let yMin = windowed?.yMin ?? Number.POSITIVE_INFINITY;
    let yMax = windowed?.yMax ?? Number.NEGATIVE_INFINITY;
    for (const hline of state.hlines.values()) {
        if (hline.paneKey === paneKey && Number.isFinite(hline.price)) {
            if (hline.price < yMin) yMin = hline.price;
            if (hline.price > yMax) yMax = hline.price;
        }
    }
    return { yMin, yMax };
}

// Widen `xMax` so any future-projected (`+k`) point in this pane stays on
// screen instead of being clipped past the data edge. Walks the pane's
// shifted series points and — for the overlay pane — the shifted glyph
// overlays (shape / character / arrow / label), folding each through the
// shared `maxShiftedTime`. Candle-state overrides (bg-color / bar-color /
// candle-/bar-override / horizontal-histogram) keep their own bar anchor
// and never widen the viewport, matching canvas2d. No-shift frames leave
// `xMax` untouched.
function extendXMaxForShifts(
    state: AdapterState,
    paneKey: string,
    spacing: number,
    xMax: number,
): number {
    const { bars } = state;
    let extended = xMax;
    const prefix = paneKeyPrefix(paneKey);
    for (const [key, entry] of state.plotSeries) {
        if (!key.startsWith(prefix)) continue;
        const finite = entry.points.filter(
            (point) => point.value !== null && Number.isFinite(point.value),
        );
        extended = maxShiftedTime(finite, bars, spacing, extended);
    }
    if (paneKey === "overlay") {
        const glyphs: { bar: number; xShift?: number }[] = [];
        for (const plot of state.plotOverlays.values()) {
            if (!isFiniteValue(plot.value)) continue;
            // Only shifted-series glyphs honour `xShift`; candle-state
            // overrides keep their own anchor and must not widen the edge.
            if (
                plot.style.kind !== "shape" &&
                plot.style.kind !== "marker" &&
                plot.style.kind !== "character" &&
                plot.style.kind !== "arrow" &&
                plot.style.kind !== "label"
            ) {
                continue;
            }
            glyphs.push(
                plot.xShift === undefined
                    ? { bar: plot.bar }
                    : { bar: plot.bar, xShift: plot.xShift },
            );
        }
        extended = maxShiftedTime(glyphs, bars, spacing, extended);
    }
    return extended;
}

function computePaneViewport(
    state: AdapterState,
    entry: PaneLayoutEntry,
    spacing: number,
): Viewport {
    const { bars } = state;
    const { rect, paneKey } = entry;
    // Reserve the right gutter so konva's candle x-extent matches canvas2d.
    const plotWidth = Math.max(1, rect.w - Y_AXIS_GUTTER_PX);
    if (bars.length === 0) {
        return { xMin: 0, xMax: 1, yMin: 0, yMax: 1, pxWidth: plotWidth, pxHeight: rect.h };
    }
    let dataXMin = Number.POSITIVE_INFINITY;
    let dataXMax = Number.NEGATIVE_INFINITY;
    for (const bar of bars) {
        if (bar.time < dataXMin) dataXMin = bar.time;
        if (bar.time > dataXMax) dataXMax = bar.time;
    }
    // Widen `xMax` for any `+k` future-shifted series point in this pane so it
    // stays on-screen rather than clipped past the data edge (mirroring
    // canvas2d's `extendXMaxForShifts`). Only `xShift > 0` extends the edge;
    // no-offset frames leave `xMax` untouched, so the baseline render is
    // byte-identical.
    dataXMax = extendXMaxForShifts(state, paneKey, spacing, dataXMax);
    // Full data range until the user interacts, then the held window. When
    // `initialVisibleBars` is set, the auto-follow window starts at the Nth-
    // from-last bar so the default view frames the most recent bars (the rest
    // stay scrollable) instead of squashing the whole history into the pane.
    const n = state.initialVisibleBars;
    const autoFollowXMin =
        n !== undefined && n > 0 && bars.length > n ? bars[bars.length - n]?.time : undefined;
    const win = state.view.resolveXWindow(dataXMin, dataXMax, autoFollowXMin);
    let { yMin, yMax } = computeYRange(state, paneKey, win);
    if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) {
        yMin = 0;
        yMax = 1;
    } else if (yMin === yMax) {
        yMin -= 1;
        yMax += 1;
    }
    const yPad = (yMax - yMin) * Y_AXIS_PADDING;
    return {
        xMin: win.xMin,
        xMax: win.xMax === win.xMin ? win.xMin + 1 : win.xMax,
        yMin: yMin - yPad,
        yMax: yMax + yPad,
        pxWidth: plotWidth,
        pxHeight: rect.h,
    };
}

// ---- node builders (one per visual; each appends to the pane group) ----

function buildCandles(state: AdapterState, group: KonvaGroup, viewport: Viewport): void {
    const bodyWidth = Math.max(
        MIN_BODY_WIDTH_PX,
        (viewport.pxWidth / state.bars.length) * BODY_WIDTH_RATIO,
    );
    const half = bodyWidth / 2;
    for (const bar of state.bars) {
        const x = timeToX(bar.time, viewport);
        const highY = priceToY(bar.high, viewport);
        const lowY = priceToY(bar.low, viewport);
        const openY = priceToY(bar.open, viewport);
        const closeY = priceToY(bar.close, viewport);
        const bullish = bar.close >= bar.open;
        group.add(
            new state.konva.Line({
                points: [x, highY, x, lowY],
                stroke: state.palette.candleWick,
                strokeWidth: 1,
            }),
        );
        const top = Math.min(openY, closeY);
        const height = Math.max(1, Math.max(openY, closeY) - top);
        group.add(
            new state.konva.Rect({
                x: x - half,
                y: top,
                width: bodyWidth,
                height,
                fill: bullish ? state.palette.candleBullBody : state.palette.candleBearBody,
            }),
        );
    }
}

// One contiguous same-colour run of a line-family series: a flat
// `[x0,y0,x1,y1,…]` polyline + the resolved colour to paint it with.
type ColorRun = { points: number[]; color: string };

// Split a line-family series into consecutive same-colour RUNS, mirroring
// the canvas2d reference contract. A run breaks on a `null`/non-finite
// `value` (the existing gap), on a `null` `colorValue` (an explicit
// paint-nothing gap), AND when the resolved per-bar colour DIFFERS from the
// current run's colour. The static top-level `color` (carried into
// `staticColor`) NEVER splits a run — only an explicit `colorValue` does —
// so a no-`colorValue` series resolves to `staticColor` for every bar and
// stays exactly ONE run (byte-identical to the pre-feature render). The
// resolved colour is `resolvePaintColor(point.colorValue, staticColor,
// plotDefault)` (`null` ⇒ gap). Returns one `ColorRun` per run.
function colorRuns(
    series: ReadonlyArray<SeriesPoint>,
    staticColor: string,
    plotDefault: string,
    project: (point: SeriesPoint, value: number) => { x: number; y: number },
): ColorRun[] {
    const runs: ColorRun[] = [];
    let current: ColorRun | undefined;
    const flush = (): void => {
        if (current !== undefined && current.points.length > 0) runs.push(current);
        current = undefined;
    };
    for (const point of series) {
        if (point.value === null || !Number.isFinite(point.value)) {
            flush();
            continue;
        }
        const color = resolvePaintColor(point.colorValue, staticColor, plotDefault);
        if (color === null) {
            // Explicit `colorValue:null` ⇒ paint-nothing gap, breaks the run.
            flush();
            continue;
        }
        if (current === undefined || current.color !== color) {
            flush();
            current = { points: [], color };
        }
        const { x, y } = project(point, point.value);
        current.points.push(x, y);
    }
    flush();
    return runs;
}

function buildLineSeries(
    state: AdapterState,
    group: KonvaGroup,
    series: ReadonlyArray<SeriesPoint>,
    style: Extract<PlotStyle, { kind: "line" | "step-line" }>,
    viewport: Viewport,
    spacing: number,
): void {
    const project = (point: SeriesPoint, value: number): { x: number; y: number } => ({
        x: projectShiftedX(
            { bars: state.bars, bar: point.bar, xShift: point.xShift, spacing },
            viewport,
        ),
        y: priceToY(value, viewport),
    });
    const dash = dashFor(style.lineStyle);
    const staticColor = seriesColor(series, state.palette.plotDefault);
    // Per-bar `colorValue` splits the polyline into same-colour runs; a
    // no-`colorValue` series resolves to `staticColor` everywhere and is one
    // run, byte-identical to before.
    for (const run of colorRuns(series, staticColor, state.palette.plotDefault, project)) {
        // A single-point run (e.g. an isolated value between two gaps) is
        // not a drawable polyline — skip it.
        if (run.points.length < 4) continue;
        // step-line: insert a horizontal then vertical knee between points
        // by duplicating x of the next point at the prior y.
        const points = style.kind === "step-line" ? toStepPoints(run.points) : run.points;
        group.add(
            new state.konva.Line({
                points,
                stroke: run.color,
                strokeWidth: style.lineWidth,
                lineJoin: "round",
                lineCap: "round",
                // Plain `line` plots render as a smooth spline (Konva `tension`)
                // so an MA line reads as a curve, not a faceted polyline;
                // step-lines keep their hard knees.
                ...(style.kind === "line" ? { tension: 0.5 } : {}),
                ...(dash === undefined ? {} : { dash }),
            }),
        );
    }
}

// Convert a flat `[x0,y0,x1,y1,…]` run into a step polyline: hold each y
// until the next x, then step. Mirrors canvas2d's step-line knee. The
// caller guarantees a run of at least two points (length ≥ 4).
function toStepPoints(run: ReadonlyArray<number>): number[] {
    const out: number[] = [run[0], run[1]];
    for (let i = 2; i < run.length; i += 2) {
        const x = run[i];
        const y = run[i + 1];
        const prevY = out[out.length - 1];
        out.push(x, prevY, x, y);
    }
    return out;
}

function buildAreaSeries(
    state: AdapterState,
    group: KonvaGroup,
    series: ReadonlyArray<SeriesPoint>,
    style: Extract<PlotStyle, { kind: "area" }>,
    viewport: Viewport,
    spacing: number,
): void {
    const project = (point: SeriesPoint, value: number): { x: number; y: number } => ({
        x: projectShiftedX(
            { bars: state.bars, bar: point.bar, xShift: point.xShift, spacing },
            viewport,
        ),
        y: priceToY(value, viewport),
    });
    const baselineY = priceToY(viewport.yMin, viewport);
    const dash = dashFor(style.lineStyle);
    const staticColor = seriesColor(series, state.palette.plotDefault);
    // Per-bar `colorValue` splits the area into same-colour runs (each its
    // own closed filled shape), like the line family; a no-`colorValue`
    // series is one run, byte-identical to before.
    for (const run of colorRuns(series, staticColor, state.palette.plotDefault, project)) {
        if (run.points.length < 4) continue;
        const closed = run.points.slice();
        const lastX = run.points[run.points.length - 2];
        const firstX = run.points[0];
        closed.push(lastX, baselineY, firstX, baselineY);
        group.add(
            new state.konva.Line({
                points: closed,
                closed: true,
                // The fill carries the requested `fillAlpha` (baked into the
                // `#rrggbbaa` colour); the stroke stays fully opaque.
                fill: withAlpha(run.color, style.fillAlpha),
                stroke: run.color,
                strokeWidth: style.lineWidth,
                ...(dash === undefined ? {} : { dash }),
            }),
        );
    }
}

function buildHistogramSeries(
    state: AdapterState,
    group: KonvaGroup,
    series: ReadonlyArray<SeriesPoint>,
    style: Extract<PlotStyle, { kind: "histogram" }>,
    viewport: Viewport,
    spacing: number,
): void {
    const baselineY = priceToY(style.baseline, viewport);
    for (const point of series) {
        if (point.value === null || !Number.isFinite(point.value)) continue;
        // Each column resolves its colour independently (no run logic): the
        // per-bar `colorValue` 3-state wins over the static `point.color`;
        // a `null` colorValue ⇒ paint no column this bar. The finite value
        // still entered `computeYRange` upstream, so suppressing the paint
        // does not narrow the y-scale (colorValue orthogonal to value).
        const fill = resolvePaintColor(point.colorValue, point.color, state.palette.plotDefault);
        if (fill === null) continue;
        const x = projectShiftedX(
            { bars: state.bars, bar: point.bar, xShift: point.xShift, spacing },
            viewport,
        );
        const y = priceToY(point.value, viewport);
        const top = Math.min(baselineY, y);
        const height = Math.max(1, Math.abs(y - baselineY));
        group.add(
            new state.konva.Rect({
                x: x - HISTOGRAM_BAR_WIDTH_PX / 2,
                y: top,
                width: HISTOGRAM_BAR_WIDTH_PX,
                height,
                fill,
            }),
        );
    }
}

// `filled-band` overlays carry their `upper`/`lower` on the emission style;
// the band is rebuilt from the per-bar bounds carried on each series
// point (set by `applyPlot` for `filled-band` slots only).
function buildFilledBand(
    state: AdapterState,
    group: KonvaGroup,
    series: ReadonlyArray<SeriesPoint>,
    viewport: Viewport,
    spacing: number,
): void {
    const upper: number[] = [];
    const lowerReversed: number[] = [];
    let alpha = 1;
    let color = state.palette.plotDefault;
    for (const point of series) {
        const band = point.band;
        /* v8 ignore next -- every point in a filled-band series carries a band (set in applyPlot) */
        if (band === undefined) continue;
        alpha = band.alpha;
        color = point.color ?? color;
        const x = projectShiftedX(
            { bars: state.bars, bar: point.bar, xShift: point.xShift, spacing },
            viewport,
        );
        const { upper: u, lower: l } = band;
        // A null bound on either edge marks a per-bar gap: flush the
        // current closed shape and start a fresh one.
        if (u === null || l === null || !Number.isFinite(u) || !Number.isFinite(l)) {
            flushBand(state, group, upper, lowerReversed, color, alpha);
            upper.length = 0;
            lowerReversed.length = 0;
            continue;
        }
        upper.push(x, priceToY(u, viewport));
        lowerReversed.unshift(priceToY(l, viewport));
        lowerReversed.unshift(x);
    }
    flushBand(state, group, upper, lowerReversed, color, alpha);
}

function flushBand(
    state: AdapterState,
    group: KonvaGroup,
    upper: ReadonlyArray<number>,
    lowerReversed: ReadonlyArray<number>,
    color: string,
    alpha: number,
): void {
    if (upper.length < 4) return;
    group.add(
        new state.konva.Line({
            points: [...upper, ...lowerReversed],
            closed: true,
            fill: withAlpha(color, alpha),
            listening: false,
        }),
    );
}

function buildHLine(
    state: AdapterState,
    group: KonvaGroup,
    hline: PanedHLine,
    viewport: Viewport,
): void {
    const y = priceToY(hline.price, viewport);
    group.add(
        new state.konva.Line({
            points: [0, y, viewport.pxWidth, y],
            stroke: hline.color ?? state.palette.hlineDefault,
            strokeWidth: 1,
        }),
    );
}

// Resolve the per-bar tint colour for a candle / bar override or a
// bar-color emission. `candle-override` picks bull / bear / doji by the
// bar's direction (`close > open ? bull : close < open ? bear : doji ??
// bull`, copying canvas2d's `drawCandleOverride`). `bar-color` honours the
// dynamic `colorValue` 3-state precedence — omitted ⇒ `style.color`,
// present ⇒ override, `null` ⇒ no tint this bar (returns `null` so the
// caller paints nothing). `bar-override` keeps its static colour.
function overrideColor(
    style: Extract<PlotStyle, { kind: "candle-override" | "bar-override" | "bar-color" }>,
    bar: Bar,
    colorValue: string | null | undefined,
): string | null {
    if (style.kind === "candle-override") {
        if (bar.close > bar.open) return style.bull;
        if (bar.close < bar.open) return style.bear;
        return style.doji ?? style.bull;
    }
    if (style.kind === "bar-color") {
        return colorValue === undefined ? style.color : colorValue;
    }
    return style.color;
}

// Glyph / override / style plot kinds → the closest Konva facility. Each
// `case` documents the mapping. `marker` and `shape` render their real
// per-shape glyph geometry through the shared `shapeGlyphNodes` helper (the
// same source the `marker` drawing primitive uses); `character` renders a
// `Text`; `arrow` a `Text` arrow glyph; overrides re-tint the bar via a
// `Rect`; `bg-color` a full-pane background `Rect`; `horizontal-histogram`
// per-bucket `Rect`s.
function buildOverlay(
    state: AdapterState,
    group: KonvaGroup,
    plot: PlotEmission,
    viewport: Viewport,
    spacing: number,
): void {
    const style = plot.style;
    switch (style.kind) {
        case "shape":
        case "marker": {
            if (!isFiniteValue(plot.value)) return;
            // Glyph plots are shifted series visuals, so they project
            // through the same bar-offset funnel as line / histogram.
            const x = projectShiftedX(
                { bars: state.bars, bar: plot.bar, xShift: plot.xShift, spacing },
                viewport,
            );
            // `shape` honours its `location` anchor (above / below / absolute);
            // `marker` carries no `location`, so it always pins at the value.
            const y =
                style.kind === "shape"
                    ? anchoredGlyphY(priceToY(plot.value, viewport), style.size, style.location)
                    : priceToY(plot.value, viewport);
            const shape: ShapeGlyph = style.shape;
            const color = plot.color ?? state.palette.glyphText;
            // The five filled shapes take a `fill`; the three stroked glyphs
            // (cross / xcross / flag) take a 1px `stroke` (parity with
            // canvas2d's `drawShape`).
            const isStrokedGlyph = shape === "cross" || shape === "xcross" || shape === "flag";
            const attrs = isStrokedGlyph
                ? { stroke: { stroke: color, strokeWidth: 1 } }
                : { fill: { fill: color } };
            for (const node of shapeGlyphNodes(state.konva, {
                x,
                y,
                size: style.size,
                shape,
                ...attrs,
            })) {
                group.add(node);
            }
            return;
        }
        case "character": {
            if (!isFiniteValue(plot.value)) return;
            group.add(
                glyphText(state, style.char, plot, plot.value, style.size, viewport, spacing),
            );
            return;
        }
        case "arrow": {
            if (!isFiniteValue(plot.value)) return;
            const glyph = style.direction === "up" ? "▲" : "▼";
            group.add(glyphText(state, glyph, plot, plot.value, style.size, viewport, spacing));
            return;
        }
        case "candle-override":
        case "bar-override":
        case "bar-color": {
            // Re-tint the bar's body: one `Rect` at the bar with the
            // override colour. canvas2d paints these with the candles; the
            // Konva node tree expresses the same per-bar tint.
            const bar = state.barsByTime.get(plot.time);
            if (bar === undefined) return;
            // candle-override resolves bull / bear / doji by the bar's
            // direction (copying canvas2d's `drawCandleOverride`). bar-color
            // honours the per-bar dynamic `colorValue` 3-state, mirroring the
            // `bg-color` branch (omitted ⇒ `style.color`; present ⇒ override;
            // `null` ⇒ no tint this bar). bar-override keeps its static colour.
            const color = overrideColor(style, bar, plot.colorValue);
            if (color === null) return;
            const x = timeToX(bar.time, viewport);
            const bodyWidth = (viewport.pxWidth / state.bars.length) * BODY_WIDTH_RATIO;
            const top = priceToY(Math.max(bar.open, bar.close), viewport);
            const height = Math.max(
                1,
                Math.abs(priceToY(bar.close, viewport) - priceToY(bar.open, viewport)),
            );
            group.add(
                new state.konva.Rect({
                    x: x - bodyWidth / 2,
                    y: top,
                    width: bodyWidth,
                    height,
                    fill: color,
                }),
            );
            return;
        }
        case "bg-color": {
            // Per-bar background tint anchored at the bar's x column. The
            // dynamic per-bar `colorValue` wins over the static `style.color`
            // when present; an explicit `null` paints nothing this bar (the
            // adapter precedence contract — see canvas2d's `render/bgColor.ts`).
            const paint = plot.colorValue === undefined ? style.color : plot.colorValue;
            if (paint === null) return;
            // `transp` (0–100; 0 = opaque, 100 = fully transparent) maps to a
            // node-level `opacity` of `1 - transp/100` — the Konva idiom for
            // the canvas reference's `globalAlpha`. Omitted ⇒ opacity 1.
            const opacity = 1 - (style.transp ?? 0) / 100;
            const x = timeToX(plot.time, viewport);
            const colWidth =
                state.bars.length > 0 ? viewport.pxWidth / state.bars.length : viewport.pxWidth;
            group.add(
                new state.konva.Rect({
                    x: x - colWidth / 2,
                    y: 0,
                    width: colWidth,
                    height: viewport.pxHeight,
                    fill: paint,
                    opacity,
                    listening: false,
                }),
            );
            return;
        }
        case "horizontal-histogram": {
            const maxVolume = style.buckets.reduce((m, b) => Math.max(m, b.volume), 0);
            for (const bucket of style.buckets) {
                if (maxVolume === 0) continue;
                const w = (bucket.volume / maxVolume) * HORIZONTAL_HISTOGRAM_MAX_WIDTH_PX;
                const y = priceToY(bucket.price, viewport);
                group.add(
                    new state.konva.Rect({
                        x: 0,
                        y: y - HORIZONTAL_HISTOGRAM_ROW_HEIGHT_PX / 2,
                        width: w,
                        height: HORIZONTAL_HISTOGRAM_ROW_HEIGHT_PX,
                        fill: bucket.color ?? state.palette.plotDefault,
                    }),
                );
            }
            return;
        }
        case "label": {
            if (!isFiniteValue(plot.value)) return;
            group.add(
                glyphText(
                    state,
                    style.text,
                    plot,
                    plot.value,
                    GLYPH_LABEL_FONT_SIZE,
                    viewport,
                    spacing,
                ),
            );
            return;
        }
        // No default: only overlay-style emissions reach this builder —
        // glyph kinds via the z-sorted pass (`collectSortableMarks` filters
        // through `isGlyphOverlay`) and the bg-color / override substrate via
        // `rebuildSeriesLayer`'s pre-pass — so every kind is handled above.
        // Series styles (line / step-line / histogram / area / filled-band /
        // horizontal-line) never enter `plotOverlays` (see `applyPlot`).
    }
}

function glyphText(
    state: AdapterState,
    text: string,
    plot: PlotEmission,
    value: number,
    size: number,
    viewport: Viewport,
    spacing: number,
): KonvaNode {
    const x = projectShiftedX(
        { bars: state.bars, bar: plot.bar, xShift: plot.xShift, spacing },
        viewport,
    );
    const y = priceToY(value, viewport);
    return new state.konva.Text({
        x,
        y,
        text,
        fontSize: size,
        fontFamily: GLYPH_FONT_FAMILY,
        fill: plot.color ?? state.palette.glyphText,
        align: "center",
        verticalAlign: "middle",
    });
}

function seriesColor(series: ReadonlyArray<SeriesPoint>, fallback: string): string {
    for (let i = series.length - 1; i >= 0; i--) {
        const color = series[i].color;
        if (color !== null) return color;
    }
    return fallback;
}

// ---- ingest (mirrors canvas2d's apply* + ingest split) ----

// Append a point to a series, creating the entry (with its style) on
// first sight and refreshing the style (last-write-wins) thereafter — so
// the series and its style are always written together.
function pushSeriesPoint(
    state: AdapterState,
    key: string,
    style: PlotStyle,
    point: SeriesPoint,
): void {
    const entry = state.plotSeries.get(key);
    if (entry === undefined) {
        state.plotSeries.set(key, { style, points: [point] });
        return;
    }
    entry.points.push(point);
    state.plotSeries.set(key, { style, points: entry.points });
}

function applyPlot(state: AdapterState, plot: PlotEmission): void {
    if (plot.visible === false) return;
    const paneKey = plot.pane;
    if (paneKey !== "overlay" && !state.paneOrder.includes(paneKey)) {
        state.paneOrder.push(paneKey);
    }
    const style = plot.style;
    // One declaration-sequence number per ingested mark (ingest order =
    // script order, since the runtime drains in script order). `z` defaults
    // to `0`, omitted-on-the-wire ⇒ byte-identical band + declaration order.
    const seq = state.seq++;
    const z = plot.z ?? 0;
    // Omit a no-shift `xShift` so the stored point (and therefore the
    // rendered x) is byte-identical to a pre-feature emission, mirroring
    // canvas2d's `applyPlot`.
    const shift = plot.xShift === undefined || plot.xShift === 0 ? {} : { xShift: plot.xShift };
    // Thread the per-bar dynamic `colorValue` onto the point only when present
    // on the wire, so a no-`colorValue` point is byte-identical to a
    // pre-feature emission (`plot()` always passes `undefined` today — this is
    // wire-level honesty). `null` ⇒ paint-nothing gap; a string ⇒ override.
    const dyn = plot.colorValue === undefined ? {} : { colorValue: plot.colorValue };
    if (style.kind === "line" || style.kind === "step-line" || style.kind === "histogram") {
        pushSeriesPoint(state, paneSlotKey(paneKey, plot.slotId), style, {
            time: plot.time,
            value: plot.value,
            color: plot.color,
            bar: plot.bar,
            z,
            seq,
            ...shift,
            ...dyn,
        });
        return;
    }
    if (style.kind === "area" || style.kind === "filled-band") {
        // Area accumulates points like a line; a filled-band point also
        // carries its per-bar `upper` / `lower` / `alpha` bounds inline, so
        // the band shape reads them straight off the series with no
        // separate emission re-read.
        pushSeriesPoint(state, paneSlotKey(paneKey, plot.slotId), style, {
            time: plot.time,
            value: plot.value,
            color: plot.color,
            bar: plot.bar,
            z,
            seq,
            ...shift,
            ...dyn,
            ...(style.kind === "filled-band"
                ? { band: { upper: style.upper, lower: style.lower, alpha: style.alpha } }
                : {}),
        });
        return;
    }
    if (style.kind === "horizontal-line") {
        state.hlines.set(plot.slotId, {
            price: plot.value ?? 0,
            color: plot.color,
            paneKey,
            z,
            seq,
        });
        return;
    }
    const overlayKey = `${plot.slotId}@${plot.time}`;
    state.plotOverlays.set(overlayKey, plot);
    // `overlaySeq` carries the glyph overlay's declaration `seq` (the store
    // holds the raw emission, which has no `seq` field); written in lockstep.
    state.overlaySeq.set(overlayKey, seq);
}

function applyDrawing(state: AdapterState, drawing: DrawingEmission): void {
    if (drawing.op === "remove") {
        state.drawings.delete(drawing.handleId);
        state.drawingSeq.delete(drawing.handleId);
        return;
    }
    state.drawings.set(drawing.handleId, drawing);
    // `drawingSeq` carries the drawing's declaration `seq` (the store holds
    // the raw emission, which has no `seq` field); written in lockstep.
    state.drawingSeq.set(drawing.handleId, state.seq++);
}

function applyValidated<T>(items: ReadonlyArray<T>, apply: (item: T) => void): void {
    for (const item of items) {
        if (validateEmission(item).ok) apply(item);
    }
}

function applyLog(state: AdapterState, log: LogEmission): void {
    state.recentLogs.push(log);
    // Cap the buffer at the last N rows (matching canvas2d's `MAX_VISIBLE_LOGS`)
    // so the log pane never grows unbounded.
    while (state.recentLogs.length > MAX_VISIBLE_LOGS) {
        state.recentLogs.shift();
    }
}

function ingest(state: AdapterState, emissions: RunnerEmissions): void {
    applyValidated(emissions.plots, (plot) => applyPlot(state, plot));
    applyValidated(emissions.drawings, (drawing) => applyDrawing(state, drawing));
    // alertConditions are CURRENT-drain state: clear, then re-collect the
    // fired-or-not set this drain (the renderer paints only the fired ones),
    // mirroring canvas2d. Logs accumulate (capped). alerts (badge rendering)
    // and diagnostics remain validated-and-ignored — alert badges are a
    // separate deferral, diagnostics are not a visual.
    state.currentAlertConditions.length = 0;
    applyValidated(emissions.alertConditions, (condition) =>
        state.currentAlertConditions.push(condition),
    );
    applyValidated(emissions.logs, (log) => applyLog(state, log));
}

// ---- always-on-top tail (alert conditions + log pane) ----

// Draw the fired alert conditions as a compact top-right strip of `Text`
// rows, mirroring canvas2d's `render/alertConditions.ts`. Non-fired
// conditions are ignored (they still travel on the wire so hosts can model
// state transitions); an empty fired set paints nothing.
function buildAlertConditions(state: AdapterState, group: KonvaGroup, viewport: Viewport): void {
    const fired = state.currentAlertConditions.filter((condition) => condition.fired);
    if (fired.length === 0) return;
    const x = Math.max(ALERT_CONDITION_PANEL_X_PAD, viewport.pxWidth - ALERT_CONDITION_STRIP_WIDTH);
    for (let i = 0; i < fired.length; i++) {
        const condition = fired[i];
        group.add(
            new state.konva.Text({
                x,
                y: ALERT_CONDITION_PANEL_Y + i * ALERT_CONDITION_ROW_HEIGHT,
                text: `${condition.conditionId}: ${condition.defaultMessage}`,
                fontSize: TAIL_FONT_SIZE,
                fontFamily: GLYPH_FONT_FAMILY,
                fill: state.palette.plotDefault,
                align: "left",
                verticalAlign: "top",
            }),
        );
    }
}

// Draw the latest logs as a bottom-left pane of `Text` rows, mirroring
// canvas2d's `render/logPane.ts`. The buffer is already capped at
// `MAX_VISIBLE_LOGS` in `applyLog`, so this paints every row it holds.
function buildLogPane(state: AdapterState, group: KonvaGroup, viewport: Viewport): void {
    const visible = state.recentLogs;
    if (visible.length === 0) return;
    const x = LOG_PANE_PADDING;
    const y = Math.max(
        LOG_PANE_PADDING,
        viewport.pxHeight - LOG_PANE_PADDING - visible.length * LOG_PANE_ROW_HEIGHT,
    );
    for (let i = 0; i < visible.length; i++) {
        const log = visible[i];
        group.add(
            new state.konva.Text({
                x,
                y: y + i * LOG_PANE_ROW_HEIGHT,
                text: `[${log.level}] ${log.message}`,
                fontSize: TAIL_FONT_SIZE,
                fontFamily: GLYPH_FONT_FAMILY,
                fill: state.palette.plotDefault,
                align: "left",
                verticalAlign: "top",
            }),
        );
    }
}

// ---- render (rebuild the whole series layer each drain) ----

function rebuildSeriesLayer(state: AdapterState): void {
    state.seriesLayer.destroyChildren();
    const layout = computePaneLayout(state.paneOrder, state.stageSize);
    // Median adjacent-bar spacing of the run, computed once per rebuild and
    // threaded into every shifted-series projection (and `computePaneViewport`'s
    // `+k` xMax widening) so a shift past the data edge extrapolates a target
    // time from a stable cadence — matching canvas2d's per-frame `spacing`.
    const spacing = medianBarSpacing(state.bars);
    for (const entry of layout) {
        const group = new state.konva.Group({ x: entry.rect.x, y: entry.rect.y });
        const viewport = computePaneViewport(state, entry, spacing);
        if (entry.paneKey === "overlay") {
            // Cached for the DOM interaction handlers' pixel↔world mapping.
            state.lastOverlayViewport = viewport;
        }
        // Substrate paints BELOW the z-sorted pass and is `z`-independent
        // (matching canvas2d): background bg-color tints, then candles, then
        // candle / bar / bar-color overrides. Then ONE z-sorted pass paints
        // series / glyphs / hlines / drawings interleaved by `(z, band, seq)`.
        for (const plot of state.plotOverlays.values()) {
            if (plot.pane !== entry.paneKey) continue;
            if (plot.style.kind !== "bg-color") continue;
            buildOverlay(state, group, plot, viewport, spacing);
        }
        if (entry.paneKey === "overlay" && state.bars.length > 0) {
            buildCandles(state, group, viewport);
        }
        for (const plot of state.plotOverlays.values()) {
            if (plot.pane !== entry.paneKey) continue;
            // Candle / bar / bar-color overrides re-tint a bar with the
            // candles, below the sorted pass; glyph overlays and bg-color are
            // excluded here (glyphs join the sorted pass; bg-color above).
            if (
                plot.style.kind !== "candle-override" &&
                plot.style.kind !== "bar-override" &&
                plot.style.kind !== "bar-color"
            ) {
                continue;
            }
            buildOverlay(state, group, plot, viewport, spacing);
        }
        for (const mark of collectSortableMarks(state, entry.paneKey)) {
            paintSortableMark(state, group, mark, viewport, spacing);
        }
        // The alert-condition strip + log pane paint LAST in the overlay
        // pane's group — always-on-top, ABOVE the z-sorted marks and NOT
        // sortable by `z` in v1 (a deliberate deferral, mirroring canvas2d's
        // `renderOverlayTail`). They ride `roots[1]` (not the axis layer),
        // sharing the overlay pane's coordinate space.
        if (entry.paneKey === "overlay") {
            buildAlertConditions(state, group, viewport);
            buildLogPane(state, group, viewport);
        }
        state.seriesLayer.add(group);
    }
    state.seriesLayer.batchDraw();
}

// Rebuild the price-axis layer: one column of "nice" tick labels per pane,
// painted as `Text` nodes in the right gutter `computePaneViewport` already
// reserves (`Y_AXIS_GUTTER_PX`). Labels sit on the RIGHT — the house
// convention shared with canvas2d / echarts / lightweight-charts. Like the
// series layer this is a stateless redraw (`destroyChildren` → rebuild →
// `batchDraw`); it rides its own top layer so the series/drawings node trees
// (and their structural assertions) are untouched. A degenerate y range
// yields no ticks (`niceTicks` returns `[]`), so an empty/flat pane paints no
// labels rather than dividing by zero.
function rebuildAxisLayer(state: AdapterState): void {
    state.axisLayer.destroyChildren();
    const layout = computePaneLayout(state.paneOrder, state.stageSize);
    const spacing = medianBarSpacing(state.bars);
    for (const entry of layout) {
        const viewport = computePaneViewport(state, entry, spacing);
        const ticks = niceTicks(viewport.yMin, viewport.yMax, AXIS_TICK_COUNT);
        const step = tickStep(ticks);
        const group = new state.konva.Group({ x: entry.rect.x, y: entry.rect.y });
        for (const tick of ticks) {
            group.add(
                new state.konva.Text({
                    x: viewport.pxWidth + AXIS_LABEL_GAP_PX,
                    // Nudge up by half the cap height so the label centres on
                    // its price line.
                    y: priceToY(tick, viewport) - AXIS_LABEL_FONT_SIZE / 2,
                    text: formatTick(tick, step),
                    fontSize: AXIS_LABEL_FONT_SIZE,
                    fontFamily: GLYPH_FONT_FAMILY,
                    fill: state.palette.axisLabel,
                    align: "left",
                    verticalAlign: "top",
                }),
            );
        }
        state.axisLayer.add(group);
    }
    state.axisLayer.batchDraw();
}

// Build one accumulated plot series into its pane group, dispatching on
// the (last-write-wins) style. The per-series painter the z-sorted pass
// dispatches to.
function buildSeriesEntry(
    state: AdapterState,
    group: KonvaGroup,
    entry: { style: PlotStyle; points: SeriesPoint[] },
    viewport: Viewport,
    spacing: number,
): void {
    const { style, points } = entry;
    if (style.kind === "line" || style.kind === "step-line") {
        buildLineSeries(state, group, points, style, viewport, spacing);
    } else if (style.kind === "histogram") {
        buildHistogramSeries(state, group, points, style, viewport, spacing);
    } else if (style.kind === "area") {
        buildAreaSeries(state, group, points, style, viewport, spacing);
    } else if (style.kind === "filled-band") {
        buildFilledBand(state, group, points, viewport, spacing);
    }
}

// A `plotOverlays` entry joins the z-sorted glyph band iff its style is a
// shifted-series glyph (shape / marker / character / arrow / label) or a
// horizontal histogram — the subset `buildOverlay`'s glyph arms render.
// Substrate overlays (bg-color / bar-color / candle-/bar-override) paint
// with the candles before the sorted pass, so they are excluded here.
function isGlyphOverlay(style: PlotStyle): boolean {
    return (
        style.kind === "shape" ||
        style.kind === "marker" ||
        style.kind === "character" ||
        style.kind === "arrow" ||
        style.kind === "label" ||
        style.kind === "horizontal-histogram"
    );
}

// Collect every sortable mark for one pane — plot series, glyph overlays
// (overlay pane only), horizontal lines, and drawings (overlay pane only)
// — tagged `(z, band, seq)`, then stable-sort via the shared
// `sortByRenderOrder`. At the default `z = 0` the key reduces to
// `(band, declarationSeq)` = series → glyphs → hlines → drawings, the
// pre-`z` phase order; `z` reorders globally within the pane. A series
// mark's `z`/`seq` come from its LAST point (last-write-wins, like style).
function collectSortableMarks(state: AdapterState, paneKey: string): SortableMark[] {
    const marks: SortableMark[] = [];
    const prefix = paneKeyPrefix(paneKey);
    for (const [key, entry] of state.plotSeries) {
        if (!key.startsWith(prefix)) continue;
        // A stored series always holds ≥ 1 point (`pushSeriesPoint` only
        // ever creates with one), so the last point — carrying the series'
        // most-recent `z`/`seq` — is always present.
        const last = entry.points[entry.points.length - 1];
        marks.push({ kind: "series", z: last.z, band: RENDER_BAND.series, seq: last.seq, entry });
    }
    if (paneKey === "overlay") {
        for (const [overlayKey, plot] of state.plotOverlays) {
            if (!isGlyphOverlay(plot.style)) continue;
            // `overlaySeq` is written in lockstep with `plotOverlays`.
            /* v8 ignore next -- lockstep with plotOverlays; ?? never taken */
            const seq = state.overlaySeq.get(overlayKey) ?? 0;
            marks.push({ kind: "glyph", z: plot.z ?? 0, band: RENDER_BAND.glyph, seq, plot });
        }
    }
    for (const hline of state.hlines.values()) {
        if (hline.paneKey !== paneKey) continue;
        marks.push({ kind: "hline", z: hline.z, band: RENDER_BAND.hline, seq: hline.seq, hline });
    }
    if (paneKey === "overlay") {
        for (const [handleId, drawing] of state.drawings) {
            // `drawingSeq` is written in lockstep with `drawings`.
            /* v8 ignore next -- lockstep with drawings; ?? never taken */
            const seq = state.drawingSeq.get(handleId) ?? 0;
            marks.push({
                kind: "drawing",
                z: drawing.z ?? 0,
                band: RENDER_BAND.drawing,
                seq,
                drawing,
            });
        }
    }
    return sortByRenderOrder(marks);
}

// Paint one sortable mark into its pane group by routing it to its existing
// per-kind builder. Order — not per-mark drawing — is what the sort changed.
// Drawings decompose to the shared `DrawPrimitive` IR (overlay-pane only,
// matching canvas2d) and map to Konva nodes via `primitiveToNode`;
// `op:"remove"` drawings never reach here (`applyDrawing` drops them).
function paintSortableMark(
    state: AdapterState,
    group: KonvaGroup,
    mark: SortableMark,
    viewport: Viewport,
    spacing: number,
): void {
    switch (mark.kind) {
        case "series":
            buildSeriesEntry(state, group, mark.entry, viewport, spacing);
            return;
        case "glyph":
            buildOverlay(state, group, mark.plot, viewport, spacing);
            return;
        case "hline":
            buildHLine(state, group, mark.hline, viewport);
            return;
        case "drawing":
            for (const primitive of decomposeDrawing(mark.drawing, viewport)) {
                for (const node of primitiveToNode(state.konva, primitive)) {
                    group.add(node);
                }
            }
            return;
    }
}

function applyCandleEvent(state: AdapterState, event: CandleEvent): void {
    if (event.streamKey !== undefined) return;
    if (event.kind === "history") {
        for (const bar of event.bars) {
            state.bars.push(bar);
            state.barsByTime.set(bar.time, bar);
        }
        return;
    }
    if (event.kind === "tick") {
        if (state.bars.length === 0) {
            state.bars.push(event.bar);
            state.barsByTime.set(event.bar.time, event.bar);
            return;
        }
        // A tick replaces the in-progress last bar: drop its prior time
        // mapping before re-indexing, so a tick that re-times the bar does
        // not leave a stale entry.
        const prev = state.bars[state.bars.length - 1];
        state.barsByTime.delete(prev.time);
        state.bars[state.bars.length - 1] = event.bar;
        state.barsByTime.set(event.bar.time, event.bar);
        return;
    }
    state.bars.push(event.bar);
    state.barsByTime.set(event.bar.time, event.bar);
}

/**
 * Create a Konva rendering adapter wired to a worker host. The handle's
 * `onEmissions` callback validates every emission, accumulates plot /
 * horizontal-line state, buffers drawings, and rebuilds the series layer
 * (which carries plots / glyphs / hlines AND the z-sorted drawings) +
 * `batchDraw`s on every drain — a stateless redraw matching the canvas2d
 * reference adapter. Drawings render through the shared `decomposeDrawing`
 * IR + `primitiveToNode`, interleaved with plots by `(z, band, seq)`.
 * Candle events feed the bar buffer via `feedCandleEvent`.
 *
 * @since 1.4
 * @stable
 * @example
 *     import Konva from "konva";
 *     import { createKonvaAdapter } from "chartlang-example-konva-adapter";
 *     declare const candleSource: AsyncIterable<CandleEvent>;
 *     const adapter = createKonvaAdapter({
 *         konva: Konva,
 *         stage: { width: 800, height: 400 },
 *         candleSource,
 *     });
 *     // await adapter.host.load(compiled);
 *     void adapter;
 */
export function createKonvaAdapter(opts: CreateKonvaAdapterOpts): KonvaAdapterHandle {
    const capabilities = opts.capabilities ?? KONVA_CAPABILITIES;
    const palette = opts.palette ?? DEFAULT_PALETTE;
    // Construct the stage conditionally so the headless (no-container) path
    // is byte-identical to the original config bag — only a supplied
    // `container` adds the DOM-mount key.
    const stage = new opts.konva.Stage(
        opts.container !== undefined
            ? { container: opts.container, width: opts.stage.width, height: opts.stage.height }
            : { width: opts.stage.width, height: opts.stage.height },
    );
    // ONE series layer carries plots / glyphs / hlines AND drawings so the
    // per-pane z-sort can interleave them. The axis layer is added LAST so
    // its right-gutter labels sit on top; the series layer keeps its
    // `roots[1]` index.
    const seriesLayer = new opts.konva.Layer();
    const axisLayer = new opts.konva.Layer();
    stage.add(seriesLayer);
    stage.add(axisLayer);
    const state: AdapterState = {
        konva: opts.konva,
        stage,
        seriesLayer,
        axisLayer,
        stageSize: { width: opts.stage.width, height: opts.stage.height },
        bars: [],
        barsByTime: new Map(),
        paneOrder: ["overlay"],
        plotSeries: new Map(),
        plotOverlays: new Map(),
        hlines: new Map(),
        drawings: new Map(),
        currentAlertConditions: [],
        recentLogs: [],
        seq: 0,
        overlaySeq: new Map(),
        drawingSeq: new Map(),
        palette,
        view: createViewController(),
        ...(opts.initialVisibleBars !== undefined
            ? { initialVisibleBars: opts.initialVisibleBars }
            : {}),
    };
    // Wire wheel-zoom / drag-pan / dblclick-reset on the mount element when
    // running against a real DOM (production passes `opts.container`).
    // Headless tests omit it + use `MockKonva`, so no listeners attach and
    // the pinned scene hash / coverage are unaffected. `requestRender`
    // rebuilds the series + axis layers because the drive loop only repaints
    // on candles.
    /* v8 ignore start -- DOM interaction wiring; only runs against a real container */
    const container = opts.container as Partial<HTMLElement> | undefined;
    if (container !== undefined && typeof container.addEventListener === "function") {
        const handlers: InteractionHandlers = {
            controller: state.view,
            pxToWorldX: (px) => {
                const v = state.lastOverlayViewport;
                if (v === undefined) return 0;
                return v.xMin + (px / v.pxWidth) * (v.xMax - v.xMin);
            },
            worldXPerPx: () => {
                const v = state.lastOverlayViewport;
                if (v === undefined) return 1;
                return (v.xMax - v.xMin) / v.pxWidth;
            },
            dataBounds: () => {
                const { bars } = state;
                if (bars.length === 0) return { xMin: 0, xMax: 1 };
                let xMin = Number.POSITIVE_INFINITY;
                let xMax = Number.NEGATIVE_INFINITY;
                for (const bar of bars) {
                    if (bar.time < xMin) xMin = bar.time;
                    if (bar.time > xMax) xMax = bar.time;
                }
                return { xMin, xMax };
            },
            requestRender: () => {
                rebuildSeriesLayer(state);
                rebuildAxisLayer(state);
            },
        };
        state.detachInteraction = attachInteraction(container as HTMLElement, handlers);
    }
    /* v8 ignore stop */
    const host =
        opts.host ??
        createWorkerHost(
            opts.workerLike !== undefined
                ? {
                      capabilities,
                      symInfo: KONVA_SYM_INFO,
                      ...(opts.resolveInputs !== undefined
                          ? { resolveInputs: opts.resolveInputs }
                          : {}),
                      ...(opts.feedExternalSeries !== undefined
                          ? { resolveExternalSeries: opts.feedExternalSeries }
                          : {}),
                      workerLike: opts.workerLike,
                  }
                : {
                      capabilities,
                      symInfo: KONVA_SYM_INFO,
                      ...(opts.resolveInputs !== undefined
                          ? { resolveInputs: opts.resolveInputs }
                          : {}),
                      ...(opts.feedExternalSeries !== undefined
                          ? { resolveExternalSeries: opts.feedExternalSeries }
                          : {}),
                  },
        );

    const adapter = defineAdapter({
        id: "konva-example",
        name: "Konva Example Adapter",
        capabilities,
        ...(opts.resolveInputs !== undefined ? { resolveInputs: opts.resolveInputs } : {}),
        ...(opts.feedExternalSeries !== undefined
            ? { feedExternalSeries: opts.feedExternalSeries }
            : {}),
        symInfo: KONVA_SYM_INFO,
        candles: () => opts.candleSource,
        onEmissions: (emissions) => {
            ingest(state, emissions);
            rebuildSeriesLayer(state);
            rebuildAxisLayer(state);
        },
        dispose: () => {
            state.bars.length = 0;
            state.barsByTime.clear();
            state.paneOrder = ["overlay"];
            state.plotSeries.clear();
            state.plotOverlays.clear();
            state.hlines.clear();
            state.drawings.clear();
            state.currentAlertConditions.length = 0;
            state.recentLogs.length = 0;
            state.seq = 0;
            state.overlaySeq.clear();
            state.drawingSeq.clear();
            /* v8 ignore next -- only set on the real-container interaction path */
            state.detachInteraction?.();
            state.stage.destroy();
            host.dispose();
        },
    });

    const handle: KonvaAdapterHandle = Object.freeze({ ...adapter, host });
    HANDLE_STATE.set(handle, state);
    HANDLE_INTERVAL.set(handle, opts.interval ?? DEFAULT_INTERVAL);
    return handle;
}

/**
 * Rebuild the series + axis layers without a new candle event — the
 * repaint the DOM interaction handlers (wheel-zoom / drag-pan /
 * dblclick-reset) call after a gesture changes the view window. Retrieves
 * the handle's `AdapterState` through the module-local `WeakMap` and throws
 * the documented sentinel on a foreign handle.
 *
 * @since 1.6
 * @stable
 * @example
 *     import { createKonvaAdapter, redraw } from "chartlang-example-konva-adapter";
 *     import { mockCandleSource } from "@invinite-org/chartlang-adapter-kit";
 *     import { MockKonva } from "chartlang-example-konva-adapter/testing";
 *     const adapter = createKonvaAdapter({
 *         konva: new MockKonva() as never,
 *         stage: { width: 10, height: 10 },
 *         candleSource: mockCandleSource([]),
 *     });
 *     redraw(adapter);
 */
export function redraw(handle: KonvaAdapterHandle): void {
    const state = HANDLE_STATE.get(handle);
    if (state === undefined) {
        throw new Error("redraw: handle was not produced by createKonvaAdapter");
    }
    rebuildSeriesLayer(state);
    rebuildAxisLayer(state);
}

/**
 * Feed one candle event into a handle's bar buffer, then rebuild the
 * series layer so the candles repaint. The handle's `AdapterState` is
 * held in a module-local `WeakMap` (not on the public surface), so this
 * retrieves it through the map and throws a documented sentinel when
 * called on a handle this module did not produce.
 *
 * @since 1.4
 * @stable
 * @example
 *     declare const adapter: KonvaAdapterHandle;
 *     declare const event: CandleEvent;
 *     feedCandleEvent(adapter, event);
 *     void feedCandleEvent;
 */
export function feedCandleEvent(handle: KonvaAdapterHandle, event: CandleEvent): void {
    const state = HANDLE_STATE.get(handle);
    if (state === undefined) {
        throw new Error("feedCandleEvent: handle was not produced by createKonvaAdapter");
    }
    applyCandleEvent(state, event);
    // A new bar shifts the overlay `Viewport` (x/y range), so the series
    // layer (now carrying the z-sorted drawings too) AND the axis labels
    // repaint against the updated scale to stay aligned with candles.
    rebuildSeriesLayer(state);
    rebuildAxisLayer(state);
}

/**
 * Read the resolved chart interval for a handle (defaults to `"1D"`).
 * Retrieved through the same module-local `WeakMap` as
 * {@link feedCandleEvent}; throws the documented sentinel on a foreign
 * handle.
 *
 * @since 1.4
 * @stable
 * @example
 *     declare const adapter: KonvaAdapterHandle;
 *     const interval = handleInterval(adapter);
 *     // interval === "1D"
 *     void interval;
 */
export function handleInterval(handle: KonvaAdapterHandle): string {
    const interval = HANDLE_INTERVAL.get(handle);
    if (interval === undefined) {
        throw new Error("handleInterval: handle was not produced by createKonvaAdapter");
    }
    return interval;
}

/**
 * Optional second argument for {@link runKonvaLoop}. Pass a `signal` from
 * an `AbortController` to cancel the loop cleanly: once the signal aborts,
 * the loop drops the current iteration's remaining work, breaks out of the
 * async-iterator, and resolves (no throw). This is the convention a React
 * consumer needs when the chart component unmounts mid-stream — the loop
 * returns silently and the caller does not have to swallow rejections.
 *
 * @since 1.5
 * @stable
 * @example
 *     const opts: RunKonvaLoopOpts = { signal: new AbortController().signal };
 *     void opts;
 */
export type RunKonvaLoopOpts = Readonly<{ signal?: AbortSignal }>;

/**
 * Drive a built Konva adapter through one full pass of its candle source:
 * iterate the events, repaint each via {@link feedCandleEvent} (which feeds
 * the bar buffer and rebuilds the series + axis layers), `await host.push(event)`, then
 * `host.drain()` + `handle.onEmissions(...)` between events. Returns when
 * the source completes; throws whatever the source / host throws. This is
 * the uniform live drive loop — the Konva analogue of the canvas2d
 * reference adapter's `runRendererLoop`, so the live demo can drive all
 * adapters with one `run(signal)` shape.
 *
 * Pass `opts.signal` (typically from an `AbortController`) to cancel the
 * loop cleanly. On abort the loop returns silently — no throw — after
 * finishing at most one in-flight `host.push` / `host.drain`. The handle's
 * `AdapterState` is held in the module-local `WeakMap` (not on the public
 * surface), so this throws the documented sentinel on a handle this module
 * did not produce — mirroring {@link feedCandleEvent} / {@link handleInterval}.
 *
 * @since 1.5
 * @stable
 * @example
 *     import { createKonvaAdapter, runKonvaLoop } from "chartlang-example-konva-adapter";
 *     import { mockCandleSource } from "@invinite-org/chartlang-adapter-kit";
 *     import Konva from "konva";
 *     declare const container: HTMLElement;
 *     const adapter = createKonvaAdapter({
 *         konva: Konva,
 *         container,
 *         stage: { width: 800, height: 400 },
 *         candleSource: mockCandleSource([]),
 *     });
 *     // await adapter.host.load(compiled);
 *     // await runKonvaLoop(adapter);
 *     const fn: typeof runKonvaLoop = runKonvaLoop;
 *     void fn;
 */
export async function runKonvaLoop(
    handle: KonvaAdapterHandle,
    opts: RunKonvaLoopOpts = {},
): Promise<void> {
    const state = HANDLE_STATE.get(handle);
    const interval = HANDLE_INTERVAL.get(handle);
    if (state === undefined || interval === undefined) {
        throw new Error("runKonvaLoop: handle was not produced by createKonvaAdapter");
    }
    const signal = opts.signal;
    const aborted = (): boolean => signal?.aborted ?? false;
    if (aborted()) return;
    for await (const event of handle.candles({ interval })) {
        if (aborted()) return;
        feedCandleEvent(handle, event);
        await handle.host.push(event);
        if (aborted()) return;
        // Yield once so an async worker host can complete its candle-event
        // dispatch before the drain frame is processed. In-process hosts
        // resolve `push` synchronously and this is a no-op for them.
        await new Promise<void>((r) => setTimeout(r, 0));
        if (aborted()) return;
        // Guard after `drain` resolves too: an abort that fires while the
        // drain is in flight must not paint a disposed stage (matches the
        // sibling `runEChartsLoop` / `runRendererLoop` post-drain check).
        const emissions = await handle.host.drain();
        if (aborted()) return;
        handle.onEmissions(emissions);
    }
}
