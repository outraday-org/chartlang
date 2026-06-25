// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import {
    type PlotStyle,
    type WindowYInput,
    type XWindow,
    medianBarSpacing,
    shiftedBarTime,
    yRangeInWindow,
} from "@invinite-org/chartlang-adapter-kit";
import type { Bar } from "@invinite-org/chartlang-core";

import {
    type FilledBandDescriptor,
    type LayerDescriptor,
    type LineStripDescriptor,
    type PaneRenderState,
    type PaneWindow,
    type RgbaUnit,
    type VerticalBarsDescriptor,
    hexToRgbaUnit,
    isBullish,
    resolvePaintColor,
} from "./layer-descriptor.js";
import { BAND, type RenderOrderMark, applyRenderOrder } from "./renderOrder.js";
import { sampleMonotoneRuns } from "./webgl/programs/line-strip-pack.js";

import { type AdapterState, type HLine, type PlotPoint, paneKeyPrefix } from "./state.js";

// Dashed-stroke on/off pattern (CSS-px) for an hline whose `lineStyle` is not
// solid. Mirrors the canvas2d reference's dashed hline cadence intent.
const HLINE_DASH: readonly [number, number] = [6, 4];
// CSS-px width fallback for an hline with a non-positive `lineWidth`.
const HLINE_DEFAULT_WIDTH_PX = 1;

// ±5% headroom above / below the auto-fit price range, matching the canvas2d
// reference's `Y_AXIS_PADDING`.
const Y_AXIS_PADDING = 0.05;
// CSS-px body / wick widths; DPR scaling happens inside the GPU program
// (Tasks 6–7). Mirrors the canvas2d defaults' intent (thin, TradingView-like).
const CANDLE_BODY_WIDTH_PX = 6;
const CANDLE_WICK_WIDTH_PX = 1;
const PLOT_LINE_WIDTH_PX = 1;
// CSS-px width of a histogram / volume column (DPR scaling happens inside the
// vertical-bars program, Task 10). Mirrors canvas2d's `HISTOGRAM_BAR_WIDTH_PX`.
const HISTOGRAM_BAR_WIDTH_PX = 6;

/**
 * A pane's CSS-pixel rectangle, the layout input `buildFrame` is handed per
 * pane (`paneViewport` in Task 5 turns each into a device-px GL viewport).
 * `buildFrame` itself stays in world space and reads only `paneKey` — the
 * rect is carried through so the caller correlates each
 * {@link PaneRenderState} back to its layout slot.
 *
 * @since 0.1
 * @stable
 * @example
 *     const r: PaneLayoutRect = { paneKey: "overlay", x: 0, y: 0, width: 800, height: 400 };
 *     void r;
 */
export type PaneLayoutRect = {
    readonly paneKey: string;
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
};

// World data x-bounds over the bar run. Returns `[+Inf, -Inf]` for an empty
// run (the caller maps that to the (0, 1) fallback window).
function dataXBounds(bars: ReadonlyArray<Bar>): { min: number; max: number } {
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (const bar of bars) {
        if (bar.time < min) min = bar.time;
        if (bar.time > max) max = bar.time;
    }
    return { min, max };
}

// Widen the world `xMax` so any future-projected (`+k`) series point in this
// pane stays inside the window instead of being clipped past the data edge —
// the world-space analogue of canvas2d's `extendXMaxForShifts`. Uses the
// shared `shiftedBarTime` (world time out), NOT `projectShiftedX` (pixel out),
// because `buildFrame` is world-space. Drawing / glyph future anchors widen in
// Tasks 12–14 (their descriptors are not built here yet).
function extendXMaxForShifts(
    state: AdapterState,
    paneKey: string,
    spacing: number,
    xMax: number,
): number {
    const { bars } = state;
    let extended = xMax;
    const prefix = paneKeyPrefix(paneKey);
    for (const [key, series] of state.plotSeries) {
        if (!key.startsWith(prefix)) continue;
        for (const point of series) {
            if (point.value === null || !Number.isFinite(point.value)) continue;
            if (point.xShift === undefined || point.xShift <= 0) continue;
            const t = shiftedBarTime({ bars, bar: point.bar, xShift: point.xShift, spacing });
            if (t > extended) extended = t;
        }
    }
    return extended;
}

// Auto-fit the pane's y range to the VISIBLE x window (lightweight-charts
// parity): the overlay pane sees bars ∪ its own series; a subpane sees only
// its own series. Horizontal lines span the whole chart, so they fold in
// unconditionally (not x-window filtered) — `yRangeInWindow` excludes no-`x`
// rows, so the caller folds them here. Mirrors canvas2d's `computeYRange`.
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
    for (const [key, series] of state.plotSeries) {
        if (!key.startsWith(prefix)) continue;
        for (const point of series) {
            if (point.value !== null) {
                candidates.push({ x: point.time, lo: point.value, hi: point.value });
            }
            // A `filled-band` point carries its edges instead of `value`.
            if (point.upper != null) {
                candidates.push({ x: point.time, lo: point.upper, hi: point.upper });
            }
            if (point.lower != null) {
                candidates.push({ x: point.time, lo: point.lower, hi: point.lower });
            }
        }
    }
    const windowed = yRangeInWindow(candidates, win);
    let yMin = windowed?.yMin ?? Number.POSITIVE_INFINITY;
    let yMax = windowed?.yMax ?? Number.NEGATIVE_INFINITY;
    for (const hline of state.hlines.values()) {
        if (hline.paneKey !== paneKey) continue;
        if (hline.price < yMin) yMin = hline.price;
        if (hline.price > yMax) yMax = hline.price;
    }
    return { yMin, yMax };
}

// Build the candle bodies + wicks descriptors for the overlay pane. `rows`
// pack world coordinates: bodies `[x, open, high, low, close, isBull]`, wicks
// `[x, low, high, isBull]`. Empty bars ⇒ no candle descriptors.
function buildCandleDescriptors(state: AdapterState): LayerDescriptor[] {
    const { bars } = state;
    if (bars.length === 0) return [];
    const bodies = new Float32Array(bars.length * 6);
    const wicks = new Float32Array(bars.length * 4);
    for (let i = 0; i < bars.length; i++) {
        const bar = bars[i];
        const bull = isBullish(bar) ? 1 : 0;
        const bo = i * 6;
        bodies[bo] = bar.time;
        bodies[bo + 1] = bar.open;
        bodies[bo + 2] = bar.high;
        bodies[bo + 3] = bar.low;
        bodies[bo + 4] = bar.close;
        bodies[bo + 5] = bull;
        const wo = i * 4;
        wicks[wo] = bar.time;
        wicks[wo + 1] = bar.low;
        wicks[wo + 2] = bar.high;
        wicks[wo + 3] = bull;
    }
    const bullColor = hexToRgbaUnit(state.palette.candleBullBody, 1);
    const bearColor = hexToRgbaUnit(state.palette.candleBearBody, 1);
    return [
        {
            id: "overlay:candle-bodies",
            kind: "candle-bodies",
            rows: bodies,
            rowCount: bars.length,
            bullColor,
            bearColor,
            bodyWidthPx: CANDLE_BODY_WIDTH_PX,
        },
        {
            id: "overlay:candle-wicks",
            kind: "candle-wicks",
            rows: wicks,
            rowCount: bars.length,
            wickColor: hexToRgbaUnit(state.palette.candleWick, 1),
            wickWidthPx: CANDLE_WICK_WIDTH_PX,
        },
    ];
}

// Resolve a line-family series' single descriptor color from its last point's
// static color (the per-series color; `colorValue` per-segment recolor is a
// Task-7 concern). Falls back to the palette default. `alpha` (default `1`)
// applies the fill translucency for the area / band bodies.
function seriesColor(series: ReadonlyArray<PlotPoint>, fallback: string, alpha = 1): RgbaUnit {
    const last = series[series.length - 1];
    const resolved = resolvePaintColor(undefined, last.color, fallback);
    // `resolvePaintColor(undefined, ...)` returns `staticColor ?? fallback`,
    // never `null`, so a finite hex is always available.
    return hexToRgbaUnit(resolved ?? fallback, alpha);
}

// Pack a line-family series into a world-space `line-strip` descriptor. Each
// point's world x is its shifted bar time (`shiftedBarTime`); a `null` /
// non-finite value OR a `colorValue:null` gap packs NaN y so the program
// (Task 7) skips the segment.
function buildLineStrip(
    state: AdapterState,
    key: string,
    series: ReadonlyArray<PlotPoint>,
    style: PlotStyle | undefined,
    spacing: number,
): LineStripDescriptor {
    const { bars } = state;
    const raw = new Float32Array(series.length * 2);
    for (let i = 0; i < series.length; i++) {
        const point = series[i];
        const x = shiftedBarTime({ bars, bar: point.bar, xShift: point.xShift, spacing });
        const paint = resolvePaintColor(point.colorValue, point.color, state.palette.plotDefault);
        const gap = point.value === null || !Number.isFinite(point.value) || paint === null;
        raw[i * 2] = x;
        raw[i * 2 + 1] = gap ? Number.NaN : (point.value as number);
    }
    const step = style !== undefined && style.kind === "step-line";
    // Default `line` style smooths into a monotone-cubic curve sampled into
    // denser line-strip points (parity with the other five adapters; WebGL has
    // no native curve). `step-line` stays straight. NaN gaps split runs (the
    // sampler smooths each finite run independently); `xShift` is already
    // applied to the source points above.
    const points = step ? raw : sampleMonotoneRuns(raw, series.length);
    return {
        id: `${key}:line-strip`,
        kind: "line-strip",
        points,
        pointCount: points.length / 2,
        color: seriesColor(series, state.palette.plotDefault),
        widthPx: PLOT_LINE_WIDTH_PX,
        dash: null,
        step,
    };
}

// Pack a `histogram` series into a world-space `vertical-bars` descriptor.
// Each bar's signed `height = value - baseline` grows from the world-`y`
// `baseline` (the program anchors the quad's bottom edge there); `isPositive`
// (`value >= baseline`) drives the bull / bear color. A `null` / non-finite
// value OR a `colorValue:null` gap packs a NaN height so the GPU clips the
// bar (no column that bar). Each point's world x is its shifted bar time
// (`shiftedBarTime`). Mirrors canvas2d's `renderHistogramSeries` baseline math.
function buildVerticalBars(
    state: AdapterState,
    key: string,
    series: ReadonlyArray<PlotPoint>,
    baseline: number,
    spacing: number,
): VerticalBarsDescriptor {
    const { bars } = state;
    const rows = new Float32Array(series.length * 3);
    for (let i = 0; i < series.length; i++) {
        const point = series[i];
        const x = shiftedBarTime({ bars, bar: point.bar, xShift: point.xShift, spacing });
        const paint = resolvePaintColor(point.colorValue, point.color, state.palette.plotDefault);
        const gap = point.value === null || !Number.isFinite(point.value) || paint === null;
        const value = point.value as number;
        const o = i * 3;
        rows[o] = x;
        rows[o + 1] = gap ? Number.NaN : value - baseline;
        rows[o + 2] = !gap && value >= baseline ? 1 : 0;
    }
    return {
        id: `${key}:vertical-bars`,
        kind: "vertical-bars",
        rows,
        rowCount: series.length,
        positiveColor: hexToRgbaUnit(state.palette.candleBullBody, 1),
        negativeColor: hexToRgbaUnit(state.palette.candleBearBody, 1),
        barWidthPx: HISTOGRAM_BAR_WIDTH_PX,
        baseline,
    };
}

// Pack a `filled-band` series into a world-space `filled-band` descriptor.
// Each point carries its per-bar `upper` / `lower` edges (the band geometry IS
// the series); a single `null` edge marks a per-column gap (packed as NaN so
// the GPU run-splitter skips it). Each point's world x is its shifted bar time
// (`shiftedBarTime`). `alpha` is the descriptor's fill translucency. Mirrors
// canvas2d's `renderFilledBandSeries`.
function buildFilledBand(
    state: AdapterState,
    key: string,
    series: ReadonlyArray<PlotPoint>,
    alpha: number,
    spacing: number,
): FilledBandDescriptor {
    const { bars } = state;
    const upper = new Float32Array(series.length * 2);
    const lower = new Float32Array(series.length * 2);
    for (let i = 0; i < series.length; i++) {
        const point = series[i];
        const x = shiftedBarTime({ bars, bar: point.bar, xShift: point.xShift, spacing });
        const hi = point.upper;
        const lo = point.lower;
        const gap = hi == null || lo == null || !Number.isFinite(hi) || !Number.isFinite(lo);
        upper[i * 2] = x;
        upper[i * 2 + 1] = gap ? Number.NaN : (hi as number);
        lower[i * 2] = x;
        lower[i * 2 + 1] = gap ? Number.NaN : (lo as number);
    }
    return {
        id: `${key}:filled-band`,
        kind: "filled-band",
        upper,
        lower,
        pointCount: series.length,
        color: seriesColor(series, state.palette.plotDefault, alpha),
    };
}

// Pack an `area` series' FILL body into a world-space `filled-band` descriptor:
// the band's upper edge is the series value and its lower edge is the pane
// FLOOR (`floorY`, the bottom of the visible window — canvas2d fills the area
// to the pane floor). The area's edge stroke is the sibling `line-strip` built
// alongside; this is the translucent body beneath it. A `null` / non-finite
// value OR a `colorValue:null` gap packs NaN edges so the GPU skips the column.
function buildAreaFill(
    state: AdapterState,
    key: string,
    series: ReadonlyArray<PlotPoint>,
    fillAlpha: number,
    floorY: number,
    spacing: number,
): FilledBandDescriptor {
    const { bars } = state;
    const upper = new Float32Array(series.length * 2);
    const lower = new Float32Array(series.length * 2);
    for (let i = 0; i < series.length; i++) {
        const point = series[i];
        const x = shiftedBarTime({ bars, bar: point.bar, xShift: point.xShift, spacing });
        const paint = resolvePaintColor(point.colorValue, point.color, state.palette.plotDefault);
        const gap = point.value === null || !Number.isFinite(point.value) || paint === null;
        upper[i * 2] = x;
        upper[i * 2 + 1] = gap ? Number.NaN : (point.value as number);
        lower[i * 2] = x;
        lower[i * 2 + 1] = gap ? Number.NaN : floorY;
    }
    return {
        id: `${key}:area-fill`,
        kind: "filled-band",
        upper,
        lower,
        pointCount: series.length,
        color: seriesColor(series, state.palette.plotDefault, fillAlpha),
    };
}

// Pack one horizontal line into a world-space 2-point `line-strip` spanning the
// pane's visible x window at the line's price. Mirrors canvas2d's
// `drawHorizontalLine` intent (a flat line across the chart at `price`); a
// non-solid `lineStyle` dashes via the shared line-strip dash channel. The
// hline folds into the y-range upstream (`computeYRange`), so its price is
// always inside the window. `xShift` never applies (an hline is chart-wide
// state, not a shifted series).
function buildHLine(
    hline: HLine,
    win: PaneWindow,
    fallback: string,
    suffix: number,
): LineStripDescriptor {
    const points = new Float32Array([win.xMin, hline.price, win.xMax, hline.price]);
    return {
        id: `${hline.paneKey}:hline:${suffix}`,
        kind: "line-strip",
        points,
        pointCount: 2,
        color: hexToRgbaUnit(hline.color ?? fallback, 1),
        widthPx: hline.lineWidth > 0 ? hline.lineWidth : HLINE_DEFAULT_WIDTH_PX,
        dash: hline.lineStyle === "solid" ? null : HLINE_DASH,
        step: false,
    };
}

// Collect this pane's plot series + horizontal lines as ordered
// {@link LayerDescriptor}s through the SHARED per-pane z-order pass: line /
// step-line series → `line-strip`, `histogram` series → `vertical-bars`,
// `filled-band` series → `filled-band`, `area` series → `filled-band` FILL +
// its `line-strip` edge, and each `hline` → a flat `line-strip`. Every mark is
// tagged `(z, band, seq)` with the shared `RENDER_BAND` (`series` band for
// plots, `hline` band for horizontal lines) and sorted via the SHARED
// `applyRenderOrder` (no forked comparator), so the GPU draw order matches the
// canvas2d z-pass — default `z = 0` reproduces series → hlines, and a `z`
// override reorders globally within the pane. `floorY` is the pane's
// world-space floor (the bottom of the visible window) the area fill anchors
// to; `win` is the visible window the hlines span. Glyphs / drawings paint on
// the 2D overlay (Tasks 12–13) under the same shared comparator.
function buildPaneLayers(
    state: AdapterState,
    paneKey: string,
    spacing: number,
    floorY: number,
    win: PaneWindow,
): LayerDescriptor[] {
    const prefix = paneKeyPrefix(paneKey);
    const marks: RenderOrderMark<LayerDescriptor>[] = [];
    for (const [key, series] of state.plotSeries) {
        if (!key.startsWith(prefix)) continue;
        if (series.length === 0) continue;
        const style = state.plotSeriesStyle.get(key);
        const last = series[series.length - 1];
        const tag = { z: last.z, band: BAND.series, seq: last.seq };
        if (style !== undefined && style.kind === "histogram") {
            marks.push({
                ...tag,
                payload: buildVerticalBars(state, key, series, style.baseline, spacing),
            });
            continue;
        }
        if (style !== undefined && style.kind === "filled-band") {
            marks.push({
                ...tag,
                payload: buildFilledBand(state, key, series, style.alpha, spacing),
            });
            continue;
        }
        if (style !== undefined && style.kind === "area") {
            // Area = fill body BELOW the edge stroke. Both share the series'
            // (z, band, seq); push the fill first so the stable sort keeps the
            // line on top.
            marks.push({
                ...tag,
                payload: buildAreaFill(state, key, series, style.fillAlpha, floorY, spacing),
            });
            marks.push({ ...tag, payload: buildLineStrip(state, key, series, style, spacing) });
            continue;
        }
        // The line family (line / step-line); any other style is skipped.
        if (style !== undefined && style.kind !== "line" && style.kind !== "step-line") {
            continue;
        }
        marks.push({ ...tag, payload: buildLineStrip(state, key, series, style, spacing) });
    }
    // Horizontal lines ride the `hline` band — after series, before drawings —
    // at the default `z`. A per-hline `suffix` keeps descriptor ids unique.
    let hlineIdx = 0;
    for (const hline of state.hlines.values()) {
        if (hline.paneKey !== paneKey) continue;
        marks.push({
            z: hline.z,
            band: BAND.hline,
            seq: hline.seq,
            payload: buildHLine(hline, win, state.palette.plotDefault, hlineIdx++),
        });
    }
    // The SHARED comparator (stable): the area fill / edge pair share
    // (z, band, seq), so the fill-then-edge push order is preserved.
    return applyRenderOrder(marks);
}

/**
 * Pure state → per-pane render state. For each pane (overlay first), resolve
 * the world x-window through the shared {@link import(
 * "@invinite-org/chartlang-adapter-kit").ViewController} (honouring
 * `initialVisibleBars` auto-follow), auto-fit the y-range to the visible
 * window via the shared `yRangeInWindow` (folding hlines + a ±5% pad), and
 * emit the {@link LayerDescriptor}s the state can express — candles (overlay)
 * + line / step-line / histogram / area / filled-band series — in `(z, seq)`
 * order. Everything stays in WORLD
 * (time, price); Task 5 feeds each pane's `window` to `ortho2d`. No `gl`.
 *
 * Window contract (mirrors the canvas2d reference exactly):
 * - empty bars ⇒ `{xMin:0, xMax:1, yMin:0, yMax:1}`, no layers;
 * - `initialVisibleBars = N` with `len > N` ⇒ `autoFollowXMin =
 *   bars[len-N].time` (frame the most recent N bars; the rest stay
 *   scrollable); else `undefined` (fit all data);
 * - a `+k` series shift past the data edge widens `xMax`;
 * - a degenerate y-range falls back to `(0, 1)`; `yMin === yMax` widens ±1.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { createAdapterState, buildFrame } from "chartlang-example-webgl-adapter";
 *     const state = createAdapterState();
 *     const panes = buildFrame(state, [
 *         { paneKey: "overlay", x: 0, y: 0, width: 800, height: 400 },
 *     ]);
 *     // panes[0].window === { xMin: 0, xMax: 1, yMin: 0, yMax: 1 }
 *     void panes;
 */
export function buildFrame(
    state: AdapterState,
    layoutRects: ReadonlyArray<PaneLayoutRect>,
): PaneRenderState[] {
    const { bars } = state;
    const spacing = medianBarSpacing(bars);
    const panes: PaneRenderState[] = [];
    for (const rect of layoutRects) {
        const { paneKey } = rect;
        const cssRect = {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
        };
        if (bars.length === 0) {
            panes.push({
                paneKey,
                window: { xMin: 0, xMax: 1, yMin: 0, yMax: 1 },
                cssRect,
                layers: [],
            });
            continue;
        }
        const { min: dataXMin, max: rawXMax } = dataXBounds(bars);
        const dataXMax = extendXMaxForShifts(state, paneKey, spacing, rawXMax);
        // The controller returns the auto-follow window until the user
        // zooms/pans, then the held window. `initialVisibleBars` frames the
        // most recent N bars by default (the rest stay scrollable).
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
        // The pane's world-space floor (bottom of the visible window) the
        // `area` fill bodies anchor to (canvas2d fills the area to the pane
        // floor).
        const floorY = yMin - yPad;
        // The pane's resolved world window (the rectangle Task 5 feeds to
        // `ortho2d`). Built before the layers so the hline line-strips span the
        // same visible x window the pane paints.
        const paneWindow: PaneWindow = {
            xMin: win.xMin,
            xMax: win.xMax === win.xMin ? win.xMin + 1 : win.xMax,
            yMin: yMin - yPad,
            yMax: yMax + yPad,
        };
        const layers: LayerDescriptor[] = [];
        if (paneKey === "overlay") {
            layers.push(...buildCandleDescriptors(state));
        }
        layers.push(...buildPaneLayers(state, paneKey, spacing, floorY, paneWindow));
        panes.push({
            paneKey,
            window: paneWindow,
            cssRect,
            layers,
        });
    }
    return panes;
}
