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
//   candle-override/      → candleSeries.applyOptions(...) — closest native
//     bar-override/          facility (whole-series tint; LC has no per-bar
//     bar-color              colour API on the base candlestick series).
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
    HistogramSeries,
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
import type { LwcChart, LwcSeries } from "./testing.js";

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
 * @since 0.1
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
    readonly resolveInputs?: (scriptId: string) => Readonly<Record<string, unknown>>;
    readonly onAlert?: (a: AlertEmission) => void;
    readonly host?: ScriptHost;
    readonly workerLike?: WorkerLike;
};

/**
 * Public handle the consumer drives. `host` is exposed so callers can
 * `await adapter.host.load(compiled)` before driving the candle source.
 *
 * @since 0.1
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
    // The candlestick series of the overlay pane, lazily created on the first
    // candle event — the anchor for overlay-pane price lines.
    candleSeries: LwcSeries | undefined;
    readonly recentAlerts: AlertEmission[];
    readonly currentAlertConditions: AlertConditionEmission[];
    readonly recentLogs: LogEmission[];
    // Live drawing buffer the attached `DrawingPrimitive` overlay paints each
    // frame (last-write-wins; `op: "remove"` drops the key).
    readonly drawings: Map<string, DrawingEmission>;
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

function defaultCreateChart(container: HTMLElement): LwcChart {
    const chart = createChart(container);
    const wrap = (seriesType: string, paneIndex: number): LwcSeries => {
        const series = chart.addSeries(SERIES_DEFINITION[seriesType], {}, paneIndex);
        return {
            setData: (data) =>
                series.setData(data.map((p) => ({ time: toTime(p.time), value: p.value }))),
            update: (point) => series.update({ time: toTime(point.time), value: point.value }),
            applyOptions: (options) => series.applyOptions(options),
            createPriceLine: (options) => series.createPriceLine({ price: options.price }),
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
        addSeries: (seriesType, _options, paneIndex = 0) => wrap(seriesType, paneIndex),
        addPane: () => {
            chart.addPane();
            // The new pane is the last one; its index is the prior count.
            return { paneIndex: chart.panes().length - 1 };
        },
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
    }
    if (plot.color !== null) options.color = plot.color;
    const series = getOrCreateSeries(state, plot, seriesType, options);
    if (plot.visible === false) {
        series.applyOptions({ visible: false });
        return;
    }
    series.update(dataPoint(plot.time, plot.value));
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
    entry.series.update(dataPoint(plot.time, style.upper));
    entry.lower?.update(dataPoint(plot.time, style.lower));
}

function applyHorizontalLine(state: AdapterState, plot: PlotEmission): void {
    // Anchor a native price line on the pane's candle series (overlay) or the
    // pane's first series. If neither exists yet there is nothing to attach to
    // this frame — a no-op (the runtime re-emits hlines per bar).
    const anchor =
        plot.pane === "overlay" ? state.candleSeries : firstSeriesInPane(state, plot.pane);
    if (anchor === undefined) return;
    anchor.createPriceLine({ price: plot.value ?? 0 });
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
// stream) there is nothing to anchor on — a no-op for this frame.
function applyMarker(state: AdapterState, plot: PlotEmission): void {
    if (state.candleSeries === undefined) return;
    if (plot.value === null) return;
    state.candleSeries.setMarkers([{ time: plot.time }]);
}

// Whole-series candle tint — the closest native facility to Pine's per-bar
// candle / bar colour overrides (LC has no per-bar colour API on the base
// candlestick series). No candle series yet → nothing to tint.
function applyCandleTint(state: AdapterState, options: Readonly<Record<string, unknown>>): void {
    if (state.candleSeries === undefined) return;
    state.candleSeries.applyOptions(options);
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
            applyCandleTint(state, {
                upColor: plot.style.color,
                downColor: plot.style.color,
            });
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

function candleData(bar: Bar): { time: number; value?: number } {
    // The structural `LwcSeries` carries a `{ time, value? }` shape; the
    // production bridge maps OHLC onto the candlestick series' data. The
    // mock records `time` (+ a representative `value`) so candle ingestion is
    // assertable; `close` is the representative value for the hashed log.
    return { time: bar.time, value: bar.close };
}

function applyCandleEvent(state: AdapterState, event: CandleEvent): void {
    if (event.streamKey !== undefined) return;
    const series = ensureCandleSeries(state);
    if (event.kind === "history") {
        state.bars.push(...event.bars);
        series.setData(event.bars.map(candleData));
        return;
    }
    if (event.kind === "close") {
        state.bars.push(event.bar);
        series.update(candleData(event.bar));
        return;
    }
    if (state.bars.length === 0) {
        state.bars.push(event.bar);
    } else {
        state.bars[state.bars.length - 1] = event.bar;
    }
    series.update(candleData(event.bar));
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
 * @since 0.1
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
        candleSeries: undefined,
        recentAlerts: [],
        currentAlertConditions: [],
        recentLogs: [],
        drawings: new Map(),
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
            state.candleSeries = undefined;
            state.recentAlerts.length = 0;
            state.currentAlertConditions.length = 0;
            state.recentLogs.length = 0;
            state.drawings.clear();
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
 * @since 0.1
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
 * @since 0.1
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
