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
    type RunnerEmissions,
    type Viewport,
    decomposeDrawing,
    defineAdapter,
    medianBarSpacing,
    priceToY,
    shiftedBarIndex,
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
    ScatterSeriesOption,
    SeriesOption,
} from "echarts/types/dist/echarts";

import { ECHARTS_CAPABILITIES, ECHARTS_SYM_INFO } from "./capabilities.js";
import {
    type EChartsGraphicElement,
    primitiveIsFinite,
    primitiveToGraphic,
} from "./primitiveToGraphic.js";
import type { EChartsSurface } from "./types.js";
import { buildViewport } from "./viewport.js";

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
};

// The plot-style subset that becomes a `state.series` entry. `horizontal-line`
// (a `markLine`), the candle-state overrides (`candle-override` /
// `bar-override` / `bar-color` → per-bar `itemStyle`), and `bg-color` (chart
// background) are handled in `applyPlot` and never stored as a series, so the
// `buildOption` series switch stays exhaustive over exactly these kinds.
type SeriesStyle = Exclude<
    PlotStyle,
    { kind: "horizontal-line" | "candle-override" | "bar-override" | "bg-color" | "bar-color" }
>;

type StoredSeries = {
    readonly style: SeriesStyle;
    points: SeriesPoint[];
    z: number;
};

type StoredHLine = {
    readonly price: number;
    readonly color: string | null;
    readonly paneKey: string;
};

// A candlestick per-bar style override (candle-override / bar-override /
// bar-color), keyed by bar time. Last-write-wins per bar.
type CandleStyle = { readonly color: string };

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
    // Drawings are buffered here for Task 10's `graphic`-path renderer; this
    // task does not paint them.
    readonly drawings: Map<string, DrawingEmission>;
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

function lineSeries(
    name: string,
    series: StoredSeries,
    style: LineFamilyStyle,
    barCount: number,
    grid: number,
    extra: Partial<LineSeriesOption>,
): LineSeriesOption {
    const color = seriesColor(series);
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
        data: seriesData(series.points, barCount),
        z: series.z,
        ...extra,
    };
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

// Decompose every live drawing against the chart's viewport into ECharts
// `graphic` elements. `op:"remove"` drawings are already dropped from
// `state.drawings` by `applyDrawing`, so only live drawings are seen here.
// Non-finite primitives are filtered out (see `primitiveIsFinite`).
function buildGraphics(state: AdapterState): EChartsGraphicElement[] {
    // No drawings means no viewport sampling — sampling `convertToPixel`
    // would otherwise hit the live chart on every frame (real ECharts
    // throws when sampled before its first layout), so skip it entirely
    // when there is nothing to project.
    if (state.drawings.size === 0) return [];
    const view = buildViewport(state.chart, state.bars);
    const graphics: EChartsGraphicElement[] = [];
    for (const drawing of state.drawings.values()) {
        for (const prim of decomposeDrawing(drawing, view)) {
            if (primitiveIsFinite(prim)) graphics.push(primitiveToGraphic(prim));
        }
    }
    return graphics;
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
// `polygon` graphics, projected against the series' OWN pane grid (overlay = 0)
// so a subpane volume profile uses that pane's price scale.
function buildHorizontalHistograms(state: AdapterState): EChartsGraphicElement[] {
    const graphics: EChartsGraphicElement[] = [];
    for (const [key, stored] of state.series) {
        if (stored.style.kind !== "horizontal-histogram") continue;
        const paneKey = key.slice(0, key.indexOf("|"));
        const view = buildViewport(state.chart, state.bars, gridIndexOf(state, paneKey));
        graphics.push(...horizontalHistogramGraphics(stored.style, view));
    }
    return graphics;
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
        left: 16,
        right: 56,
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
                return override === undefined
                    ? value
                    : { value, itemStyle: { color: override.color, color0: override.color } };
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
                series.push(
                    lineSeries(name, stored, stored.style, extendedBarCount, grid, {
                        ...(stored.style.kind === "step-line" ? { step: "end" } : {}),
                    }),
                );
                break;
            case "area":
                series.push(
                    lineSeries(name, stored, stored.style, extendedBarCount, grid, {
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
                });
                break;
            }
            case "label":
            case "marker":
            case "shape":
            case "character":
            case "arrow":
                series.push(glyphSeries(name, stored, grid, extendedBarCount));
                break;
            // No default: `SeriesStyle` excludes the candle-state / hline kinds
            // (handled in `applyPlot`), so the arms above cover every stored
            // series style. `applyPlot`'s switch holds the `PlotStyle`
            // exhaustiveness guard for the whole kind set.
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
        graphic: [...buildHorizontalHistograms(state), ...buildGraphics(state)],
    };
}

// Glyph plot kinds (label / marker / shape / character / arrow) render as a
// `scatter` series carrying a `markPoint`-style symbol at each anchor. Glyph
// kinds ECharts cannot express natively defer to Task 10's `graphic` path.
function glyphSeries(
    name: string,
    series: StoredSeries,
    grid: number,
    extendedBarCount: number,
): ScatterSeriesOption {
    const data: Array<[number, number]> = [];
    for (const point of series.points) {
        if (point.value === null || !Number.isFinite(point.value)) continue;
        // Glyphs displace by the universal `offset` too — render at the shifted
        // category column. A `bar + xShift` outside the (extended) category
        // range is clipped — no negative category, no slot past the appended
        // future columns — mirroring `seriesData` / `bandData`.
        const index = shiftedBarIndex(point.bar, point.xShift);
        if (index < 0 || index >= extendedBarCount) continue;
        data.push([index, point.value]);
    }
    return {
        type: "scatter",
        name,
        xAxisIndex: grid,
        yAxisIndex: grid,
        symbolSize: 8,
        itemStyle: { color: seriesColor(series) },
        data,
        z: series.z,
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
            });
            // The latest style + z win (matching canvas2d's last-write style),
            // so re-set the stored entry to keep the freshest discriminant
            // while preserving the accumulated points.
            state.series.set(key, { style: plot.style, points, z });
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
            // Tint the bar's candlestick body. Pine `plotcandle` colours the
            // bull/bear/doji body; we map the bull colour onto the bar's body.
            state.candleStyles.set(plot.time, { color: plot.style.bull });
            return;
        case "bar-override":
            state.candleStyles.set(plot.time, { color: plot.style.color });
            return;
        case "bar-color": {
            // Per-bar `colorValue` wins over the static `style.color`; an
            // explicit `null` is the "no tint this bar" gap (drop any prior
            // override); omitted falls back to `style.color`. (The precedence
            // contract — see `PlotEmission.colorValue`.)
            const paint = plot.colorValue === undefined ? plot.style.color : plot.colorValue;
            if (paint === null) {
                state.candleStyles.delete(plot.time);
                return;
            }
            state.candleStyles.set(plot.time, { color: paint });
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
        zoomStart: 0,
        zoomEnd: 100,
        ...(opts.initialVisibleBars === undefined
            ? {}
            : { initialVisibleBars: opts.initialVisibleBars }),
        hasSeededZoom: false,
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
            state.hasSeededZoom = false;
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
