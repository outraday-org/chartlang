// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import {
    type Adapter,
    type AlertConditionEmission,
    type AlertEmission,
    type CandleEvent,
    type Capabilities,
    type DrawingEmission,
    type LogEmission,
    type PlotEmission,
    type PlotStyle,
    RENDER_BAND,
    type RenderOrderKey,
    type RunnerEmissions,
    type Viewport,
    decomposeDrawing,
    defineAdapter,
    medianBarSpacing,
    priceToY,
    shiftedBarIndex,
    shiftedBarTime,
    sortByRenderOrder,
    timeToX,
    validateEmission,
} from "@invinite-org/chartlang-adapter-kit";
import type { Bar, LineStyle } from "@invinite-org/chartlang-core";
import {
    type ScriptHost,
    type WorkerLike,
    createWorkerHost,
} from "@invinite-org/chartlang-host-worker";
import type {
    BarSeriesOption,
    EChartsOption,
    LineSeriesOption,
    SeriesOption,
} from "echarts/types/dist/echarts";

import { ECHARTS_CAPABILITIES, ECHARTS_SYM_INFO } from "./capabilities.js";
import {
    type EChartsGraphicElement,
    type GlyphMarkerShape,
    type GraphicPathStyle,
    glyphMarkerGraphic,
    primitiveIsFinite,
    primitiveToGraphic,
} from "./primitiveToGraphic.js";
import type { EChartsSurface } from "./types.js";
import { type ZoomWindow, buildViewport } from "./viewport.js";

const DEFAULT_INTERVAL = "1D";
const MAX_RECENT_ALERTS = 256;
// ECharts category-axis gap sentinel for a missing value (renders a line
// break, exactly like canvas2d skipping a `null` / non-finite point).
const GAP = "-";
const DEFAULT_BG_COLOR = "#0b0e11";
const DEFAULT_LINE_COLOR = "#3b82f6";
// Candle body colours, pinned to the canvas2d reference palette so the two
// adapters look like one product (bull green / bear red). ECharts' candlestick
// `itemStyle` keys the UP body on `color`/`borderColor` and the DOWN body on
// `color0`/`borderColor0`; relying on the library default would tint candles
// with ECharts' stock red/green instead.
const CANDLE_BULL_COLOR = "#26a69a";
const CANDLE_BEAR_COLOR = "#ef5350";
// A volume-profile (`horizontal-histogram`) bucket renders as a left-anchored
// horizontal bar: the longest bucket spans `HHIST_MAX_WIDTH_PX` and each row is
// `HHIST_ROW_HEIGHT_PX` tall. Mirrors the konva adapter's per-bucket geometry.
const HHIST_MAX_WIDTH_PX = 80;
const HHIST_ROW_HEIGHT_PX = 4;

// Grid (plotting-area) margins, in CSS px. The price axis sits on the RIGHT
// (house convention), so the label gutter is reserved there and the left
// margin is minimal. Shared by `buildOption`'s `grid` and the screen-space
// `table` viewport so the HUD lands inside the plot, clear of the axis.
const GRID_LEFT_PX = 16;
const GRID_RIGHT_PX = 56;

/**
 * Constructor options for {@link createEChartsAdapter}. The `host`/`workerLike`
 * fields exist as test seams: production callers leave them undefined and the
 * adapter spins up a real Web Worker via {@link createWorkerHost}; tests inject
 * a `MessageChannel`-backed `WorkerLike` or a pre-built `ScriptHost` directly.
 * `echartsFactory` lets tests supply an {@link EChartsSurface} mock; production
 * callers pass a factory that returns `echarts.init(container)`.
 *
 * @since 1.4
 * @stable
 * @example
 *     import type { CreateEChartsAdapterOpts } from "chartlang-example-echarts-adapter";
 *     import { mockCandleSource } from "@invinite-org/chartlang-adapter-kit";
 *     const opts: CreateEChartsAdapterOpts = {
 *         echartsFactory: () => ({
 *             setOption() {},
 *             resize() {},
 *             dispose() {},
 *         }),
 *         candleSource: mockCandleSource([]),
 *     };
 *     void opts;
 */
export type CreateEChartsAdapterOpts = {
    /**
     * Factory returning the ECharts instance the adapter drives. Production
     * callers pass `() => echarts.init(container)`; tests pass `() => new
     * MockECharts()`. Required — ECharts needs a DOM container + sizing the
     * adapter does not own, so unlike canvas2d there is no implicit
     * `getContext` fallback.
     */
    readonly echartsFactory: () => EChartsSurface;
    readonly candleSource: AsyncIterable<CandleEvent>;
    readonly capabilities?: Capabilities;
    readonly interval?: string;
    /**
     * Default visible window: when set, the chart opens framed on only the most
     * recent N bars (rest stay scrollable via the dataZoom); omit = fit all
     * data, unchanged.
     */
    readonly initialVisibleBars?: number;
    readonly backgroundColor?: string;
    readonly resolveInputs?: (scriptId: string) => Readonly<Record<string, unknown>>;
    readonly onAlert?: (a: AlertEmission) => void;
    readonly host?: ScriptHost;
    readonly workerLike?: WorkerLike;
};

/**
 * Public handle the consumer drives. `host` is exposed so callers can
 * `await adapter.host.load(compiled)` before invoking
 * {@link runEChartsLoop}.
 *
 * @since 1.4
 * @stable
 * @example
 *     import type { EChartsAdapterHandle } from "chartlang-example-echarts-adapter";
 *     declare const adapter: EChartsAdapterHandle;
 *     // await adapter.host.load(compiled);
 *     void adapter;
 */
export type EChartsAdapterHandle = Adapter & { readonly host: ScriptHost };

// A stored line/area/histogram series point, aligned to its bar index so the
// option builder can scatter it into a per-bar data array (gaps become `GAP`).
// `xShift` is the universal `ta` `offset` (signed integer bars; `+n` displaces
// the point right / future, `−n` left / past) — the point's VALUE is unchanged,
// only the category column it occupies (`shiftedBarIndex(bar, xShift)`). Omitted
// for an unshifted point so a no-offset frame is byte-identical to the pre-shift
// data. `style` is captured only for `filled-band`, whose per-bar `upper`/`lower`
// bounds ride the emission's style (not its `value`); other kinds leave it
// undefined and the series-level style governs.
type SeriesPoint = {
    readonly bar: number;
    readonly value: number | null;
    readonly color: string | null;
    readonly xShift?: number;
    readonly style?: PlotStyle;
    // The per-bar dynamic-color channel for the line family (`line` /
    // `step-line` / `area`), under the normative `PlotEmission.colorValue`
    // 3-state contract: omitted ⇒ the series static colour; a string ⇒ that
    // bar's segment override; `null` ⇒ an explicit paint-nothing gap. Omitted
    // for a no-`colorValue` point so an unshifted/uncoloured frame's stored
    // point — and the option tree + its hash — is byte-identical to before.
    readonly colorValue?: string | null;
};

// The plot-style subset that becomes a native `series` entry in `buildOption`.
// EXCLUDED kinds are handled elsewhere: `horizontal-line` (a `markLine`), the
// candle-state overrides (`candle-override` / `bar-override` / `bar-color` →
// per-bar `itemStyle`) and `bg-color` (a `markArea` band) in `applyPlot`; the
// five glyph kinds (`label` / `marker` / `shape` / `character` / `arrow`) render
// as native `graphic` elements (`buildGlyphGraphics`), NOT a series. So the
// `buildOption` series switch stays exhaustive over exactly the series-producing
// kinds. Glyph + horizontal-histogram kinds are still BUFFERED in `state.series`
// (so xShift / last-write style / z carry through) — they just don't emit a
// series in the switch; their renderers read `state.series` directly.
type SeriesStyle = Exclude<
    PlotStyle,
    {
        kind:
            | "horizontal-line"
            | "candle-override"
            | "bar-override"
            | "bg-color"
            | "bar-color"
            | "label"
            | "marker"
            | "shape"
            | "character"
            | "arrow";
    }
>;

// The glyph plot styles, rendered as native `graphic` elements. Buffered in
// `state.series` like a series, but read by `buildGlyphGraphics` instead of the
// `buildOption` series switch.
type GlyphStyle = Extract<
    PlotStyle,
    { kind: "label" | "marker" | "shape" | "character" | "arrow" }
>;

// A stored series carries either a series-producing style or a glyph style. The
// store is keyed by `${pane}|${slotId}`; `buildOption` (series) reads only the
// series-producing styles, `buildGlyphGraphics` only the glyph styles.
type StoredStyle = SeriesStyle | GlyphStyle;

type StoredSeries = {
    readonly style: StoredStyle;
    points: SeriesPoint[];
    z: number;
    // Global ingest order (declaration order) of the LAST point — the z-sort's
    // tiebreaker after `(z, band)`. Last-write-wins, like `style` / `z`.
    seq: number;
};

type StoredHLine = {
    readonly price: number;
    readonly color: string | null;
    readonly paneKey: string;
};

// A candlestick per-bar style override, keyed by bar time. Last-write-wins per
// bar. `bar-override` / `bar-color` resolve to a FLAT colour at ingest (they are
// direction-independent). `candle-override` is DIRECTION-resolved at render time
// (`buildOption`) — the bar's own up/down/doji decides bull/bear/doji — so it
// stores the whole palette, not a single colour (the bar's OHLC may not yet be
// in `state.bars` at ingest).
type CandleStyle =
    | { readonly kind: "flat"; readonly color: string }
    | {
          readonly kind: "direction";
          readonly bull: string;
          readonly bear: string;
          readonly doji?: string;
      };

// A per-bar `bg-color` vertical band, keyed by bar time. `color` is the
// resolved per-bar paint (the `colorValue`/`style.color` precedence is settled
// at ingest); `transp` is the IR transparency (0 opaque … 100 fully
// transparent). Last-write-wins per bar; an explicit `colorValue: null` deletes
// the bar's entry (paint nothing this bar).
type BgBand = { readonly color: string; readonly transp: number | undefined };

type AdapterState = {
    readonly chart: EChartsSurface;
    readonly backgroundColor: string;
    readonly bars: Bar[];
    // Distinct pane keys in first-emit order; `"overlay"` is always at index
    // 0. Each pane maps to one ECharts `grid` + x/y axis pair.
    paneOrder: string[];
    // Keyed by `${paneKey}|${slotId}` so the same callsite can land in
    // different panes and a pane's y-scale only sees its own series.
    readonly series: Map<string, StoredSeries>;
    // Keyed by slotId (last-write-wins).
    readonly hlines: Map<string, StoredHLine>;
    // Per-bar candlestick body colour override, keyed by bar time.
    readonly candleStyles: Map<number, CandleStyle>;
    // Per-bar `bg-color` vertical bands, keyed by bar time. Rendered as a
    // candlestick `markArea` (one xAxis-interval item per band) — NOT the
    // whole-chart background. Adjacent bars with different colours produce
    // adjacent translucent stripes.
    readonly bgBands: Map<number, BgBand>;
    readonly recentAlerts: AlertEmission[];
    readonly currentAlertConditions: AlertConditionEmission[];
    readonly recentLogs: LogEmission[];
    // Drawings are buffered here for the `graphic`-path renderer.
    readonly drawings: Map<string, DrawingEmission>;
    // Global declaration order (ingest order) of each live drawing, keyed by
    // `handleId` — the z-sort's `(z, band, seq)` tiebreaker. Drawings keep the
    // raw emission (which carries `z` but not `seq`), so the seq rides this
    // parallel map, written in lockstep with `drawings`.
    readonly drawingSeq: Map<string, number>;
    // Monotonic ingest counter: each stored plot series / live drawing takes the
    // next value as its `seq` so the shared z-sort's `(z, band, seq)` order is
    // total and deterministic (declaration order = script order).
    seq: number;
    // The user's `dataZoom` window in percent (0–100). Carried across the
    // per-drain `setOption(notMerge:true)` rebuild — which would otherwise
    // reset zoom to 0/100 — by reading the live values back before each
    // rebuild. Stay 0/100 (full, auto-follow) until the user zooms/pans.
    zoomStart: number;
    zoomEnd: number;
    // When set, the INITIAL `dataZoom` window frames only the most recent N
    // bars instead of the full range. Applied exactly ONCE (gated by
    // `hasSeededZoom`) when bars first become available; thereafter the user's
    // live window wins and is never reset by the seed.
    readonly initialVisibleBars?: number;
    // Has the initial windowed zoom already been seeded? Stays `false` until
    // the first frame WITH bars applies the `initialVisibleBars` window, then
    // flips so later frames track the user's window untouched.
    hasSeededZoom: boolean;
    // Has the first laid-out frame been re-projected? `convertToPixel` THROWS
    // before the chart's first layout, so any graphic in the first frame is
    // projected against the fallback viewport; one re-apply after that frame
    // re-projects against the real grid pixels. The demo's static history is a
    // single frame, so without it the only frame is the pre-layout one.
    hasReprojected: boolean;
};

function paneSlotKey(paneKey: string, slotId: string): string {
    return `${paneKey}|${slotId}`;
}

const HANDLE_STATE: WeakMap<EChartsAdapterHandle, AdapterState> = new WeakMap();
const HANDLE_INTERVAL: WeakMap<EChartsAdapterHandle, string> = new WeakMap();

// Deterministic grid/axis index for a pane: overlay is always 0, subpanes
// follow their first-emit order in `paneOrder`. `applyPlot` pushes every
// non-overlay pane onto `paneOrder` before it stores a series / hline for that
// pane, so a lookup miss is impossible — the `0` fallback is purely defensive.
function gridIndexOf(state: AdapterState, paneKey: string): number {
    const idx = state.paneOrder.indexOf(paneKey);
    /* v8 ignore next -- lockstep with applyPlot's paneOrder push; -1 never taken */
    return idx < 0 ? 0 : idx;
}

// Map a stored series' aligned points onto a full per-bar data array, with
// `GAP` for missing / non-finite bars so ECharts breaks the line. The value is
// written at the point's SHIFTED category column (`shiftedBarIndex(bar,
// xShift)`) — `+k` lands in one of the synthetic future slots the caller
// appended (so `barCount` is already extended by the max positive shift), and a
// negative index is clipped (no negative category). `xShift` omitted / `0`
// resolves to the bar's own index, byte-identical to the pre-offset data.
function seriesData(points: ReadonlyArray<SeriesPoint>, barCount: number): Array<number | string> {
    const data: Array<number | string> = new Array(barCount).fill(GAP);
    for (const point of points) {
        const index = shiftedBarIndex(point.bar, point.xShift);
        if (index < 0 || index >= barCount) continue;
        if (point.value === null || !Number.isFinite(point.value)) continue;
        data[index] = point.value;
    }
    return data;
}

// Map a presentation `z` (emission `z ?? 0`) onto an ECharts `zlevel` band.
// ECharts paints all `series` first, then all `graphic` on top (separate render
// systems); numeric `z` only orders WITHIN a system, so to push a drawing's
// `graphic` BELOW a series — or lift a series ABOVE a drawing's graphic — the
// cross-system `zlevel` is the only lever (lower zlevel renders underneath). A
// `z < 0` mark sinks to `zlevel: -1`, a `z > 0` mark rises to `zlevel: +1`, and
// the default `z === 0` stays at `zlevel: 0` (the spread below OMITS it, so a
// no-z frame is byte-identical to the pre-z option tree). This is a 3-band
// granularity: within ONE zlevel echarts still can't interleave graphic &
// series arbitrarily, but it satisfies the wire contract's `z < 0 ⇒ beneath
// plots` / `z > 0 ⇒ above drawings` levers (see the adapter `CLAUDE.md`).
function zlevelFor(z: number): number {
    return z < 0 ? -1 : z > 0 ? 1 : 0;
}

// Spread the `zlevel` key onto an option element ONLY when it is non-default,
// keeping the default-z option tree (and its pinned hash) untouched.
function zlevelSpread(z: number): { readonly zlevel?: number } {
    const level = zlevelFor(z);
    return level === 0 ? {} : { zlevel: level };
}

// The series' colour is its most-recent point's colour, falling back to the
// adapter default — mirroring canvas2d's last-write-wins style resolution.
function seriesColor(series: StoredSeries): string {
    for (let i = series.points.length - 1; i >= 0; i -= 1) {
        const color = series.points[i].color;
        if (color !== null) return color;
    }
    return DEFAULT_LINE_COLOR;
}

// The line-family styles (`line` / `step-line` / `area`) all carry a stroke
// `lineWidth` + a `LineStyle` dash. `lineSeries` is only ever called for those
// three kinds; this narrows to the carrier so the width + dash forward into the
// ECharts `lineStyle`. (`SeriesStyle` is broader; the candle / hline / bg kinds
// never reach `lineSeries`.)
type LineFamilyStyle = Extract<SeriesStyle, { kind: "line" | "step-line" | "area" }>;

// Map the IR stroke (`lineWidth` + `LineStyle` dash, both shared with the canvas
// adapters) onto the ECharts `lineStyle` bag. `LineStyle` ("solid"/"dashed"/
// "dotted") is byte-identical to ECharts' `lineStyle.type`, so it forwards
// directly — no translation table. `cap`/`join` are pinned to `"round"` so
// plotted lines render with smooth, rounded segment joins and end caps.
function echartsLineStyle(
    style: LineFamilyStyle,
    color: string,
): {
    readonly color: string;
    readonly width: number;
    readonly type: LineStyle;
    readonly cap: "round";
    readonly join: "round";
} {
    return { color, width: style.lineWidth, type: style.lineStyle, cap: "round", join: "round" };
}

// Build one line-family `LineSeriesOption`. `color` is the run's resolved paint
// (the static series colour for a no-`colorValue` series, or the per-run colour
// when `colorValue` split the series); `data` is the run's per-bar array. The
// caller (`lineSeriesRuns`) owns the run split + the byte-identical single-run
// fast path; this stays a pure shape builder.
function lineSeries(
    name: string,
    series: StoredSeries,
    style: LineFamilyStyle,
    grid: number,
    extra: Partial<LineSeriesOption>,
    color: string,
    data: Array<number | string>,
): LineSeriesOption {
    return {
        type: "line",
        name,
        xAxisIndex: grid,
        yAxisIndex: grid,
        showSymbol: false,
        connectNulls: false,
        // Plain `line` plots render as a smooth curve so an MA line reads as a
        // curve rather than a faceted polyline; step-lines (which set
        // `step: "end"` via `extra`) keep their hard knees.
        smooth: style.kind === "line",
        lineStyle: echartsLineStyle(style, color),
        itemStyle: { color },
        data,
        z: series.z,
        ...zlevelSpread(series.z),
        ...extra,
    };
}

// Resolve a line-family point's per-bar paint under the normative
// `PlotEmission.colorValue` 3-state contract (mirrors the canvas2d Task-3
// reference `resolvePaintColor` — the same precedence `applyPlot` already
// inlines for `bg-color` / `bar-color`, kept local because echarts uses native
// series, not a `/canvas` sink): omitted ⇒ the series static colour; a string ⇒
// that bar's segment override; `null` ⇒ a paint-nothing gap. A finite `value`
// with a `null` colorValue is still a gap for PAINT only — the value already
// folded into the series `data` for the y-scale via `seriesData`.
function resolveLinePointColor(point: SeriesPoint, staticColor: string): string | null {
    return point.colorValue === undefined ? staticColor : point.colorValue;
}

// One consecutive same-paint RUN of a line-family series: the colour every
// point in the run paints with, and the per-bar data array (only this run's
// bars finite, the rest `GAP`) so the run's `LineSeriesOption` strokes exactly
// its own span. A `null`-colorValue bar (paint-nothing gap) or an explicit
// colour change breaks the run.
type LineRun = { readonly color: string; readonly data: Array<number | string> };

// Split a line-family series' points into consecutive same-paint runs, honouring
// the per-bar `colorValue` 3-state. With NO `colorValue` on any point every bar
// resolves to the uniform `staticColor`, yielding a SINGLE run whose data equals
// `seriesData(points, barCount)` — byte-identical to the pre-feature single
// series. A run breaks on a paint-nothing gap (`null`) or an explicit colour
// change; a finite value still folds into whichever run paints its bar.
function lineRuns(
    points: ReadonlyArray<SeriesPoint>,
    barCount: number,
    staticColor: string,
): LineRun[] {
    const runs: LineRun[] = [];
    let current: { color: string; data: Array<number | string> } | undefined;
    for (const point of points) {
        const index = shiftedBarIndex(point.bar, point.xShift);
        if (index < 0 || index >= barCount) continue;
        if (point.value === null || !Number.isFinite(point.value)) continue;
        const color = resolveLinePointColor(point, staticColor);
        // A `null` colorValue is a paint-nothing gap: the value already folded
        // into the y-scale (`seriesData`), but no run paints it — close the run.
        if (color === null) {
            current = undefined;
            continue;
        }
        if (current === undefined || current.color !== color) {
            current = { color, data: new Array<number | string>(barCount).fill(GAP) };
            runs.push(current);
        }
        current.data[index] = point.value;
    }
    return runs;
}

// Emit one `LineSeriesOption` per same-paint run of a line-family series. A
// series with no per-bar `colorValue` collapses to a single run named exactly
// `name` with `data === seriesData(...)`, byte-identical to the pre-feature
// single series. When colorValue splits the series, each run after the first
// takes a `#run${i}` name suffix so the option tree's series names stay unique.
// `area` keeps its `areaStyle`, `step-line` its `step:"end"` (via `extra`), and
// each run carries its own resolved colour in `lineStyle`/`itemStyle`.
function lineSeriesRuns(
    name: string,
    series: StoredSeries,
    style: LineFamilyStyle,
    barCount: number,
    grid: number,
    extra: Partial<LineSeriesOption>,
): LineSeriesOption[] {
    const staticColor = seriesColor(series);
    const runs = lineRuns(series.points, barCount, staticColor);
    // No finite points at all (every bar a gap): emit the single empty-data
    // series the pre-feature path produced (so a fully-gapped series still
    // contributes its placeholder, matching `seriesData`'s all-`GAP` array).
    if (runs.length === 0) {
        return [
            lineSeries(
                name,
                series,
                style,
                grid,
                extra,
                staticColor,
                seriesData(series.points, barCount),
            ),
        ];
    }
    return runs.map((run, i) =>
        lineSeries(
            i === 0 ? name : `${name}#run${i}`,
            series,
            style,
            grid,
            extra,
            run.color,
            run.data,
        ),
    );
}

function barSeries(
    name: string,
    series: StoredSeries,
    barCount: number,
    grid: number,
): BarSeriesOption {
    return {
        type: "bar",
        name,
        xAxisIndex: grid,
        yAxisIndex: grid,
        itemStyle: { color: seriesColor(series) },
        data: seriesData(series.points, barCount),
        z: series.z,
        ...zlevelSpread(series.z),
    };
}

// `filled-band` keeps each bar's `upper`/`lower` on that emission's STYLE (not
// its `value`), so the band bounds are read from the per-point captured style
// and scattered onto a per-bar data array. `pick` returns the bar's
// contribution; a `null` bound (a per-bar gap) or a non-`filled-band` /
// missing style becomes a `GAP`.
function bandData(
    points: ReadonlyArray<SeriesPoint>,
    barCount: number,
    pick: (style: Extract<PlotStyle, { kind: "filled-band" }>) => number | null,
): Array<number | string> {
    const data: Array<number | string> = new Array(barCount).fill(GAP);
    for (const point of points) {
        const index = shiftedBarIndex(point.bar, point.xShift);
        if (index < 0 || index >= barCount) continue;
        const style = point.style;
        if (style === undefined || style.kind !== "filled-band") continue;
        const bound = pick(style);
        if (bound === null || !Number.isFinite(bound)) continue;
        data[index] = bound;
    }
    return data;
}

// One render-order-tagged batch of `graphic` elements: a single drawing, a
// single glyph point, or a single horizontal-histogram series' buckets. The
// `(z, band, seq)` key drives the shared z-sort; `zlevel` (derived from `z`)
// lifts/sinks the whole batch across the series/graphic boundary.
type GraphicMark = RenderOrderKey & { readonly elements: ReadonlyArray<EChartsGraphicElement> };

// A `graphic` element that may also carry an ECharts `zlevel`. The narrow
// element union has no `zlevel`; widening it here (still structurally assignable
// to ECharts' loose graphic option) lets a z-bearing batch sink/rise across the
// series boundary.
type EChartsGraphicElementZ = EChartsGraphicElement & { readonly zlevel?: number };

// Decompose every live drawing against the chart's viewport into render-ordered
// `graphic` batches. `op:"remove"` drawings are already dropped from
// `state.drawings` by `applyDrawing`, so only live drawings are seen here.
// Non-finite primitives are filtered out (see `primitiveIsFinite`). Each drawing
// is ONE mark in the shared z-sort (band `drawing`), keyed by its emission `z`
// and ingest `seq`.
// The `table` is a SCREEN-SPACE HUD: it positions against `Viewport.pxWidth`/
// `pxHeight` directly. The drawing `view`'s `pxWidth` is the full-data CATEGORY
// span in pixels (a far-future timestamp maps to a far-right pixel) and balloons
// once the chart is zoomed, so a top-right table would land off-screen. Build a
// viewport from the chart's ACTUAL drawable size instead, reserving the
// right-hand price-axis gutter so the HUD sits inside the plot (clear of the
// labels), matching the other adapters. ECharts works in CSS px (it handles DPR
// internally), so no `pxRatio` scaling is applied.
function tableScreenViewport(state: AdapterState): Viewport {
    const pxWidth = Math.max(0, state.chart.getWidth() - GRID_RIGHT_PX);
    return { xMin: 0, xMax: 1, yMin: 0, yMax: 1, pxWidth, pxHeight: state.chart.getHeight() };
}

function drawingMarks(state: AdapterState, view: Viewport): GraphicMark[] {
    const marks: GraphicMark[] = [];
    for (const [handleId, drawing] of state.drawings) {
        // `table` is screen-space; everything else projects through `view`.
        const drawingView = drawing.drawingKind === "table" ? tableScreenViewport(state) : view;
        const elements: EChartsGraphicElement[] = [];
        for (const prim of decomposeDrawing(drawing, drawingView)) {
            if (primitiveIsFinite(prim)) elements.push(primitiveToGraphic(prim));
        }
        if (elements.length === 0) continue;
        // `drawingSeq` is written in lockstep with `drawings` (`applyDrawing`),
        // so a live drawing always has a seq — the `?? 0` is defensive only.
        const seq = state.drawingSeq.get(handleId);
        /* v8 ignore next -- lockstep with applyDrawing's drawingSeq set */
        marks.push({ z: drawing.z ?? 0, band: RENDER_BAND.drawing, seq: seq ?? 0, elements });
    }
    return marks;
}

// A volume-profile (`horizontal-histogram`) bucket → a left-anchored horizontal
// bar `polygon` graphic: the row sits at `priceToY(bucket.price)` and spans
// `(bucket.volume / maxVolume) * HHIST_MAX_WIDTH_PX` from the pane's left edge.
// ECharts has no axis-free horizontal-bar facility within a value-y grid, so
// (like drawings) these ride the declarative `graphic` array. A zero
// `maxVolume` or a non-positive bucket width contributes nothing. Bucket prices
// + volumes are guaranteed finite — `validateEmission` drops any emission with
// a non-finite number anywhere in its tree before it is stored.
function horizontalHistogramGraphics(
    style: Extract<PlotStyle, { kind: "horizontal-histogram" }>,
    view: Viewport,
): EChartsGraphicElement[] {
    let maxVolume = 0;
    for (const bucket of style.buckets) {
        if (bucket.volume > maxVolume) maxVolume = bucket.volume;
    }
    if (maxVolume <= 0) return [];
    const graphics: EChartsGraphicElement[] = [];
    for (const bucket of style.buckets) {
        const width = (bucket.volume / maxVolume) * HHIST_MAX_WIDTH_PX;
        if (width <= 0) continue;
        const y = priceToY(bucket.price, view);
        const top = y - HHIST_ROW_HEIGHT_PX / 2;
        const bottom = y + HHIST_ROW_HEIGHT_PX / 2;
        graphics.push({
            type: "polygon",
            shape: {
                points: [
                    [0, top],
                    [width, top],
                    [width, bottom],
                    [0, bottom],
                ],
            },
            style: { fill: bucket.color ?? DEFAULT_LINE_COLOR },
        });
    }
    return graphics;
}

// Render every stored `horizontal-histogram` series' buckets into per-bucket
// `polygon` graphic marks, projected against the series' OWN pane grid
// (overlay = 0) so a subpane volume profile uses that pane's price scale. Each
// histogram series is ONE mark in the shared z-sort (band `series`, since it is
// a per-bar series kind), keyed by its stored `z` / `seq`.
function horizontalHistogramMarks(state: AdapterState): GraphicMark[] {
    const marks: GraphicMark[] = [];
    for (const [key, stored] of state.series) {
        if (stored.style.kind !== "horizontal-histogram") continue;
        const paneKey = key.slice(0, key.indexOf("|"));
        const view = buildViewport(
            state.chart,
            state.bars,
            gridIndexOf(state, paneKey),
            zoomWindow(state),
        );
        const elements = horizontalHistogramGraphics(stored.style, view);
        if (elements.length === 0) continue;
        marks.push({ z: stored.z, band: RENDER_BAND.series, seq: stored.seq, elements });
    }
    return marks;
}

// The half-extent offset (in CSS px) a glyph is nudged for an `above` / `below`
// anchor `location`, mirroring the canvas2d `OFFSET_RATIO` (`size * 1.25`).
const GLYPH_LOCATION_OFFSET_RATIO = 1.25;

// The default font size (px) for a `label` glyph (which carries no `size`),
// mirroring the canvas2d `DEFAULT_FONT` ("10px sans-serif").
const LABEL_FONT_SIZE_PX = 10;

// Apply a glyph `location` (`above` / `below` / `absolute`) as a vertical pixel
// nudge from the anchored value, matching the canvas2d `shape` / `character`
// anchoring. `above` lifts the glyph (smaller pixel y), `below` drops it.
function locationOffset(
    location: "above" | "below" | "absolute" | undefined,
    size: number,
): number {
    switch (location ?? "absolute") {
        case "above":
            return -size * GLYPH_LOCATION_OFFSET_RATIO;
        case "below":
            return size * GLYPH_LOCATION_OFFSET_RATIO;
        case "absolute":
            return 0;
    }
}

// A text glyph (`character` / `label`) → an ECharts `graphic.text` anchored at
// (`x`, `y`), centred horizontally, with a `verticalAlign` derived from the
// anchor. `absolute` / `anchor` centres on the value; `above` sits the text
// above (`verticalAlign: "bottom"`), `below` below (`"top"`).
function textGlyphGraphic(args: {
    readonly x: number;
    readonly y: number;
    readonly text: string;
    readonly fontSizePx: number;
    readonly color: string;
    readonly verticalAlign: "top" | "middle" | "bottom";
}): EChartsGraphicElement {
    return {
        type: "text",
        x: args.x,
        y: args.y,
        style: {
            text: args.text,
            fill: args.color,
            font: `${args.fontSizePx}px sans-serif`,
            align: "center",
            verticalAlign: args.verticalAlign,
        },
    };
}

// The `verticalAlign` an `above` / `below` / `absolute` glyph location maps to.
function verticalAlignFor(location: "above" | "below" | "absolute"): "top" | "middle" | "bottom" {
    switch (location) {
        case "above":
            return "bottom";
        case "below":
            return "top";
        case "absolute":
            return "middle";
    }
}

// The arrow glyph triangle vertices (canvas2d `arrow.ts` geometry): an `up`
// arrow points up, a `down` arrow points down, both `size` tall/wide.
function arrowGraphic(
    x: number,
    y: number,
    size: number,
    direction: "up" | "down",
    style: GraphicPathStyle,
): EChartsGraphicElement {
    const h = size / 2;
    const points: ReadonlyArray<readonly [number, number]> =
        direction === "up"
            ? [
                  [x, y - h],
                  [x + h, y + h],
                  [x - h, y + h],
              ]
            : [
                  [x, y + h],
                  [x + h, y - h],
                  [x - h, y - h],
              ];
    return { type: "polygon", shape: { points }, style };
}

// Open-stroke `shape` glyphs (`cross` / `xcross` / `flag`) → `polyline` graphic
// elements (canvas2d `shape.ts` geometry). `cross` / `xcross` are TWO crossing
// strokes (two polylines); `flag` is one open polyline.
function strokeShapeGraphics(
    shape: "cross" | "xcross" | "flag",
    x: number,
    y: number,
    size: number,
    color: string,
): EChartsGraphicElement[] {
    const half = size / 2;
    const stroke: GraphicPathStyle = { stroke: color, lineWidth: 1 };
    if (shape === "cross") {
        return [
            {
                type: "polyline",
                shape: {
                    points: [
                        [x - half, y],
                        [x + half, y],
                    ],
                },
                style: stroke,
            },
            {
                type: "polyline",
                shape: {
                    points: [
                        [x, y - half],
                        [x, y + half],
                    ],
                },
                style: stroke,
            },
        ];
    }
    if (shape === "xcross") {
        return [
            {
                type: "polyline",
                shape: {
                    points: [
                        [x - half, y - half],
                        [x + half, y + half],
                    ],
                },
                style: stroke,
            },
            {
                type: "polyline",
                shape: {
                    points: [
                        [x + half, y - half],
                        [x - half, y + half],
                    ],
                },
                style: stroke,
            },
        ];
    }
    return [
        {
            type: "polyline",
            shape: {
                points: [
                    [x - half, y + half],
                    [x - half, y - half],
                    [x + half, y - half / 2],
                    [x - half, y],
                ],
            },
            style: stroke,
        },
    ];
}

// Build the `graphic` elements for one glyph point, dispatching on its style
// kind. `x` / `y` are the pixel anchor; `color` is the resolved paint. Returns
// the per-point elements (a marker is one; a `cross`/`xcross` shape is two).
function glyphPointGraphics(
    style: GlyphStyle,
    x: number,
    y: number,
    color: string,
): EChartsGraphicElement[] {
    switch (style.kind) {
        case "marker":
            return [
                glyphMarkerGraphic({
                    x,
                    y,
                    size: style.size,
                    shape: style.shape,
                    style: { fill: color },
                }),
            ];
        case "shape": {
            const yy = y + locationOffset(style.location, style.size);
            if (
                style.shape === "circle" ||
                style.shape === "triangle-up" ||
                style.shape === "triangle-down" ||
                style.shape === "square" ||
                style.shape === "diamond"
            ) {
                const fillShape: GlyphMarkerShape = style.shape;
                return [
                    glyphMarkerGraphic({
                        x,
                        y: yy,
                        size: style.size,
                        shape: fillShape,
                        style: { fill: color },
                    }),
                ];
            }
            return strokeShapeGraphics(style.shape, x, yy, style.size, color);
        }
        case "arrow":
            return [arrowGraphic(x, y, style.size, style.direction, { fill: color })];
        case "character": {
            const yy = y + locationOffset(style.location, style.size);
            return [
                textGlyphGraphic({
                    x,
                    y: yy,
                    text: style.char,
                    fontSizePx: style.size,
                    color,
                    verticalAlign: verticalAlignFor(style.location ?? "absolute"),
                }),
            ];
        }
        case "label":
            return [
                textGlyphGraphic({
                    x,
                    y,
                    text: style.text,
                    fontSizePx: LABEL_FONT_SIZE_PX,
                    color,
                    verticalAlign: verticalAlignFor(
                        style.position === "anchor" ? "absolute" : style.position,
                    ),
                }),
            ];
    }
}

// Whether a stored style is a glyph kind (`label` / `marker` / `shape` /
// `character` / `arrow`). Narrows `StoredStyle` to `GlyphStyle`.
function isGlyphStyle(style: StoredStyle): style is GlyphStyle {
    return (
        style.kind === "label" ||
        style.kind === "marker" ||
        style.kind === "shape" ||
        style.kind === "character" ||
        style.kind === "arrow"
    );
}

// Render every stored glyph series' points into `graphic` marks. Each glyph
// point is anchored at its SHIFTED bar time (`shiftedBarTime`, the universal
// `offset`) → `timeToX`, and its `value` → `priceToY` — the same time/price
// projection drawings use (the viewport's x is bar TIME, not the category
// index). A non-finite `value`, or a glyph whose projected pixel is non-finite,
// is skipped. Each point is ONE mark (band `glyph`) keyed by the series' `z`
// and `seq`.
function glyphMarks(state: AdapterState, spacing: number): GraphicMark[] {
    const marks: GraphicMark[] = [];
    for (const [key, stored] of state.series) {
        if (!isGlyphStyle(stored.style)) continue;
        const paneKey = key.slice(0, key.indexOf("|"));
        const view = buildViewport(
            state.chart,
            state.bars,
            gridIndexOf(state, paneKey),
            zoomWindow(state),
        );
        const color = seriesColor(stored);
        for (const point of stored.points) {
            // A non-finite `value` is the only non-finite source: the bar time is
            // always finite (real or extrapolated) and the viewport projection is
            // linear, so a finite `value` always yields finite pixels. Skipping
            // here mirrors the line/band `GAP` and the drawing NaN filter.
            if (point.value === null || !Number.isFinite(point.value)) continue;
            const time = shiftedBarTime({
                bars: state.bars,
                bar: point.bar,
                xShift: point.xShift,
                spacing,
            });
            const x = timeToX(time, view);
            const y = priceToY(point.value, view);
            const elements = glyphPointGraphics(stored.style, x, y, color);
            marks.push({ z: stored.z, band: RENDER_BAND.glyph, seq: stored.seq, elements });
        }
    }
    return marks;
}

// Whether any glyph point, drawing, or horizontal-histogram bucket is present —
// the cue to sample the viewport. A frame with NONE of these (e.g. the EMA-cross
// bundle's line-only frames) skips `convertToPixel` entirely (real ECharts
// throws when sampled before its first layout), preserving the no-spurious-sample
// invariant.
function hasGraphicMarks(state: AdapterState): boolean {
    if (state.drawings.size > 0) return true;
    for (const stored of state.series.values()) {
        if (isGlyphStyle(stored.style) || stored.style.kind === "horizontal-histogram") return true;
    }
    return false;
}

// The live inside-`dataZoom` window as a `ZoomWindow`, so `buildViewport` frames
// its sampled corners on the VISIBLE bars (the first data bar is off-screen when
// the chart is zoomed via `initialVisibleBars`, and ECharts cannot convert an
// off-screen category).
function zoomWindow(state: AdapterState): ZoomWindow {
    return { start: state.zoomStart, end: state.zoomEnd };
}

// Build the full `option.graphic` array: glyph + drawing + horizontal-histogram
// marks, z-sorted by the SHARED `sortByRenderOrder` (`(z, band, seq)`), each
// element carrying its batch's `zlevel` (derived from the same `z`) so a
// negative-z drawing sinks beneath the series and a positive-z plot rises above
// the default-zlevel graphics. The within-array order is the resolved sort, so
// same-zlevel marks keep their `(band, seq)` order. An empty layer (no glyphs /
// drawings / histograms) returns `[]` WITHOUT sampling the viewport.
function buildGraphicLayer(state: AdapterState): EChartsGraphicElementZ[] {
    if (!hasGraphicMarks(state)) return [];
    const spacing = medianBarSpacing(state.bars);
    const drawingView = buildViewport(state.chart, state.bars, 0, zoomWindow(state));
    const marks: GraphicMark[] = [
        ...horizontalHistogramMarks(state),
        ...glyphMarks(state, spacing),
        ...drawingMarks(state, drawingView),
    ];
    sortByRenderOrder(marks);
    const graphics: EChartsGraphicElementZ[] = [];
    for (const mark of marks) {
        const zl = zlevelSpread(mark.z);
        for (const element of mark.elements) {
            graphics.push({ ...element, ...zl });
        }
    }
    return graphics;
}

// The alert-condition + log overlay panels mirror the canvas2d reference
// (`render/{alertConditions,logPane}.ts`): a right-anchored fired-conditions
// panel and a bottom-left latest-log pane, both painted ALWAYS-ON-TOP (NOT in
// the z-sort — the v1 deferral). The text rows render as ECharts `graphic.text`
// elements over the overlay pane.
const OVERLAY_TEXT_COLOR = "#90caf9";
const OVERLAY_FONT = "11px sans-serif";
// Alert-condition panel: rows stack from `PANEL_Y`, the panel's left edge sits
// `PANEL_RIGHT_INSET` px in from the overlay's right edge (clamped to
// `PANEL_X_PAD` so a narrow chart never pushes the panel off-screen left).
const PANEL_X_PAD = 12;
const PANEL_Y = 18;
const PANEL_RIGHT_INSET = 180;
const CONDITION_ROW_HEIGHT = 14;
// Log pane: rows stack up from the bottom-left, `LOG_PADDING` in from each edge.
const LOG_PADDING = 8;
const LOG_ROW_HEIGHT = 13;
const MAX_VISIBLE_LOGS = 5;

// A left-aligned `graphic.text` overlay row (top-anchored), used by both panels.
function overlayTextRow(x: number, y: number, text: string): EChartsGraphicElement {
    return {
        type: "text",
        x,
        y,
        style: {
            text,
            fill: OVERLAY_TEXT_COLOR,
            font: OVERLAY_FONT,
            align: "left",
            verticalAlign: "top",
        },
    };
}

// Build the right-anchored fired-alert-condition panel (mirrors the canvas2d
// `drawAlertConditions` layout): one `${conditionId}: ${defaultMessage}` row per
// FIRED condition, stacked from `PANEL_Y`. Non-fired conditions are ignored (they
// still travel the wire for host state modelling). Returns `[]` when nothing is
// fired, so a clean frame appends no overlay graphics.
function alertConditionGraphics(
    conditions: ReadonlyArray<AlertConditionEmission>,
    view: Viewport,
): EChartsGraphicElement[] {
    const fired = conditions.filter((condition) => condition.fired);
    if (fired.length === 0) return [];
    const x = Math.max(PANEL_X_PAD, view.pxWidth - PANEL_RIGHT_INSET);
    return fired.map((condition, i) =>
        overlayTextRow(
            x,
            PANEL_Y + i * CONDITION_ROW_HEIGHT,
            `${condition.conditionId}: ${condition.defaultMessage}`,
        ),
    );
}

// Build the bottom-left latest-log pane (mirrors the canvas2d `drawLogPane`
// layout): the last `MAX_VISIBLE_LOGS` entries as `[${level}] ${message}` rows,
// stacked up from the overlay's bottom edge. The ingest ring already caps the
// buffer at five, so the slice is defensive parity with the reference. Returns
// `[]` when there are no logs.
function logPaneGraphics(
    logs: ReadonlyArray<LogEmission>,
    view: Viewport,
): EChartsGraphicElement[] {
    const visible = logs.slice(-MAX_VISIBLE_LOGS);
    if (visible.length === 0) return [];
    const x = LOG_PADDING;
    const y = Math.max(LOG_PADDING, view.pxHeight - LOG_PADDING - visible.length * LOG_ROW_HEIGHT);
    return visible.map((log, i) =>
        overlayTextRow(x, y + i * LOG_ROW_HEIGHT, `[${log.level}] ${log.message}`),
    );
}

// Whether any alert-condition fired or any log is buffered — the cue to project
// the overlay panels. A frame with neither skips the viewport sample entirely
// (real ECharts throws when sampled before its first layout), preserving the
// no-spurious-sample invariant, and appends no overlay graphics so the default
// option tree (and its pinned hash) is byte-identical.
function hasOverlayPanels(state: AdapterState): boolean {
    if (state.recentLogs.length > 0) return true;
    return state.currentAlertConditions.some((condition) => condition.fired);
}

// Build the always-on-top alert-condition + log overlay graphics, projected
// against the OVERLAY pane viewport. These APPEND after the z-sorted glyph /
// drawing / histogram layer (they are z-INDEPENDENT — the v1 deferral keeps
// alert/log panes pinned on top). Returns `[]` (without sampling the viewport)
// when nothing is fired / logged.
function overlayPanelGraphics(state: AdapterState): EChartsGraphicElement[] {
    if (!hasOverlayPanels(state)) return [];
    const view = buildViewport(state.chart, state.bars, 0, zoomWindow(state));
    return [
        ...alertConditionGraphics(state.currentAlertConditions, view),
        ...logPaneGraphics(state.recentLogs, view),
    ];
}

// Capture the user's live `dataZoom` window before the next rebuild. ECharts
// updates `dataZoom[0].start`/`.end` in place on an inside zoom/pan; reading
// them back here (and re-emitting them in `buildOption`) is what survives the
// `notMerge:true` rebuild. The headless/default surface omits `getOption`, and
// the very first frame has no `dataZoom` yet — both leave the window untouched.
function syncUserZoom(state: AdapterState): void {
    const zoom = state.chart.getOption?.()?.dataZoom?.[0];
    if (zoom === undefined) return;
    state.zoomStart = zoom.start;
    state.zoomEnd = zoom.end;
}

// Seed the INITIAL `dataZoom` window from `initialVisibleBars` exactly once,
// the first frame bars become available. The start percent is positioned so the
// last N bars fill the window (`100 - N/barCount*100`, clamped at 0 = fit all),
// end is always 100 (right edge). Gated by `hasSeededZoom` so a user pan/zoom
// (read back by `syncUserZoom`) is NEVER overwritten on a later frame, and live
// bars during Play keep auto-following past the seed. A no-op when
// `initialVisibleBars` is unset (window stays 0/100, unchanged) or there are no
// bars yet (deferred until the first windowed frame).
function seedInitialZoom(state: AdapterState): void {
    if (state.hasSeededZoom) return;
    const barCount = state.bars.length;
    if (barCount === 0) return;
    state.hasSeededZoom = true;
    const visible = state.initialVisibleBars;
    if (visible === undefined) return;
    state.zoomStart = Math.max(0, 100 - (visible / barCount) * 100);
    state.zoomEnd = 100;
}

// Reset the inside-`dataZoom` window to the full range and re-apply the option
// tree, for parity with the canvas2d reference adapter's double-click reset.
// `buildOption` reads `zoomStart`/`zoomEnd` straight back into the dataZoom, so
// resetting them and re-applying snaps the window to the whole category axis.
function resetZoom(state: AdapterState): void {
    state.zoomStart = 0;
    state.zoomEnd = 100;
    state.chart.setOption(buildOption(state), { notMerge: true });
}

// Map the IR transparency (0 opaque … 100 fully transparent) onto an ECharts
// `itemStyle.opacity` (1 opaque … 0 fully transparent). An omitted `transp`
// is fully opaque (`alpha === 1`), matching the canvas2d reference adapter.
function bgBandOpacity(transp: number | undefined): number {
    return 1 - (transp ?? 0) / 100;
}

// Build the candlestick `markArea` for the per-bar `bg-color` bands. Each live
// band becomes ONE x-axis-interval `markArea` item spanning that bar's category
// (`xAxis: barIndex` start → end), full-height (the y bounds are omitted so the
// area spans the whole grid), tinted with the per-bar colour at `1 - transp/100`
// opacity. A bar with no band (or a `colorValue: null` gap) contributes no item,
// so adjacent differently-coloured bars render as adjacent stripes and an
// unwashed bar stays clear. Returns `undefined` when no band is live so the
// candlestick series carries no empty `markArea`.
// ECharts' `markArea.data` 2D item is a MUTABLE `[start, end]` tuple, so this
// mirrors that shape (start carries the per-band tint; end only the interval).
type BgMarkAreaItem = [
    { xAxis: number; itemStyle: { color: string; opacity: number } },
    { xAxis: number },
];

// Resolve a per-bar candlestick body colour from its stored override. A `flat`
// override (bar-override / bar-color) is direction-independent — its colour is
// used as-is. A `direction` override (candle-override) picks the colour by the
// bar's OWN up/down/doji direction: `close > open ? bull : close < open ? bear :
// (doji ?? bull)` — copied from the canvas2d reference (`render/candleOverride
// .ts:51`), so a bullish bar gets `bull`, a bearish bar `bear`, and a flat
// (doji) bar `doji` or the `bull` fallback.
function resolveCandleColor(override: CandleStyle, bar: Bar): string {
    if (override.kind === "flat") return override.color;
    return bar.close > bar.open
        ? override.bull
        : bar.close < bar.open
          ? override.bear
          : (override.doji ?? override.bull);
}

function buildBgMarkAreaData(state: AdapterState): BgMarkAreaItem[] | undefined {
    if (state.bgBands.size === 0) return undefined;
    const items: BgMarkAreaItem[] = [];
    state.bars.forEach((bar, index) => {
        const band = state.bgBands.get(bar.time);
        if (band === undefined) return;
        items.push([
            { xAxis: index, itemStyle: { color: band.color, opacity: bgBandOpacity(band.transp) } },
            { xAxis: index },
        ]);
    });
    return items.length === 0 ? undefined : items;
}

// The largest POSITIVE category shift any stored series point reaches, across
// EVERY series. A category/index axis has no slot past its last bar, so a `+k`
// shifted point needs `k` synthetic future columns appended to the axis (and to
// the per-series data length) or it would be clipped off the right edge. A
// far-past (`−k`) point is clipped at a negative index instead and never widens
// the axis; an omitted / `0` shift contributes nothing, so a no-offset frame
// returns `0` and the axis is unchanged.
function maxPositiveShift(state: AdapterState): number {
    let max = 0;
    for (const stored of state.series.values()) {
        for (const point of stored.points) {
            const shift = point.xShift ?? 0;
            if (shift > max) max = shift;
        }
    }
    return max;
}

function buildOption(state: AdapterState): EChartsOption {
    const barCount = state.bars.length;
    // Extend the category axis by the max positive shift so a `+k` displaced
    // series point has a real column. The synthetic future bar-times extrapolate
    // from the last real bar at the run's median spacing. With no offset
    // (`maxShift === 0`) `categories` and `barCount` are unchanged, so a
    // no-offset frame is byte-identical to the pre-offset build. The candlestick
    // + bg/bar markArea keep their REAL bar indices — only the shifted series
    // address the extended columns.
    // A shift past the data edge is only meaningful when there are real bars to
    // extend from (no bars ⇒ no candlestick + no last-bar time to extrapolate),
    // so gate the extension on `barCount > 0`.
    const maxShift = barCount > 0 ? maxPositiveShift(state) : 0;
    const extendedBarCount = barCount + maxShift;
    const categories = state.bars.map((bar) => bar.time);
    if (maxShift > 0) {
        const spacing = medianBarSpacing(state.bars);
        const lastTime = state.bars[barCount - 1].time;
        for (let k = 1; k <= maxShift; k += 1) {
            categories.push(lastTime + k * spacing);
        }
    }
    const grids = state.paneOrder.map((_paneKey, i) => ({
        // Price axis sits on the RIGHT (the house convention — canvas2d, the
        // reference adapter, and lightweight-charts both do), so the label
        // gutter is reserved on the right and the left margin is minimal.
        left: GRID_LEFT_PX,
        right: GRID_RIGHT_PX,
        // Stack panes vertically; overlay (index 0) takes the top, larger band.
        top: `${8 + (i / Math.max(1, state.paneOrder.length)) * 84}%`,
        height: `${(1 / Math.max(1, state.paneOrder.length)) * 78}%`,
    }));
    const xAxes = state.paneOrder.map((_paneKey, i) => ({
        type: "category" as const,
        gridIndex: i,
        data: categories,
        boundaryGap: true,
        // The x axis (line, ticks, time labels) is hidden — the demo presents a
        // clean candle field with no time gutter.
        show: false,
    }));
    const yAxes = state.paneOrder.map((_paneKey, i) => ({
        type: "value" as const,
        gridIndex: i,
        scale: true,
        // Price labels on the RIGHT edge, matching canvas2d / lightweight-charts.
        position: "right" as const,
        // No horizontal grid lines across the plot; keep the price labels.
        splitLine: { show: false },
    }));

    const series: SeriesOption[] = [];

    // Candlestick on the overlay grid (index 0). Per-bar itemStyle overrides
    // (candle-override / bar-override / bar-color) tint individual bodies; the
    // per-bar `bg-color` bands ride this series' `markArea` (one full-height
    // category-interval stripe per band).
    if (barCount > 0) {
        const bgMarkArea = buildBgMarkAreaData(state);
        series.push({
            type: "candlestick",
            name: "candles",
            xAxisIndex: 0,
            yAxisIndex: 0,
            // Explicit bull/bear body colours (canvas2d parity) — without these
            // ECharts paints its own default red/green.
            itemStyle: {
                color: CANDLE_BULL_COLOR,
                color0: CANDLE_BEAR_COLOR,
                borderColor: CANDLE_BULL_COLOR,
                borderColor0: CANDLE_BEAR_COLOR,
            },
            data: state.bars.map((bar) => {
                const override = state.candleStyles.get(bar.time);
                const value = [bar.open, bar.close, bar.low, bar.high];
                if (override === undefined) return value;
                const color = resolveCandleColor(override, bar);
                return { value, itemStyle: { color, color0: color } };
            }),
            ...(bgMarkArea === undefined ? {} : { markArea: { data: bgMarkArea } }),
        });
    }

    for (const [key, stored] of state.series) {
        const paneKey = key.slice(0, key.indexOf("|"));
        const grid = gridIndexOf(state, paneKey);
        const name = key;
        switch (stored.style.kind) {
            case "line":
            case "step-line":
                // Per-bar `colorValue` splits the series into same-paint runs
                // (one `LineSeriesOption` each); a no-`colorValue` series
                // collapses to the single byte-identical series.
                series.push(
                    ...lineSeriesRuns(name, stored, stored.style, extendedBarCount, grid, {
                        ...(stored.style.kind === "step-line" ? { step: "end" } : {}),
                    }),
                );
                break;
            case "area":
                series.push(
                    ...lineSeriesRuns(name, stored, stored.style, extendedBarCount, grid, {
                        areaStyle: { opacity: stored.style.fillAlpha },
                    }),
                );
                break;
            case "histogram":
                series.push(barSeries(name, stored, extendedBarCount, grid));
                break;
            case "horizontal-histogram":
                // A volume-profile series is NOT a per-bar bar: its geometry
                // lives in `style.buckets` (price → row, volume → length), not
                // in the scalar per-bar `value`. It renders as per-bucket
                // `polygon` graphics in `buildHorizontalHistograms`, so the
                // series loop emits nothing here.
                break;
            case "filled-band": {
                const stack = `band-${name}`;
                series.push({
                    type: "line",
                    name: `${name}:lower`,
                    xAxisIndex: grid,
                    yAxisIndex: grid,
                    stack,
                    showSymbol: false,
                    lineStyle: { opacity: 0 },
                    data: bandData(stored.points, extendedBarCount, (s) => s.lower),
                    z: stored.z,
                    ...zlevelSpread(stored.z),
                });
                series.push({
                    type: "line",
                    name: `${name}:upper`,
                    xAxisIndex: grid,
                    yAxisIndex: grid,
                    stack,
                    showSymbol: false,
                    lineStyle: { opacity: 0 },
                    areaStyle: { opacity: stored.style.alpha },
                    // Stacked on `lower`, so the upper edge carries the band
                    // THICKNESS (`upper - lower`) and the stack sum lands at
                    // the true upper price.
                    data: bandData(stored.points, extendedBarCount, (s) =>
                        s.upper === null || s.lower === null ? null : s.upper - s.lower,
                    ),
                    z: stored.z,
                    ...zlevelSpread(stored.z),
                });
                break;
            }
            case "label":
            case "marker":
            case "shape":
            case "character":
            case "arrow":
                // Glyph kinds render as native `graphic` elements
                // (`buildGlyphGraphics`), NOT a series — so this arm emits
                // nothing here. The arm is kept (not excluded from the switch)
                // because glyph styles ARE buffered in `state.series`.
                break;
            // No default: the arms above cover every stored style kind
            // (`StoredStyle` = the series-producing kinds + the glyph kinds).
            // `applyPlot`'s switch holds the `PlotStyle` exhaustiveness guard
            // for the candle-state / hline kinds handled there.
        }
    }

    // Horizontal lines → a `markLine` on a hidden carrier series per pane.
    const hlineByPane = new Map<number, Array<{ yAxis: number; lineStyle: { color: string } }>>();
    for (const hline of state.hlines.values()) {
        const grid = gridIndexOf(state, hline.paneKey);
        const list = hlineByPane.get(grid) ?? [];
        list.push({ yAxis: hline.price, lineStyle: { color: hline.color ?? DEFAULT_LINE_COLOR } });
        hlineByPane.set(grid, list);
    }
    for (const [grid, lines] of hlineByPane) {
        series.push({
            type: "line",
            name: `hlines-${grid}`,
            xAxisIndex: grid,
            yAxisIndex: grid,
            showSymbol: false,
            data: [],
            markLine: { symbol: "none", data: lines },
        });
    }

    return {
        // The chart's own theme background. The Pine `bgcolor` per-bar bands
        // are NOT a whole-pane wash — they ride the candlestick `markArea`.
        backgroundColor: state.backgroundColor,
        grid: grids,
        xAxis: xAxes,
        yAxis: yAxes,
        series,
        // Inside (no slider) wheel-zoom + drag-pan across EVERY pane grid in
        // lockstep, so stacked panes share one time window. `start`/`end`
        // carry the user's window across the `notMerge:true` rebuild.
        dataZoom: [
            {
                type: "inside",
                xAxisIndex: state.paneOrder.map((_paneKey, i) => i),
                filterMode: "none",
                zoomOnMouseWheel: true,
                moveOnMouseMove: true,
                start: state.zoomStart,
                end: state.zoomEnd,
            },
        ],
        // The z-sorted glyph / drawing / histogram layer, with the always-on-top
        // alert-condition + log overlay panels appended last (z-independent — the
        // v1 deferral). A frame with neither graphics nor panels stays `[]`.
        graphic: [...buildGraphicLayer(state), ...overlayPanelGraphics(state)],
    };
}

function applyPlot(state: AdapterState, plot: PlotEmission): void {
    // A host override hid this slot: drop the point but keep any existing
    // stored series so re-enabling re-emits it.
    if (plot.visible === false) return;
    const paneKey = plot.pane;
    const z = plot.z ?? 0;
    if (paneKey !== "overlay" && !state.paneOrder.includes(paneKey)) {
        state.paneOrder.push(paneKey);
    }

    switch (plot.style.kind) {
        case "line":
        case "step-line":
        case "area":
        case "histogram":
        case "horizontal-histogram":
        case "filled-band":
        case "label":
        case "marker":
        case "shape":
        case "character":
        case "arrow": {
            const key = paneSlotKey(paneKey, plot.slotId);
            const points = state.series.get(key)?.points ?? [];
            points.push({
                bar: plot.bar,
                value: plot.value,
                color: plot.color,
                // Carry the universal `ta` `offset` so the point renders at its
                // shifted category column. Omit a no-shift `xShift` so an
                // unshifted frame's stored point — and therefore the option
                // tree + its hash — is byte-identical to the pre-offset build.
                ...(plot.xShift === undefined || plot.xShift === 0 ? {} : { xShift: plot.xShift }),
                // Capture the style per point only for `filled-band`, whose
                // per-bar bounds ride the emission's style; other kinds rely
                // on the series-level (last-write) style.
                ...(plot.style.kind === "filled-band" ? { style: plot.style } : {}),
                // Thread the per-bar `colorValue` (line family) via the
                // conditional-spread idiom, so a no-`colorValue` point is
                // byte-identical to the pre-feature stored shape.
                ...(plot.colorValue === undefined ? {} : { colorValue: plot.colorValue }),
            });
            // The latest style + z + seq win (matching canvas2d's last-write
            // style), so re-set the stored entry to keep the freshest
            // discriminant while preserving the accumulated points. `seq` is the
            // mark's ingest order (declaration order) — the z-sort's tiebreaker.
            state.series.set(key, { style: plot.style, points, z, seq: state.seq });
            state.seq += 1;
            return;
        }
        case "horizontal-line":
            state.hlines.set(plot.slotId, {
                price: plot.value ?? 0,
                color: plot.color,
                paneKey,
            });
            return;
        case "candle-override":
            // Pine `plotcandle` colours the bull/bear/doji body BY the bar's own
            // direction. The bar's OHLC may not be in `state.bars` yet at ingest,
            // so store the whole palette and resolve the direction at render time
            // (`resolveCandleColor` in `buildOption`).
            state.candleStyles.set(plot.time, {
                kind: "direction",
                bull: plot.style.bull,
                bear: plot.style.bear,
                ...(plot.style.doji === undefined ? {} : { doji: plot.style.doji }),
            });
            return;
        case "bar-override":
            // Pine `plotbar` is a single direction-independent tint.
            state.candleStyles.set(plot.time, { kind: "flat", color: plot.style.color });
            return;
        case "bar-color": {
            // Per-bar `colorValue` wins over the static `style.color`; an
            // explicit `null` is the "no tint this bar" gap (drop any prior
            // override); omitted falls back to `style.color`. (The precedence
            // contract — see `PlotEmission.colorValue`.) A single flat tint.
            const paint = plot.colorValue === undefined ? plot.style.color : plot.colorValue;
            if (paint === null) {
                state.candleStyles.delete(plot.time);
                return;
            }
            state.candleStyles.set(plot.time, { kind: "flat", color: paint });
            return;
        }
        case "bg-color": {
            // Pine `bgcolor` is a PER-BAR vertical band, not a whole-pane
            // wash: each bar carries its own resolved colour. `colorValue`
            // (present) wins over the static `style.color`; an explicit `null`
            // paints nothing this bar (drop the band); omitted falls back to
            // `style.color`. The band renders as a candlestick `markArea`
            // interval keyed on the bar's category — translucent via `transp`.
            const paint = plot.colorValue === undefined ? plot.style.color : plot.colorValue;
            if (paint === null) {
                state.bgBands.delete(plot.time);
                return;
            }
            state.bgBands.set(plot.time, { color: paint, transp: plot.style.transp });
            return;
        }
        // No default: exhaustive over `PlotStyle["kind"]`.
    }
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
    while (state.recentLogs.length > 5) {
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
    // Assign an ingest `seq` for the z-sort tiebreaker (declaration order). A
    // re-emit (`upsert`) of an existing handle keeps its original seq so a live
    // drawing does not jump render order each frame.
    if (!state.drawingSeq.has(drawing.handleId)) {
        state.drawingSeq.set(drawing.handleId, state.seq);
        state.seq += 1;
    }
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
 * Build a frozen ECharts example adapter. Wires an ECharts instance (via
 * `opts.echartsFactory`), a candle source, the adapter-kit `defineAdapter`
 * factory, and a worker host into one object. The returned `host` is exposed
 * so the consumer can `await adapter.host.load(compiled)` before invoking
 * {@link runEChartsLoop}.
 *
 * The adapter's `onEmissions` callback validates every emission via
 * {@link validateEmission}, accumulates plot / horizontal-line / candle-style
 * state, rebuilds one declarative `EChartsOption`, and applies it with
 * `chart.setOption(option, { notMerge: true })` so each drain produces the
 * full, authoritative option tree.
 *
 * @since 1.4
 * @stable
 * @example
 *     import { createEChartsAdapter } from "chartlang-example-echarts-adapter";
 *     import { mockCandleSource } from "@invinite-org/chartlang-adapter-kit";
 *     declare const init: () => import("chartlang-example-echarts-adapter").EChartsSurface;
 *     const adapter = createEChartsAdapter({
 *         echartsFactory: init,
 *         candleSource: mockCandleSource([]),
 *     });
 *     void adapter;
 */
export function createEChartsAdapter(opts: CreateEChartsAdapterOpts): EChartsAdapterHandle {
    const capabilities = opts.capabilities ?? ECHARTS_CAPABILITIES;
    const chart = opts.echartsFactory();
    const state: AdapterState = {
        chart,
        backgroundColor: opts.backgroundColor ?? DEFAULT_BG_COLOR,
        bars: [],
        paneOrder: ["overlay"],
        series: new Map(),
        hlines: new Map(),
        candleStyles: new Map(),
        bgBands: new Map(),
        recentAlerts: [],
        currentAlertConditions: [],
        recentLogs: [],
        drawings: new Map(),
        drawingSeq: new Map(),
        seq: 0,
        zoomStart: 0,
        zoomEnd: 100,
        ...(opts.initialVisibleBars === undefined
            ? {}
            : { initialVisibleBars: opts.initialVisibleBars }),
        hasSeededZoom: false,
        hasReprojected: false,
    };
    // Wire a double-click reset to snap the inside-zoom/pan window back to the
    // full range, matching the canvas2d reference adapter's dblclick reset. The
    // headless default surface omits `on` (no interaction to wire); the real
    // `echarts.init(...)` instance + the mock both implement it.
    chart.on?.("dblclick", () => resetZoom(state));
    const host =
        opts.host ??
        createWorkerHost(
            opts.workerLike !== undefined
                ? {
                      capabilities,
                      symInfo: ECHARTS_SYM_INFO,
                      ...(opts.resolveInputs !== undefined
                          ? { resolveInputs: opts.resolveInputs }
                          : {}),
                      workerLike: opts.workerLike,
                  }
                : {
                      capabilities,
                      symInfo: ECHARTS_SYM_INFO,
                      ...(opts.resolveInputs !== undefined
                          ? { resolveInputs: opts.resolveInputs }
                          : {}),
                  },
        );

    const adapter = defineAdapter({
        id: "echarts-example",
        name: "ECharts Example Adapter",
        capabilities,
        ...(opts.resolveInputs !== undefined ? { resolveInputs: opts.resolveInputs } : {}),
        symInfo: ECHARTS_SYM_INFO,
        candles: () => opts.candleSource,
        onEmissions: (emissions) => {
            ingest(state, emissions, opts.onAlert);
            // Read the user's live zoom back before the destructive rebuild,
            // so an inside-zoom/pan survives `notMerge:true`.
            syncUserZoom(state);
            // Then seed the initial windowed view (last N bars) ONCE, the first
            // frame bars exist — only if the user has not already zoomed (the
            // `hasSeededZoom` gate). After this, user-zoom tracking owns the
            // window and live bars keep auto-following.
            seedInitialZoom(state);
            state.chart.setOption(buildOption(state), { notMerge: true });
            // The first setOption lays out the grid synchronously; on that first
            // frame any drawing / glyph / horizontal-histogram / overlay-panel
            // was projected through `buildViewport` BEFORE the chart had a
            // coordinate system (a live ECharts `convertToPixel` THROWS pre-layout,
            // so `buildViewport` returned the nominal fallback). Re-apply ONCE so
            // those graphics re-project against the now-real grid pixels. Gated on
            // there BEING such graphics (and only the first frame) so a line-only
            // bundle (e.g. EMA-cross) never doubles its `setOption` — keeping the
            // no-spurious-sample invariant + the pinned option-log hash intact.
            if (!state.hasReprojected && (hasGraphicMarks(state) || hasOverlayPanels(state))) {
                state.hasReprojected = true;
                state.chart.setOption(buildOption(state), { notMerge: true });
            }
        },
        dispose: () => {
            state.bars.length = 0;
            state.paneOrder = ["overlay"];
            state.series.clear();
            state.hlines.clear();
            state.candleStyles.clear();
            state.bgBands.clear();
            state.recentAlerts.length = 0;
            state.currentAlertConditions.length = 0;
            state.recentLogs.length = 0;
            state.drawings.clear();
            state.drawingSeq.clear();
            state.seq = 0;
            state.hasSeededZoom = false;
            state.hasReprojected = false;
            state.chart.dispose();
            host.dispose();
        },
    });

    const handle: EChartsAdapterHandle = Object.freeze({ ...adapter, host });
    HANDLE_STATE.set(handle, state);
    HANDLE_INTERVAL.set(handle, opts.interval ?? DEFAULT_INTERVAL);
    return handle;
}

/**
 * Optional second argument for {@link runEChartsLoop}. Pass a `signal` from an
 * `AbortController` to cancel the loop cleanly: once aborted the loop drops the
 * current iteration's remaining work, breaks out of the async-iterator, and
 * resolves (no throw).
 *
 * @since 1.4
 * @stable
 * @example
 *     import type { RunEChartsLoopOpts } from "chartlang-example-echarts-adapter";
 *     const opts: RunEChartsLoopOpts = { signal: new AbortController().signal };
 *     void opts;
 */
export type RunEChartsLoopOpts = Readonly<{
    signal?: AbortSignal;
}>;

/**
 * Drive a built adapter through one full pass of its candle source: iterate the
 * events, mirror them into the adapter's bar window, `await host.push(event)`
 * for each, and call `host.drain()` + `adapter.onEmissions(...)` between events.
 * Returns when the source completes; throws whatever the source / host throws.
 *
 * Pass `opts.signal` to cancel the loop cleanly — on abort it returns silently
 * (no throw) after finishing at most one in-flight `push` / `drain`.
 *
 * @since 1.4
 * @stable
 * @example
 *     import { createEChartsAdapter, runEChartsLoop } from "chartlang-example-echarts-adapter";
 *     import { mockCandleSource } from "@invinite-org/chartlang-adapter-kit";
 *     declare const init: () => import("chartlang-example-echarts-adapter").EChartsSurface;
 *     const adapter = createEChartsAdapter({ echartsFactory: init, candleSource: mockCandleSource([]) });
 *     // await adapter.host.load(compiled);
 *     // await runEChartsLoop(adapter);
 *     const fn: typeof runEChartsLoop = runEChartsLoop;
 *     void fn;
 */
export async function runEChartsLoop(
    handle: EChartsAdapterHandle,
    opts: RunEChartsLoopOpts = {},
): Promise<void> {
    const state = HANDLE_STATE.get(handle);
    const interval = HANDLE_INTERVAL.get(handle);
    if (state === undefined || interval === undefined) {
        throw new Error("runEChartsLoop: handle was not produced by createEChartsAdapter");
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
        // resolve `push` synchronously and this is a no-op for them.
        await new Promise<void>((r) => setTimeout(r, 0));
        if (aborted()) return;
        const emissions = await handle.host.drain();
        if (aborted()) return;
        handle.onEmissions(emissions);
    }
}
