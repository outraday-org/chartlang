// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import {
    type PlotStyle,
    type WindowYInput,
    type XWindow,
    yRangeInWindow,
} from "@invinite-org/chartlang-adapter-kit";
import type { Bar } from "@invinite-org/chartlang-core";

import { formatTime } from "./axes.js";
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
import { computeBarWidthPx } from "./webgl/lib/bar-width-formula.js";
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
// CSS-px MAX ceiling for the candle body / vertical-bar width. The actual
// width tracks the on-screen bar pitch via the shared TradingView
// `computeBarWidthPx` formula (so bars shrink to avoid OVERLAP when zoomed out,
// and never exceed this ceiling when zoomed in). DPR scaling happens inside the
// GPU program (Tasks 6–7 / 10). `6` keeps the zoomed-in look thin + TradingView-
// like, matching the canvas2d defaults' intent.
const CANDLE_BODY_MAX_WIDTH_PX = 6;
const CANDLE_WICK_WIDTH_PX = 1;
const PLOT_LINE_WIDTH_PX = 1;
// CSS-px MAX ceiling for a histogram / volume column (same pitch-aware sizing).
const HISTOGRAM_BAR_MAX_WIDTH_PX = 6;

// Resolve the on-screen bar pitch (CSS px between adjacent bar centres) from
// the world bar `spacing`, the pane's visible world x-window, and its CSS-px
// width: pitch = (spacing / windowSpan) × paneWidthPx. Returns `Infinity` for a
// degenerate window (the formula then floors the width to its ceiling).
function barPitchCssPx(spacing: number, win: PaneWindow, paneWidthPx: number): number {
    const span = win.xMax - win.xMin;
    if (!(span > 0) || !(spacing > 0)) return Number.POSITIVE_INFINITY;
    return (spacing / span) * paneWidthPx;
}

function barX(barIndex: number, xShift?: number): number {
    return barIndex + (xShift ?? 0);
}

function barTimeFormatter(bars: ReadonlyArray<Bar>): (time: number, span: number) => string {
    const last = bars.length - 1;
    const spanMs = last > 0 ? bars[last].time - bars[0].time : 0;
    return (time) => {
        const index = Math.min(last, Math.max(0, Math.round(time)));
        return formatTime(bars[index]?.time ?? time, spanMs);
    };
}

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
    return bars.length === 0
        ? { min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY }
        : { min: 0, max: bars.length - 1 };
}

// Widen the world `xMax` so any future-projected (`+k`) series point in this
// pane stays inside the window instead of being clipped past the data edge —
// the world-space analogue of canvas2d's `extendXMaxForShifts`. WebGL uses
// compressed bar slots as world x values, so `+2` from bar 10 resolves to slot
// 12 even when calendar days are missing from the source data.
function extendXMaxForShifts(state: AdapterState, paneKey: string, xMax: number): number {
    let extended = xMax;
    const prefix = paneKeyPrefix(paneKey);
    for (const [key, series] of state.plotSeries) {
        if (!key.startsWith(prefix)) continue;
        for (const point of series) {
            if (point.value === null || !Number.isFinite(point.value)) continue;
            if (point.xShift === undefined || point.xShift <= 0) continue;
            const t = barX(point.bar, point.xShift);
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
        for (let i = 0; i < state.bars.length; i++) {
            const bar = state.bars[i];
            candidates.push({ x: i, lo: bar.low, hi: bar.high });
        }
    }
    const prefix = paneKeyPrefix(paneKey);
    for (const [key, series] of state.plotSeries) {
        if (!key.startsWith(prefix)) continue;
        for (const point of series) {
            if (point.value !== null) {
                candidates.push({
                    x: barX(point.bar, point.xShift),
                    lo: point.value,
                    hi: point.value,
                });
            }
            // A `filled-band` point carries its edges instead of `value`.
            if (point.upper != null) {
                candidates.push({
                    x: barX(point.bar, point.xShift),
                    lo: point.upper,
                    hi: point.upper,
                });
            }
            if (point.lower != null) {
                candidates.push({
                    x: barX(point.bar, point.xShift),
                    lo: point.lower,
                    hi: point.lower,
                });
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
// `[x, low, high, isBull]`. `bodyWidthPx` is the pitch-resolved body width (so
// bodies never overlap when zoomed out). Empty bars ⇒ no candle descriptors.
function buildCandleDescriptors(state: AdapterState, bodyWidthPx: number): LayerDescriptor[] {
    const { bars } = state;
    if (bars.length === 0) return [];
    const bodies = new Float32Array(bars.length * 6);
    const wicks = new Float32Array(bars.length * 4);
    for (let i = 0; i < bars.length; i++) {
        const bar = bars[i];
        const bull = isBullish(bar) ? 1 : 0;
        const bo = i * 6;
        bodies[bo] = i;
        bodies[bo + 1] = bar.open;
        bodies[bo + 2] = bar.high;
        bodies[bo + 3] = bar.low;
        bodies[bo + 4] = bar.close;
        bodies[bo + 5] = bull;
        const wo = i * 4;
        wicks[wo] = i;
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
            bodyWidthPx,
        },
        {
            id: "overlay:candle-wicks",
            kind: "candle-wicks",
            rows: wicks,
            rowCount: bars.length,
            // Wicks share the body's bull/bear colour so each wick matches its
            // candle's direction (the per-bar `isBull` flag picks one in-shader).
            bullColor,
            bearColor,
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
// point's world x is its shifted compressed bar slot; a `null` / non-finite
// value OR a `colorValue:null` gap packs NaN y so the program (Task 7) skips
// the segment.
function buildLineStrip(
    state: AdapterState,
    key: string,
    series: ReadonlyArray<PlotPoint>,
    style: PlotStyle | undefined,
): LineStripDescriptor {
    const raw = new Float32Array(series.length * 2);
    for (let i = 0; i < series.length; i++) {
        const point = series[i];
        const x = barX(point.bar, point.xShift);
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
// bar (no column that bar). Each point's world x is its shifted compressed bar
// slot. Mirrors canvas2d's `renderHistogramSeries` baseline math.
function buildVerticalBars(
    state: AdapterState,
    key: string,
    series: ReadonlyArray<PlotPoint>,
    baseline: number,
    barWidthPx: number,
): VerticalBarsDescriptor {
    const rows = new Float32Array(series.length * 3);
    for (let i = 0; i < series.length; i++) {
        const point = series[i];
        const x = barX(point.bar, point.xShift);
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
        barWidthPx,
        baseline,
    };
}

// Pack a `filled-band` series into a world-space `filled-band` descriptor.
// Each point carries its per-bar `upper` / `lower` edges (the band geometry IS
// the series); a single `null` edge marks a per-column gap (packed as NaN so
// the GPU run-splitter skips it). Each point's world x is its shifted compressed
// bar slot. `alpha` is the descriptor's fill translucency. Mirrors canvas2d's
// `renderFilledBandSeries`.
function buildFilledBand(
    state: AdapterState,
    key: string,
    series: ReadonlyArray<PlotPoint>,
    alpha: number,
): FilledBandDescriptor {
    const upper = new Float32Array(series.length * 2);
    const lower = new Float32Array(series.length * 2);
    for (let i = 0; i < series.length; i++) {
        const point = series[i];
        const x = barX(point.bar, point.xShift);
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
): FilledBandDescriptor {
    const upper = new Float32Array(series.length * 2);
    const lower = new Float32Array(series.length * 2);
    for (let i = 0; i < series.length; i++) {
        const point = series[i];
        const x = barX(point.bar, point.xShift);
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
    floorY: number,
    win: PaneWindow,
    barWidthPx: number,
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
                payload: buildVerticalBars(state, key, series, style.baseline, barWidthPx),
            });
            continue;
        }
        if (style !== undefined && style.kind === "filled-band") {
            marks.push({
                ...tag,
                payload: buildFilledBand(state, key, series, style.alpha),
            });
            continue;
        }
        if (style !== undefined && style.kind === "area") {
            // Area = fill body BELOW the edge stroke. Both share the series'
            // (z, band, seq); push the fill first so the stable sort keeps the
            // line on top.
            marks.push({
                ...tag,
                payload: buildAreaFill(state, key, series, style.fillAlpha, floorY),
            });
            marks.push({ ...tag, payload: buildLineStrip(state, key, series, style) });
            continue;
        }
        // The line family (line / step-line); any other style is skipped.
        if (style !== undefined && style.kind !== "line" && style.kind !== "step-line") {
            continue;
        }
        marks.push({ ...tag, payload: buildLineStrip(state, key, series, style) });
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
 * order. Everything stays in WORLD (compressed bar slot, price); Task 5 feeds
 * each pane's `window` to `ortho2d`. No `gl`.
 *
 * Window contract (mirrors the canvas2d reference exactly):
 * - empty bars ⇒ `{xMin:0, xMax:1, yMin:0, yMax:1}`, no layers;
 * - `initialVisibleBars = N` with `len > N` ⇒ `autoFollowXMin = len - N`
 *   (frame the most recent N bars; the rest stay scrollable); else
 *   `undefined` (fit all data);
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
    const spacing = 1;
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
        const dataXMax = extendXMaxForShifts(state, paneKey, rawXMax);
        // The controller returns the auto-follow window until the user
        // zooms/pans, then the held window. `initialVisibleBars` frames the
        // most recent N bars by default (the rest stay scrollable).
        const n = state.initialVisibleBars;
        const autoFollowXMin =
            n !== undefined && n > 0 && bars.length > n ? bars.length - n : undefined;
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
        // Resolve the bar pitch (CSS px) from the visible window + pane width,
        // then size candle bodies / vertical bars to it via the shared
        // TradingView formula — bars shrink to avoid OVERLAP when zoomed out and
        // cap at their CSS-px ceiling when zoomed in (the wick keeps its own 1-px
        // width). Mirrors invinite's `computeBarWidthPx(barPitchPx, …)`.
        const pitchPx = barPitchCssPx(spacing, paneWindow, cssRect.width);
        const bodyWidthPx = computeBarWidthPx(pitchPx, {
            maxWidthPx: CANDLE_BODY_MAX_WIDTH_PX,
            wickClearancePx: 1,
        });
        const barWidthPx = computeBarWidthPx(pitchPx, {
            maxWidthPx: HISTOGRAM_BAR_MAX_WIDTH_PX,
            wickClearancePx: 0,
        });
        const layers: LayerDescriptor[] = [];
        if (paneKey === "overlay") {
            layers.push(...buildCandleDescriptors(state, bodyWidthPx));
        }
        layers.push(...buildPaneLayers(state, paneKey, floorY, paneWindow, barWidthPx));
        panes.push({
            paneKey,
            window: paneWindow,
            cssRect,
            timeFormatter: barTimeFormatter(bars),
            layers,
        });
    }
    return panes;
}
