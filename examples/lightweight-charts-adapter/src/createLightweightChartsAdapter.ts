// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

// ---------------------------------------------------------------------------
// Plot-kind → native lightweight-charts mapping (Task 5). Candles, plots,
// horizontal lines and panes use lightweight-charts' OWN facilities — they
// are never hand-painted. Drawings (Task 6) buffer here and paint via a
// series-primitive overlay (`DrawingPrimitive` + `decomposeDrawing`).
//
//   line                 → addSeries("Line")
//   step-line            → addSeries("Line", { lineType: WithSteps })  (native)
//   area                 → addSeries("Area")
//   histogram            → addSeries("Histogram")
//   horizontal-line      → series.createPriceLine() on the pane anchor series
//   filled-band          → two Line series (upper / lower); the FILL between
//                          them is a Task-6 drawing (LC has no native band).
//   shape/character/      → createSeriesMarkers via series.setMarkers([...])
//     arrow/marker/label    (the v5 markers plugin); label text → marker text.
//   drawings (63 kinds)   → a series-primitive overlay (Task 6) that paints
//                          `decomposeDrawing` through the shared canvas sink;
//                          NOT native (LC has no drawing facility). Anchored on
//                          the overlay candle series via `attachPrimitive`.
//   candle-override       → candleSeries.applyOptions(...) — whole-series
//                          up/down tint (LC has no per-bar candle-override).
//   bar-override/         → per-bar candle colour stamped onto the candlestick
//     bar-color              DATA POINT (`color` + `borderColor` + `wickColor`)
//                          — LC's NATIVE per-point colour API, so body AND
//                          border AND wick recolour for exactly that bar. The
//                          per-bar colour resolves `colorValue ?? style.color`
//                          (the dynamic-colour precedence: `colorValue` present
//                          overrides; `null` clears the override; omitted uses
//                          the static `style.color`). Tracked in
//                          `state.barColors` (keyed by bar time) so a re-emit
//                          re-stamps the same bar.
//   bg-color              → NO-OP. LC's background is a single chart-layout
//                          option, not a per-bar band; declared in the
//                          capability surface, deferred to a Task-6 primitive.
//   horizontal-histogram  → NO-OP. No native facility; Task-6 primitive path.
//
//   visible:false         → series.applyOptions({ visible: false }) (hidden,
//                          not removed — the slot stays declared).
//   NaN / null value      → a whitespace point ({ time } with no value) so the
//                          native line does not draw a break artefact.
// ---------------------------------------------------------------------------

import {
    type Adapter,
    type AlertConditionEmission,
    type AlertEmission,
    type CandleEvent,
    type Capabilities,
    type DrawingEmission,
    type LogEmission,
    type PlotEmission,
    type RunnerEmissions,
    defineAdapter,
    medianBarSpacing,
    shiftedBarTime,
    validateEmission,
} from "@invinite-org/chartlang-adapter-kit";
import type { Bar } from "@invinite-org/chartlang-core";
import {
    type ScriptHost,
    type WorkerLike,
    createWorkerHost,
} from "@invinite-org/chartlang-host-worker";
import {
    AreaSeries,
    CandlestickSeries,
    ColorType,
    HistogramSeries,
    type IPriceLine,
    type ISeriesPrimitive,
    LineSeries,
    type SeriesDefinition,
    type SeriesMarker,
    type SeriesType,
    type Time,
    type UTCTimestamp,
    createChart,
    createSeriesMarkers,
} from "lightweight-charts";

import { LWC_CAPABILITIES, LWC_SYM_INFO } from "./capabilities.js";
import { DrawingPrimitive } from "./drawingPrimitive.js";
import type { LwcChart, LwcPriceLine, LwcSeries } from "./testing.js";

const DEFAULT_INTERVAL = "1D";
const MAX_RECENT_ALERTS = 256;

/**
 * Constructor options for {@link createLightweightChartsAdapter}. `chartApi`
 * is the test seam (mirrors canvas2d's `opts.ctx`): when supplied the factory
 * drives the supplied {@link LwcChart} directly; otherwise it builds one from
 * `opts.container` via `opts.createChart` (defaulting to the real
 * lightweight-charts `createChart`). The `host` / `workerLike` fields are the
 * worker-host test seams, same as the canvas2d adapter.
 *
 * @since 1.4
 * @stable
 * @example
 *     import { MockLwcApi } from "chartlang-example-lightweight-charts-adapter/testing";
 *     import { mockCandleSource } from "@invinite-org/chartlang-adapter-kit";
 *     const opts: CreateLightweightChartsAdapterOpts = {
 *         chartApi: new MockLwcApi(),
 *         candleSource: mockCandleSource([]),
 *     };
 *     void opts;
 */
export type CreateLightweightChartsAdapterOpts = {
    readonly container?: HTMLElement;
    readonly chartApi?: LwcChart;
    readonly createChart?: (container: HTMLElement) => LwcChart;
    readonly candleSource: AsyncIterable<CandleEvent>;
    readonly capabilities?: Capabilities;
    readonly interval?: string;
    /**
     * Default visible window: when set, the chart opens framed on only the
     * most recent N bars (rest stay scrollable via lightweight-charts' native
     * pan/zoom); omit = fit all data (fitContent), unchanged behavior.
     */
    readonly initialVisibleBars?: number;
    readonly resolveInputs?: (scriptId: string) => Readonly<Record<string, unknown>>;
    readonly onAlert?: (a: AlertEmission) => void;
    readonly host?: ScriptHost;
    readonly workerLike?: WorkerLike;
};

/**
 * Public handle the consumer drives. `host` is exposed so callers can
 * `await adapter.host.load(compiled)` before driving the candle source.
 *
 * @since 1.4
 * @stable
 * @example
 *     declare const adapter: LwcAdapterHandle;
 *     // await adapter.host.load(compiled);
 *     void adapter;
 */
export type LwcAdapterHandle = Adapter & { readonly host: ScriptHost };

type PaneSeries = {
    readonly series: LwcSeries;
    // The second edge of a `filled-band` slot (upper = `series`, lower here).
    readonly lower?: LwcSeries;
};

type AdapterState = {
    readonly chart: LwcChart;
    readonly bars: Bar[];
    // `"overlay"` is pane 0; `"new"` allocates a fresh pane each sight; a
    // named pane string gets a stable index on first sight.
    readonly paneIndex: Map<string, number>;
    // Keyed by `${paneKey}|${slotId}` so one callsite can land in distinct
    // panes and each gets its own native series.
    readonly series: Map<string, PaneSeries>;
    // The native price line a `horizontal-line` slot owns, keyed by the same
    // `${paneKey}|${slotId}`. The runtime re-emits the slot every bar; we
    // re-price the SAME line instead of stacking a new one each frame (LC has
    // no price-line dedup). The series the line is anchored on is held so a
    // hidden / removed slot can `removePriceLine` it.
    readonly priceLines: Map<string, { readonly line: LwcPriceLine; readonly anchor: LwcSeries }>;
    // The candlestick series of the overlay pane, lazily created on the first
    // candle event — the anchor for overlay-pane price lines.
    candleSeries: LwcSeries | undefined;
    // Per-bar candle colour overrides keyed by bar time. A `bar-color` /
    // `bar-override` emission stamps the resolved colour here; `candleData`
    // merges it onto the candlestick point (body + border + wick) so the
    // override is genuinely per-bar (LC's native per-point colour API), not a
    // whole-series tint that flickers to the last bar's colour.
    readonly barColors: Map<number, string>;
    readonly recentAlerts: AlertEmission[];
    readonly currentAlertConditions: AlertConditionEmission[];
    readonly recentLogs: LogEmission[];
    // Live drawing buffer the attached `DrawingPrimitive` overlay paints each
    // frame (last-write-wins; `op: "remove"` drops the key).
    readonly drawings: Map<string, DrawingEmission>;
    // Default visible window: frame the time scale onto the most recent N bars
    // on the FIRST frame data is present. Omitted = fit all data (the library's
    // auto-fit, unchanged behaviour).
    readonly initialVisibleBars?: number;
    // Guards the one-shot initial framing so live-bar updates and any user
    // pan/zoom are not overridden after the first time data is present.
    hasFramedInitial: boolean;
};

const HANDLE_STATE: WeakMap<LwcAdapterHandle, AdapterState> = new WeakMap();
const HANDLE_INTERVAL: WeakMap<LwcAdapterHandle, string> = new WeakMap();

function resolveChartApi(opts: CreateLightweightChartsAdapterOpts): LwcChart {
    if (opts.chartApi !== undefined) return opts.chartApi;
    if (opts.container === undefined) {
        throw new Error(
            "createLightweightChartsAdapter: provide opts.chartApi (tests) or opts.container (production)",
        );
    }
    const make = opts.createChart ?? defaultCreateChart;
    return make(opts.container);
}

// The string series-type tags the factory uses map onto the library's series
// definitions here — the one place the real lightweight-charts series consts
// are referenced, so the rest of the factory speaks only the structural
// {@link LwcSeries} shape (which the mock also satisfies).
const SERIES_DEFINITION: Readonly<Record<string, SeriesDefinition<SeriesType>>> = {
    Line: LineSeries,
    Area: AreaSeries,
    Histogram: HistogramSeries,
    Candlestick: CandlestickSeries,
};

// Production default: bridge the real lightweight-charts `IChartApi` into the
// structural {@link LwcChart} the factory speaks. It is the single place that
// resolves a string series-type tag to a library series definition and maps
// `setMarkers` onto the v5 `createSeriesMarkers` plugin. Tests pass
// `opts.chartApi` (a `MockLwcApi`) and never reach this branch — it needs a
// real DOM container, so the DOM-bound lines are coverage-exempt; the pure
// mapping helpers above it are covered.
/* v8 ignore start -- exercised only against a real DOM chart, not in CI */
// lightweight-charts brands its time axis (`UTCTimestamp`); the structural
// `LwcSeries` carries a plain epoch number. This is the single brand-narrowing
// at the library boundary (LC's own docs cast the same way).
function toTime(epoch: number): Time {
    return epoch as UTCTimestamp;
}

function toMarker(time: number): SeriesMarker<Time> {
    return {
        time: toTime(time),
        position: "aboveBar",
        shape: "circle",
        color: "#3b82f6",
    };
}

// A dark chart theme so the native chart blends into the surrounding (dark)
// card instead of rendering lightweight-charts' default white-on-light theme,
// matching the dark palette the other reference adapters carry (echarts'
// `#0b0e11`). A TRANSPARENT background lets whatever card sits behind the
// chart-surface show through, so it blends regardless of the exact card
// colour. Colours are rgb / hex (NOT the brand `oklch` tokens): the library's
// own colour parser throws on `oklch(...)`, so feeding it the resolved CSS
// custom properties — which serialise back as `oklch` — would crash the chart.
const DARK_CHART_THEME = {
    background: "transparent",
    text: "#94a3b8",
    grid: "rgba(148, 163, 184, 0.12)",
    border: "rgba(148, 163, 184, 0.2)",
    // The bull / bear candle palette, matching the canvas2d reference adapter
    // (`palette.candleBullBody` / `candleBearBody`) so the two reference
    // adapters render the same green-up / red-down candles. Applied as
    // whole-series options on the Candlestick series (NOT per-point data), so
    // they live in this DOM-only block and never enter the recorded native-call
    // log — the pinned `MockLwcApi` goldens are untouched. A per-bar
    // `bar-color` / `bar-override` still overrides these on its own data point.
    candleBull: "#26a69a",
    candleBear: "#ef5350",
} as const;

function defaultCreateChart(container: HTMLElement): LwcChart {
    const chart = createChart(container, {
        layout: {
            background: { type: ColorType.Solid, color: DARK_CHART_THEME.background },
            textColor: DARK_CHART_THEME.text,
        },
        grid: {
            vertLines: { color: DARK_CHART_THEME.grid },
            horzLines: { color: DARK_CHART_THEME.grid },
        },
        rightPriceScale: { borderColor: DARK_CHART_THEME.border },
        timeScale: { borderColor: DARK_CHART_THEME.border },
    });
    // dblclick resets the time scale to fit all data, matching canvas2d's
    // dblclick-reset. DOM-bound (this whole block is `v8 ignore`d) so the
    // headless tests, which drive `opts.chartApi` directly, never reach it.
    container.addEventListener("dblclick", () => {
        chart.timeScale().resetTimeScale();
    });
    const wrap = (
        seriesType: string,
        options: Readonly<Record<string, unknown>>,
        paneIndex: number,
    ): LwcSeries => {
        const isCandlestick = seriesType === "Candlestick";
        // Default green-up / red-down candle colours (body + border + wick),
        // matching the canvas2d reference. A per-bar `bar-color` data point
        // overrides these for its own bar.
        const candleOptions = isCandlestick
            ? {
                  upColor: DARK_CHART_THEME.candleBull,
                  downColor: DARK_CHART_THEME.candleBear,
                  borderUpColor: DARK_CHART_THEME.candleBull,
                  borderDownColor: DARK_CHART_THEME.candleBear,
                  wickUpColor: DARK_CHART_THEME.candleBull,
                  wickDownColor: DARK_CHART_THEME.candleBear,
              }
            : {};
        // The caller's `options` (e.g. `{ color: plot.color }` from
        // `applyLineLikePlot`, `lineType` for step-lines) MUST flow through to
        // the real series — otherwise every line falls back to LC's default
        // series colour and the script's `plot(..., { color })` is ignored.
        // Caller options win over the candle defaults so an explicit override
        // still applies.
        const seriesOptions = { ...candleOptions, ...options };
        const series = chart.addSeries(SERIES_DEFINITION[seriesType], seriesOptions, paneIndex);
        return {
            setData: (data) =>
                isCandlestick
                    ? series.setData(
                          data.map((p) => ({
                              time: toTime(p.time),
                              open: p.open ?? 0,
                              high: p.high ?? 0,
                              low: p.low ?? 0,
                              close: p.close ?? 0,
                              // Per-bar `bar-color` recolours body + border +
                              // wick; `borderVisible: true` so the border shows.
                              ...(p.color !== undefined
                                  ? {
                                        color: p.color,
                                        borderColor: p.borderColor,
                                        wickColor: p.wickColor,
                                        borderVisible: true,
                                    }
                                  : {}),
                          })),
                      )
                    : series.setData(data.map((p) => ({ time: toTime(p.time), value: p.value }))),
            update: (point) =>
                isCandlestick
                    ? series.update({
                          time: toTime(point.time),
                          open: point.open ?? 0,
                          high: point.high ?? 0,
                          low: point.low ?? 0,
                          close: point.close ?? 0,
                          ...(point.color !== undefined
                              ? {
                                    color: point.color,
                                    borderColor: point.borderColor,
                                    wickColor: point.wickColor,
                                    borderVisible: true,
                                }
                              : {}),
                      })
                    : series.update({ time: toTime(point.time), value: point.value }),
            applyOptions: (options) => series.applyOptions(options),
            createPriceLine: (options) => series.createPriceLine({ price: options.price }),
            removePriceLine: (line) => series.removePriceLine(line as IPriceLine),
            setMarkers: (markers) =>
                createSeriesMarkers(
                    series,
                    markers.map((m) => toMarker(m.time)),
                ),
            attachPrimitive: (primitive) =>
                series.attachPrimitive(primitive as ISeriesPrimitive<Time>),
        };
    };
    return {
        addSeries: (seriesType, options, paneIndex = 0) => wrap(seriesType, options, paneIndex),
        addPane: () => {
            chart.addPane();
            // The new pane is the last one; its index is the prior count.
            return { paneIndex: chart.panes().length - 1 };
        },
        setVisibleLogicalRange: (range) => chart.timeScale().setVisibleLogicalRange(range),
        remove: () => chart.remove(),
    };
}
/* v8 ignore stop */

function paneSlotKey(paneKey: string, slotId: string): string {
    return `${paneKey}|${slotId}`;
}

// Resolve a `PlotEmission.pane` to a native pane index. `"overlay"` is always
// 0; `"new"` allocates a fresh pane via `chart.addPane()` each time it is
// seen; a named string is allocated a stable pane on first sight and reused.
function resolvePaneIndex(state: AdapterState, pane: string): number {
    if (pane === "overlay") return 0;
    if (pane === "new") return state.chart.addPane().paneIndex;
    const existing = state.paneIndex.get(pane);
    if (existing !== undefined) return existing;
    const index = state.chart.addPane().paneIndex;
    state.paneIndex.set(pane, index);
    return index;
}

const SERIES_TYPE_FOR_KIND: Readonly<Record<string, string>> = {
    line: "Line",
    "step-line": "Line",
    area: "Area",
    histogram: "Histogram",
};

// One numeric data point for a native line / area / histogram series. A
// non-finite value becomes a whitespace point (`{ time }` only) so the
// native series leaves a gap instead of drawing a break.
function dataPoint(time: number, value: number | null): { time: number; value?: number } {
    if (value === null || !Number.isFinite(value)) return { time };
    return { time, value };
}

// The native time a plot point draws at once its universal `ta` `offset`
// (`plot.xShift`; `+n` right / future, `−n` left / past) is applied. LC is a
// native-time model: a `+5` copy renders five bar-spacings to the right of the
// unshifted point. Routes through the shared `shiftedBarTime` contract so the
// bar-offset math is defined once across every adapter. With `xShift` 0 /
// undefined `shiftedBarTime` returns the bar's own time, so a no-offset plot is
// byte-identical to `plot.time` (today's behaviour, untouched goldens).
function shiftedPlotTime(state: AdapterState, plot: PlotEmission): number {
    return shiftedBarTime({
        bars: state.bars,
        bar: plot.bar,
        xShift: plot.xShift,
        spacing: medianBarSpacing(state.bars),
    });
}

function getOrCreateSeries(
    state: AdapterState,
    plot: PlotEmission,
    seriesType: string,
    options: Readonly<Record<string, unknown>>,
): LwcSeries {
    const key = paneSlotKey(plot.pane, plot.slotId);
    const existing = state.series.get(key);
    if (existing !== undefined) return existing.series;
    const paneIndex = resolvePaneIndex(state, plot.pane);
    const series = state.chart.addSeries(seriesType, options, paneIndex);
    state.series.set(key, { series });
    return series;
}

function applyLineLikePlot(state: AdapterState, plot: PlotEmission, seriesType: string): void {
    const options: Record<string, unknown> = {};
    if (plot.style.kind === "step-line") {
        // Native step rendering: LineType.WithSteps === 1.
        options.lineType = 1;
    } else if (plot.style.kind === "line") {
        // Plain `line` plots render as a smooth curve (LineType.Curved === 2)
        // so an MA line reads as a curve rather than a faceted polyline; area
        // edges keep the default straight LineType.Simple.
        options.lineType = 2;
    }
    // Forward the emission's line width. lightweight-charts' default line width
    // is 3 (too thick vs the other adapters); the compiler default is 1, which
    // renders thin and consistent. Only the line-family styles (line / area /
    // step-line) carry `lineWidth` AND accept it as a series-creation option.
    if ("lineWidth" in plot.style) options.lineWidth = plot.style.lineWidth;
    if (plot.color !== null) options.color = plot.color;
    const series = getOrCreateSeries(state, plot, seriesType, options);
    if (plot.visible === false) {
        series.applyOptions({ visible: false });
        return;
    }
    series.update(dataPoint(shiftedPlotTime(state, plot), plot.value));
}

// `style` is passed already narrowed by the caller so the upper / lower edge
// values are reachable without re-discriminating here (no dead guard arm).
function applyFilledBand(
    state: AdapterState,
    plot: PlotEmission,
    style: Extract<PlotEmission["style"], { kind: "filled-band" }>,
): void {
    const key = paneSlotKey(plot.pane, plot.slotId);
    let entry = state.series.get(key);
    if (entry === undefined) {
        const paneIndex = resolvePaneIndex(state, plot.pane);
        // Two native line series (upper + lower). The fill BETWEEN them is a
        // Task-6 drawing — LC has no native band kind.
        const upper = state.chart.addSeries("Line", {}, paneIndex);
        const lower = state.chart.addSeries("Line", {}, paneIndex);
        entry = { series: upper, lower };
        state.series.set(key, entry);
    }
    if (plot.visible === false) {
        entry.series.applyOptions({ visible: false });
        entry.lower?.applyOptions({ visible: false });
        return;
    }
    const shiftedTime = shiftedPlotTime(state, plot);
    entry.series.update(dataPoint(shiftedTime, style.upper));
    entry.lower?.update(dataPoint(shiftedTime, style.lower));
}

function removePriceLine(state: AdapterState, key: string): void {
    const existing = state.priceLines.get(key);
    if (existing === undefined) return;
    existing.anchor.removePriceLine(existing.line);
    state.priceLines.delete(key);
}

function applyHorizontalLine(state: AdapterState, plot: PlotEmission): void {
    // The runtime re-emits a `horizontal-line` slot every bar. LC has no
    // price-line dedup, so creating one per emission would stack N overlapping
    // native lines. Track the line per `${pane}|${slotId}` and re-price the
    // SAME handle on re-sight; remove it when the slot is hidden / gone.
    const key = paneSlotKey(plot.pane, plot.slotId);
    if (plot.visible === false) {
        removePriceLine(state, key);
        return;
    }
    const price = plot.value ?? 0;
    const existing = state.priceLines.get(key);
    if (existing !== undefined) {
        existing.line.applyOptions({ price });
        return;
    }
    // First sight: anchor a native price line on the pane's candle series
    // (overlay) or the pane's first series. If neither exists yet there is
    // nothing to attach to this frame — a no-op (re-tried next bar).
    const anchor =
        plot.pane === "overlay" ? state.candleSeries : firstSeriesInPane(state, plot.pane);
    if (anchor === undefined) return;
    const line = anchor.createPriceLine({ price });
    state.priceLines.set(key, { line, anchor });
}

function firstSeriesInPane(state: AdapterState, pane: string): LwcSeries | undefined {
    const prefix = `${pane}|`;
    for (const [key, entry] of state.series) {
        if (key.startsWith(prefix)) return entry.series;
    }
    return undefined;
}

// Markers (shape / character / arrow / marker / label) attach to the overlay
// candle series via the v5 markers plugin. With no candle series yet (empty
// stream) there is nothing to anchor on — a no-op for this frame. The glyph
// shifts at its `xShift` for parity with canvas2d (which shifts glyphs too).
function applyMarker(state: AdapterState, plot: PlotEmission): void {
    if (state.candleSeries === undefined) return;
    if (plot.value === null) return;
    state.candleSeries.setMarkers([{ time: shiftedPlotTime(state, plot) }]);
}

// Whole-series candle tint — the closest native facility to Pine's
// `candle-override` (LC has no per-bar candle-override on the base series). No
// candle series yet → nothing to tint.
function applyCandleTint(state: AdapterState, options: Readonly<Record<string, unknown>>): void {
    if (state.candleSeries === undefined) return;
    state.candleSeries.applyOptions(options);
}

// Per-bar `bar-color` / `bar-override`: stamp the resolved colour onto the
// candlestick DATA POINT for this bar (body + border + wick recolour via LC's
// native per-point colour fields). The colour resolves `colorValue ?? color`
// (the dynamic-colour precedence): `colorValue` present overrides the static
// `color`; `colorValue === null` CLEARS the override (no colour this bar);
// `colorValue` omitted uses the static `color`. The candle for `plot.time` was
// already drawn this frame (before the drain), so we re-`update` it to apply.
function applyBarColor(state: AdapterState, plot: PlotEmission, color: string): void {
    if (state.candleSeries === undefined) return;
    const resolved = plot.colorValue === undefined ? color : plot.colorValue;
    if (resolved === null) {
        state.barColors.delete(plot.time);
    } else {
        state.barColors.set(plot.time, resolved);
    }
    const target = state.bars.find((b) => b.time === plot.time);
    if (target === undefined) return;
    state.candleSeries.update(candleData(state, target));
}

function applyPlot(state: AdapterState, plot: PlotEmission): void {
    const seriesType = SERIES_TYPE_FOR_KIND[plot.style.kind];
    if (seriesType !== undefined) {
        applyLineLikePlot(state, plot, seriesType);
        return;
    }
    switch (plot.style.kind) {
        case "filled-band":
            applyFilledBand(state, plot, plot.style);
            return;
        case "horizontal-line":
            applyHorizontalLine(state, plot);
            return;
        case "shape":
        case "character":
        case "arrow":
        case "marker":
        case "label":
            applyMarker(state, plot);
            return;
        case "candle-override":
            applyCandleTint(state, {
                upColor: plot.style.bull,
                downColor: plot.style.bear,
            });
            return;
        case "bar-override":
        case "bar-color":
            applyBarColor(state, plot, plot.style.color);
            return;
        case "bg-color":
        case "horizontal-histogram":
            // No native facility — deferred to a Task-6 primitive. Declared in
            // the capability surface; a documented no-op here.
            return;
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

function applyDrawing(state: AdapterState, drawing: DrawingEmission): void {
    // Buffered into the live drawings map the attached `DrawingPrimitive` reads
    // each frame. `op: "remove"` drops the key so it vanishes next paint.
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

function applyLog(state: AdapterState, log: LogEmission): void {
    state.recentLogs.push(log);
    while (state.recentLogs.length > 5) {
        state.recentLogs.shift();
    }
}

function ensureCandleSeries(state: AdapterState): LwcSeries {
    if (state.candleSeries !== undefined) return state.candleSeries;
    const series = state.chart.addSeries("Candlestick", {}, 0);
    state.candleSeries = series;
    // Anchor the drawing overlay on the overlay candle series the first time it
    // exists. The primitive reads the live `state.drawings` buffer each frame,
    // so later emissions need no re-attach. Structurally an `ISeriesPrimitive`.
    series.attachPrimitive(new DrawingPrimitive(state.drawings));
    return series;
}

type CandlePoint = {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    color?: string;
    borderColor?: string;
    wickColor?: string;
};

function candleData(state: AdapterState, bar: Bar): CandlePoint {
    // A lightweight-charts Candlestick series requires all four OHLC fields.
    // IMPORTANT: passing only `value` (the old behaviour) caused LC to read
    // `open` as undefined and throw "Value is undefined" at runtime.
    const point: CandlePoint = {
        time: bar.time,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
    };
    // A `bar-color` / `bar-override` emission for this bar recolours the body
    // AND border AND wick — LC's native per-point colour fields.
    const override = state.barColors.get(bar.time);
    if (override !== undefined) {
        point.color = override;
        point.borderColor = override;
        point.wickColor = override;
    }
    return point;
}

// Frame the time scale onto the most recent `initialVisibleBars` bars the
// FIRST time data is present. Guarded by `state.hasFramedInitial` so it fires
// exactly once — later live-bar updates and any user pan/zoom are never
// re-framed. With `initialVisibleBars` undefined this is a no-op (the library's
// default auto-fit / `fitContent` stands, unchanged behaviour).
function frameInitialWindow(state: AdapterState): void {
    if (state.hasFramedInitial) return;
    const len = state.bars.length;
    if (len === 0) return;
    state.hasFramedInitial = true;
    const visible = state.initialVisibleBars;
    if (visible === undefined) return;
    const from = Math.max(0, len - visible);
    const to = len - 1;
    state.chart.setVisibleLogicalRange({ from, to });
}

function applyCandleEvent(state: AdapterState, event: CandleEvent): void {
    if (event.streamKey !== undefined) return;
    const series = ensureCandleSeries(state);
    if (event.kind === "history") {
        state.bars.push(...event.bars);
        series.setData(event.bars.map((b) => candleData(state, b)));
        frameInitialWindow(state);
        return;
    }
    if (event.kind === "close") {
        state.bars.push(event.bar);
        series.update(candleData(state, event.bar));
        frameInitialWindow(state);
        return;
    }
    if (state.bars.length === 0) {
        state.bars.push(event.bar);
    } else {
        state.bars[state.bars.length - 1] = event.bar;
    }
    series.update(candleData(state, event.bar));
    frameInitialWindow(state);
}

/**
 * Build a frozen lightweight-charts reference adapter. Wires a chart
 * (a real `IChartApi` in a browser, or an injected {@link LwcChart} mock in
 * tests), a candle source, the adapter-kit `defineAdapter` factory, and a
 * worker host into one object. The returned `host` is exposed so the consumer
 * can `await adapter.host.load(compiled)` before driving the candle source.
 *
 * Candles, plots, horizontal lines and panes map onto lightweight-charts'
 * NATIVE series / pane facilities (see the file-header mapping). Drawings paint
 * through an attached {@link DrawingPrimitive} overlay (`decomposeDrawing` +
 * the shared canvas sink).
 *
 * @since 1.4
 * @stable
 * @example
 *     import { createLightweightChartsAdapter } from "chartlang-example-lightweight-charts-adapter";
 *     import { MockLwcApi } from "chartlang-example-lightweight-charts-adapter/testing";
 *     import { mockCandleSource } from "@invinite-org/chartlang-adapter-kit";
 *     const adapter = createLightweightChartsAdapter({
 *         chartApi: new MockLwcApi(),
 *         candleSource: mockCandleSource([]),
 *     });
 *     void adapter;
 */
export function createLightweightChartsAdapter(
    opts: CreateLightweightChartsAdapterOpts,
): LwcAdapterHandle {
    const capabilities = opts.capabilities ?? LWC_CAPABILITIES;
    const chart = resolveChartApi(opts);
    const state: AdapterState = {
        chart,
        bars: [],
        paneIndex: new Map(),
        series: new Map(),
        priceLines: new Map(),
        candleSeries: undefined,
        barColors: new Map(),
        recentAlerts: [],
        currentAlertConditions: [],
        recentLogs: [],
        drawings: new Map(),
        ...(opts.initialVisibleBars !== undefined
            ? { initialVisibleBars: opts.initialVisibleBars }
            : {}),
        hasFramedInitial: false,
    };
    const host =
        opts.host ??
        createWorkerHost(
            opts.workerLike !== undefined
                ? {
                      capabilities,
                      symInfo: LWC_SYM_INFO,
                      ...(opts.resolveInputs !== undefined
                          ? { resolveInputs: opts.resolveInputs }
                          : {}),
                      workerLike: opts.workerLike,
                  }
                : {
                      capabilities,
                      symInfo: LWC_SYM_INFO,
                      ...(opts.resolveInputs !== undefined
                          ? { resolveInputs: opts.resolveInputs }
                          : {}),
                  },
        );

    const adapter = defineAdapter({
        id: "lightweight-charts-reference",
        name: "Lightweight Charts Reference Adapter",
        capabilities,
        ...(opts.resolveInputs !== undefined ? { resolveInputs: opts.resolveInputs } : {}),
        symInfo: LWC_SYM_INFO,
        candles: () => opts.candleSource,
        onEmissions: (emissions) => ingest(state, emissions, opts.onAlert),
        dispose: () => {
            state.bars.length = 0;
            state.paneIndex.clear();
            state.series.clear();
            // The chart's `remove()` below tears down its series + price lines;
            // dropping our references is enough (no per-line removePriceLine).
            state.priceLines.clear();
            state.candleSeries = undefined;
            state.barColors.clear();
            state.recentAlerts.length = 0;
            state.currentAlertConditions.length = 0;
            state.recentLogs.length = 0;
            state.drawings.clear();
            state.hasFramedInitial = false;
            state.chart.remove();
            host.dispose();
        },
    });

    const handle: LwcAdapterHandle = Object.freeze({ ...adapter, host });
    HANDLE_STATE.set(handle, state);
    HANDLE_INTERVAL.set(handle, opts.interval ?? DEFAULT_INTERVAL);
    return handle;
}

/**
 * Optional second argument for {@link runRendererLoop}. Pass a `signal` from
 * an `AbortController` to cancel the loop cleanly: once the signal aborts the
 * loop drops the remaining work and resolves (no throw), matching the
 * canvas2d adapter's cancellation contract.
 *
 * @since 1.4
 * @stable
 * @example
 *     const opts: RunRendererLoopOpts = { signal: new AbortController().signal };
 *     void opts;
 */
export type RunRendererLoopOpts = Readonly<{
    signal?: AbortSignal;
}>;

/**
 * Drive a built adapter through one full pass of its candle source: iterate
 * the events, mirror each into the native chart + bar window, `await
 * host.push(event)`, then `host.drain()` + `adapter.onEmissions(...)` between
 * events. Returns when the source completes; throws whatever the source /
 * host throws. Pass `opts.signal` to cancel cleanly (returns silently on
 * abort).
 *
 * @since 1.4
 * @stable
 * @example
 *     import { createLightweightChartsAdapter, runRendererLoop } from "chartlang-example-lightweight-charts-adapter";
 *     import { MockLwcApi } from "chartlang-example-lightweight-charts-adapter/testing";
 *     import { mockCandleSource } from "@invinite-org/chartlang-adapter-kit";
 *     const adapter = createLightweightChartsAdapter({
 *         chartApi: new MockLwcApi(),
 *         candleSource: mockCandleSource([]),
 *     });
 *     // await adapter.host.load(compiled);
 *     // await runRendererLoop(adapter);
 *     const fn: typeof runRendererLoop = runRendererLoop;
 *     void fn;
 */
export async function runRendererLoop(
    handle: LwcAdapterHandle,
    opts: RunRendererLoopOpts = {},
): Promise<void> {
    const state = HANDLE_STATE.get(handle);
    const interval = HANDLE_INTERVAL.get(handle);
    if (state === undefined || interval === undefined) {
        throw new Error(
            "runRendererLoop: handle was not produced by createLightweightChartsAdapter",
        );
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
        // dispatch before the drain frame is processed (matches canvas2d).
        await new Promise<void>((r) => setTimeout(r, 0));
        if (aborted()) return;
        const emissions = await handle.host.drain();
        if (aborted()) return;
        handle.onEmissions(emissions);
    }
}
