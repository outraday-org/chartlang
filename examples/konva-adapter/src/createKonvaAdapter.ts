// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import {
    type Adapter,
    type CandleEvent,
    type Capabilities,
    type DrawingEmission,
    type PlotEmission,
    type PlotStyle,
    type RunnerEmissions,
    type Viewport,
    decomposeDrawing,
    defineAdapter,
    priceToY,
    timeToX,
    validateEmission,
} from "@invinite-org/chartlang-adapter-kit";
import type { Bar } from "@invinite-org/chartlang-core";
import {
    type ScriptHost,
    type WorkerLike,
    createWorkerHost,
} from "@invinite-org/chartlang-host-worker";

import { KONVA_CAPABILITIES, KONVA_SYM_INFO } from "./capabilities.js";
import { DEFAULT_PALETTE, type KonvaPalette } from "./palette.js";
import { type PaneLayoutEntry, computePaneLayout } from "./paneLayout.js";
import { primitiveToNode, withAlpha } from "./primitiveToNode.js";
import type { KonvaGroup, KonvaLayer, KonvaNamespace, KonvaNode, KonvaStage } from "./types.js";

const DEFAULT_INTERVAL = "1D";
const Y_AXIS_PADDING = 0.05;
const BODY_WIDTH_RATIO = 0.6;
const HISTOGRAM_BAR_WIDTH_PX = 4;
const GLYPH_FONT_FAMILY = "sans-serif";
const GLYPH_LABEL_FONT_SIZE = 11;
const HORIZONTAL_HISTOGRAM_MAX_WIDTH_PX = 96;
const HORIZONTAL_HISTOGRAM_ROW_HEIGHT_PX = 6;

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
    readonly candleSource: AsyncIterable<CandleEvent>;
    readonly capabilities?: Capabilities;
    readonly interval?: string;
    readonly palette?: KonvaPalette;
    readonly resolveInputs?: (scriptId: string) => Readonly<Record<string, unknown>>;
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
    readonly band?: {
        readonly upper: number | null;
        readonly lower: number | null;
        readonly alpha: number;
    };
};

// Horizontal line keyed by slot id (last-write-wins), carrying its pane.
type PanedHLine = {
    readonly price: number;
    readonly color: string | null;
    readonly paneKey: string;
};

type AdapterState = {
    readonly konva: KonvaNamespace;
    readonly stage: KonvaStage;
    readonly seriesLayer: KonvaLayer;
    // Rebuilt every drain from `drawings` via `decomposeDrawing` +
    // `primitiveToNode`; lives on its own layer above the series layer.
    readonly drawingsLayer: KonvaLayer;
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
    // by `rebuildDrawingsLayer` through the shared `decomposeDrawing` IR.
    readonly drawings: Map<string, DrawingEmission>;
    readonly palette: KonvaPalette;
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

// Collect the y-range a single pane should span. The overlay pane sees
// bars ∪ overlay-keyed series ∪ overlay-keyed hlines; a subpane sees only
// its own series + hlines (so an RSI band in 0-100 never stretches the
// price scale). Returns ±Infinity when no finite candidate was observed —
// the caller maps that to the (0, 1) fallback.
function computeYRange(state: AdapterState, paneKey: string): { yMin: number; yMax: number } {
    let yMin = Number.POSITIVE_INFINITY;
    let yMax = Number.NEGATIVE_INFINITY;
    const observe = (v: number): void => {
        if (v < yMin) yMin = v;
        if (v > yMax) yMax = v;
    };
    if (paneKey === "overlay") {
        for (const bar of state.bars) {
            observe(bar.high);
            observe(bar.low);
        }
    }
    const prefix = paneKeyPrefix(paneKey);
    for (const [key, entry] of state.plotSeries) {
        if (!key.startsWith(prefix)) continue;
        for (const point of entry.points) {
            if (point.value !== null && Number.isFinite(point.value)) observe(point.value);
        }
    }
    for (const hline of state.hlines.values()) {
        if (hline.paneKey === paneKey && Number.isFinite(hline.price)) observe(hline.price);
    }
    return { yMin, yMax };
}

function computePaneViewport(state: AdapterState, entry: PaneLayoutEntry): Viewport {
    const { bars } = state;
    const { rect, paneKey } = entry;
    if (bars.length === 0) {
        return { xMin: 0, xMax: 1, yMin: 0, yMax: 1, pxWidth: rect.w, pxHeight: rect.h };
    }
    let xMin = Number.POSITIVE_INFINITY;
    let xMax = Number.NEGATIVE_INFINITY;
    for (const bar of bars) {
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
        pxWidth: rect.w,
        pxHeight: rect.h,
    };
}

// ---- node builders (one per visual; each appends to the pane group) ----

function buildCandles(state: AdapterState, group: KonvaGroup, viewport: Viewport): void {
    const bodyWidth = (viewport.pxWidth / state.bars.length) * BODY_WIDTH_RATIO;
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

// Flatten a series of finite points into a Konva polyline `points` array,
// breaking on `null`/non-finite values so a gap is rendered as separate
// segments. Returns one flat array per contiguous finite run.
function lineSegments(
    series: ReadonlyArray<SeriesPoint>,
    project: (point: SeriesPoint, value: number) => { x: number; y: number },
): number[][] {
    const runs: number[][] = [];
    let current: number[] = [];
    for (const point of series) {
        if (point.value === null || !Number.isFinite(point.value)) {
            if (current.length > 0) {
                runs.push(current);
                current = [];
            }
            continue;
        }
        const { x, y } = project(point, point.value);
        current.push(x, y);
    }
    if (current.length > 0) runs.push(current);
    return runs;
}

function buildLineSeries(
    state: AdapterState,
    group: KonvaGroup,
    series: ReadonlyArray<SeriesPoint>,
    style: Extract<PlotStyle, { kind: "line" | "step-line" }>,
    viewport: Viewport,
): void {
    const project = (point: SeriesPoint, value: number): { x: number; y: number } => ({
        x: timeToX(point.time, viewport),
        y: priceToY(value, viewport),
    });
    const dash = dashFor(style.lineStyle);
    for (const run of lineSegments(series, project)) {
        // A single-point run (e.g. an isolated value between two gaps) is
        // not a drawable polyline — skip it.
        if (run.length < 4) continue;
        // step-line: insert a horizontal then vertical knee between points
        // by duplicating x of the next point at the prior y.
        const points = style.kind === "step-line" ? toStepPoints(run) : run;
        group.add(
            new state.konva.Line({
                points,
                stroke: seriesColor(series, state.palette.plotDefault),
                strokeWidth: style.lineWidth,
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
): void {
    const project = (point: SeriesPoint, value: number): { x: number; y: number } => ({
        x: timeToX(point.time, viewport),
        y: priceToY(value, viewport),
    });
    const baselineY = priceToY(viewport.yMin, viewport);
    const dash = dashFor(style.lineStyle);
    const color = seriesColor(series, state.palette.plotDefault);
    for (const run of lineSegments(series, project)) {
        if (run.length < 4) continue;
        const closed = run.slice();
        const lastX = run[run.length - 2];
        const firstX = run[0];
        closed.push(lastX, baselineY, firstX, baselineY);
        group.add(
            new state.konva.Line({
                points: closed,
                closed: true,
                // The fill carries the requested `fillAlpha` (baked into the
                // `#rrggbbaa` colour); the stroke stays fully opaque.
                fill: withAlpha(color, style.fillAlpha),
                stroke: color,
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
): void {
    const baselineY = priceToY(style.baseline, viewport);
    for (const point of series) {
        if (point.value === null || !Number.isFinite(point.value)) continue;
        const x = timeToX(point.time, viewport);
        const y = priceToY(point.value, viewport);
        const top = Math.min(baselineY, y);
        const height = Math.max(1, Math.abs(y - baselineY));
        group.add(
            new state.konva.Rect({
                x: x - HISTOGRAM_BAR_WIDTH_PX / 2,
                y: top,
                width: HISTOGRAM_BAR_WIDTH_PX,
                height,
                fill: point.color ?? state.palette.plotDefault,
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
        const x = timeToX(point.time, viewport);
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

// Glyph / override / style plot kinds → the closest Konva facility. Each
// `case` documents the mapping. `marker` and `shape` render a small `Rect`
// (square glyph) since the per-shape glyph geometry is owned by the
// drawings layer (`primitiveToNode`); `character` renders a `Text`;
// `arrow` a `Text` arrow glyph; overrides re-tint the bar via a `Rect`;
// `bg-color` a full-pane background `Rect`; `horizontal-histogram`
// per-bucket `Rect`s.
function buildOverlay(
    state: AdapterState,
    group: KonvaGroup,
    plot: PlotEmission,
    viewport: Viewport,
): void {
    const style = plot.style;
    switch (style.kind) {
        case "shape":
        case "marker": {
            if (!isFiniteValue(plot.value)) return;
            const x = timeToX(plot.time, viewport);
            const y = priceToY(plot.value, viewport);
            const size = style.size;
            group.add(
                new state.konva.Rect({
                    x: x - size / 2,
                    y: y - size / 2,
                    width: size,
                    height: size,
                    fill: plot.color ?? state.palette.glyphText,
                }),
            );
            return;
        }
        case "character": {
            if (!isFiniteValue(plot.value)) return;
            group.add(glyphText(state, style.char, plot, plot.value, style.size, viewport));
            return;
        }
        case "arrow": {
            if (!isFiniteValue(plot.value)) return;
            const glyph = style.direction === "up" ? "▲" : "▼";
            group.add(glyphText(state, glyph, plot, plot.value, style.size, viewport));
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
            const color = style.kind === "candle-override" ? style.bull : style.color;
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
            // Full-pane background tint anchored at the bar's x column.
            const x = timeToX(plot.time, viewport);
            const colWidth =
                state.bars.length > 0 ? viewport.pxWidth / state.bars.length : viewport.pxWidth;
            group.add(
                new state.konva.Rect({
                    x: x - colWidth / 2,
                    y: 0,
                    width: colWidth,
                    height: viewport.pxHeight,
                    fill: style.color,
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
                glyphText(state, style.text, plot, plot.value, GLYPH_LABEL_FONT_SIZE, viewport),
            );
            return;
        }
        // No default: `isOverlayStyle` gates which styles reach this
        // builder, so every overlay kind is handled above.
    }
}

function glyphText(
    state: AdapterState,
    text: string,
    plot: PlotEmission,
    value: number,
    size: number,
    viewport: Viewport,
): KonvaNode {
    const x = timeToX(plot.time, viewport);
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

// A `plotOverlays` entry is a non-series visual the overlay/subpane group
// paints directly (glyph, override, background, histogram, label). Series
// styles (line / step-line / histogram / area / horizontal-line /
// filled-band) are accumulated separately and excluded here.
function isOverlayStyle(style: PlotStyle): boolean {
    return (
        style.kind === "shape" ||
        style.kind === "marker" ||
        style.kind === "character" ||
        style.kind === "arrow" ||
        style.kind === "candle-override" ||
        style.kind === "bar-override" ||
        style.kind === "bar-color" ||
        style.kind === "bg-color" ||
        style.kind === "horizontal-histogram" ||
        style.kind === "label"
    );
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
    if (style.kind === "line" || style.kind === "step-line" || style.kind === "histogram") {
        pushSeriesPoint(state, paneSlotKey(paneKey, plot.slotId), style, {
            time: plot.time,
            value: plot.value,
            color: plot.color,
            bar: plot.bar,
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
        });
        return;
    }
    const overlayKey = `${plot.slotId}@${plot.time}`;
    state.plotOverlays.set(overlayKey, plot);
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

function ingest(state: AdapterState, emissions: RunnerEmissions): void {
    applyValidated(emissions.plots, (plot) => applyPlot(state, plot));
    applyValidated(emissions.drawings, (drawing) => applyDrawing(state, drawing));
    // alerts / alertConditions / logs / diagnostics are part of the
    // declared capability surface but NOT rendered by this adapter (no
    // alert badge, log pane, or condition strip in the Konva series
    // layer). They are validated-and-ignored — never thrown on — so the
    // adapter ingests the full emission surface without crashing. Alert /
    // log rendering is a deferred follow-up, like canvas2d's tail pass.
}

// ---- render (rebuild the whole series layer each drain) ----

function rebuildSeriesLayer(state: AdapterState): void {
    state.seriesLayer.destroyChildren();
    const layout = computePaneLayout(state.paneOrder, state.stageSize);
    for (const entry of layout) {
        const group = new state.konva.Group({ x: entry.rect.x, y: entry.rect.y });
        const viewport = computePaneViewport(state, entry);
        if (entry.paneKey === "overlay" && state.bars.length > 0) {
            buildCandles(state, group, viewport);
        }
        // Background overlays first (behind series), then series, then
        // glyph/override overlays, then hlines.
        for (const plot of state.plotOverlays.values()) {
            if (plot.pane !== entry.paneKey) continue;
            if (plot.style.kind !== "bg-color") continue;
            buildOverlay(state, group, plot, viewport);
        }
        buildPaneSeries(state, group, entry.paneKey, viewport);
        for (const plot of state.plotOverlays.values()) {
            if (plot.pane !== entry.paneKey) continue;
            if (plot.style.kind === "bg-color") continue;
            /* v8 ignore next -- plotOverlays only ever holds overlay-style emissions (see applyPlot) */
            if (!isOverlayStyle(plot.style)) continue;
            buildOverlay(state, group, plot, viewport);
        }
        for (const hline of state.hlines.values()) {
            if (hline.paneKey !== entry.paneKey) continue;
            buildHLine(state, group, hline, viewport);
        }
        state.seriesLayer.add(group);
    }
    state.seriesLayer.batchDraw();
}

// Rebuild the dedicated drawings layer from the buffered drawing state.
// Drawings render only in the OVERLAY pane (matching the canvas2d
// reference adapter), so each live drawing is decomposed against the
// overlay pane's `Viewport` into the shared `DrawPrimitive` IR, then each
// primitive is mapped to its Konva node(s) by `primitiveToNode`. The
// nodes ride a `Group` translated to the overlay pane origin (the IR is
// pane-local pixel space). The whole layer is torn down and rebuilt every
// drain — the same stateless redraw the series layer uses.
function rebuildDrawingsLayer(state: AdapterState): void {
    state.drawingsLayer.destroyChildren();
    const layout = computePaneLayout(state.paneOrder, state.stageSize);
    const overlay = layout.find((entry) => entry.paneKey === "overlay");
    // `paneOrder` always starts with "overlay", so the layout always
    // carries an overlay entry; the guard keeps `overlay` non-undefined.
    /* v8 ignore next -- overlay pane is always present (paneOrder[0] === "overlay") */
    if (overlay === undefined) return;
    const viewport = computePaneViewport(state, overlay);
    const group = new state.konva.Group({ x: overlay.rect.x, y: overlay.rect.y });
    for (const drawing of state.drawings.values()) {
        for (const primitive of decomposeDrawing(drawing, viewport)) {
            for (const node of primitiveToNode(state.konva, primitive)) {
                group.add(node);
            }
        }
    }
    state.drawingsLayer.add(group);
    state.drawingsLayer.batchDraw();
}

function buildPaneSeries(
    state: AdapterState,
    group: KonvaGroup,
    paneKey: string,
    viewport: Viewport,
): void {
    const prefix = paneKeyPrefix(paneKey);
    for (const [key, entry] of state.plotSeries) {
        if (!key.startsWith(prefix)) continue;
        const { style, points } = entry;
        if (style.kind === "line" || style.kind === "step-line") {
            buildLineSeries(state, group, points, style, viewport);
        } else if (style.kind === "histogram") {
            buildHistogramSeries(state, group, points, style, viewport);
        } else if (style.kind === "area") {
            buildAreaSeries(state, group, points, style, viewport);
        } else if (style.kind === "filled-band") {
            buildFilledBand(state, group, points, viewport);
        }
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
 * horizontal-line state, buffers drawings, and rebuilds the series +
 * drawings layers + `batchDraw`s on every drain — a stateless redraw
 * matching the canvas2d reference adapter. Drawings render through the
 * shared `decomposeDrawing` IR + `primitiveToNode`. Candle events feed
 * the bar buffer via `feedCandleEvent`.
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
    const stage = new opts.konva.Stage({ width: opts.stage.width, height: opts.stage.height });
    const seriesLayer = new opts.konva.Layer();
    const drawingsLayer = new opts.konva.Layer();
    stage.add(seriesLayer);
    stage.add(drawingsLayer);
    const state: AdapterState = {
        konva: opts.konva,
        stage,
        seriesLayer,
        drawingsLayer,
        stageSize: { width: opts.stage.width, height: opts.stage.height },
        bars: [],
        barsByTime: new Map(),
        paneOrder: ["overlay"],
        plotSeries: new Map(),
        plotOverlays: new Map(),
        hlines: new Map(),
        drawings: new Map(),
        palette,
    };
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
                      workerLike: opts.workerLike,
                  }
                : {
                      capabilities,
                      symInfo: KONVA_SYM_INFO,
                      ...(opts.resolveInputs !== undefined
                          ? { resolveInputs: opts.resolveInputs }
                          : {}),
                  },
        );

    const adapter = defineAdapter({
        id: "konva-example",
        name: "Konva Example Adapter",
        capabilities,
        ...(opts.resolveInputs !== undefined ? { resolveInputs: opts.resolveInputs } : {}),
        symInfo: KONVA_SYM_INFO,
        candles: () => opts.candleSource,
        onEmissions: (emissions) => {
            ingest(state, emissions);
            rebuildSeriesLayer(state);
            rebuildDrawingsLayer(state);
        },
        dispose: () => {
            state.bars.length = 0;
            state.barsByTime.clear();
            state.paneOrder = ["overlay"];
            state.plotSeries.clear();
            state.plotOverlays.clear();
            state.hlines.clear();
            state.drawings.clear();
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
    rebuildSeriesLayer(state);
    // A new bar shifts the overlay `Viewport` (x/y range), so the drawings
    // must repaint against the updated scale to stay aligned with candles.
    rebuildDrawingsLayer(state);
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
