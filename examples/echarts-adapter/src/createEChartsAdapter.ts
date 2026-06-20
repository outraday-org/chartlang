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
    decomposeDrawing,
    defineAdapter,
    validateEmission,
} from "@invinite-org/chartlang-adapter-kit";
import type { Bar } from "@invinite-org/chartlang-core";
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

/**
 * Constructor options for {@link createEChartsAdapter}. The `host`/`workerLike`
 * fields exist as test seams: production callers leave them undefined and the
 * adapter spins up a real Web Worker via {@link createWorkerHost}; tests inject
 * a `MessageChannel`-backed `WorkerLike` or a pre-built `ScriptHost` directly.
 * `echartsFactory` lets tests supply an {@link EChartsSurface} mock; production
 * callers pass a factory that returns `echarts.init(container)`.
 *
 * @since 1.5
 * @experimental
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
 * @since 1.5
 * @experimental
 * @example
 *     import type { EChartsAdapterHandle } from "chartlang-example-echarts-adapter";
 *     declare const adapter: EChartsAdapterHandle;
 *     // await adapter.host.load(compiled);
 *     void adapter;
 */
export type EChartsAdapterHandle = Adapter & { readonly host: ScriptHost };

// A stored line/area/histogram series point, aligned to its bar index so the
// option builder can scatter it into a per-bar data array (gaps become `GAP`).
// `style` is captured only for `filled-band`, whose per-bar `upper`/`lower`
// bounds ride the emission's style (not its `value`); other kinds leave it
// undefined and the series-level style governs.
type SeriesPoint = {
    readonly bar: number;
    readonly value: number | null;
    readonly color: string | null;
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
    // Last background colour an emission requested (bg-color), or undefined.
    bgColor: string | undefined;
    readonly recentAlerts: AlertEmission[];
    readonly currentAlertConditions: AlertConditionEmission[];
    readonly recentLogs: LogEmission[];
    // Drawings are buffered here for Task 10's `graphic`-path renderer; this
    // task does not paint them.
    readonly drawings: Map<string, DrawingEmission>;
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
// `GAP` for missing / non-finite bars so ECharts breaks the line.
function seriesData(points: ReadonlyArray<SeriesPoint>, barCount: number): Array<number | string> {
    const data: Array<number | string> = new Array(barCount).fill(GAP);
    for (const point of points) {
        if (point.bar < 0 || point.bar >= barCount) continue;
        if (point.value === null || !Number.isFinite(point.value)) continue;
        data[point.bar] = point.value;
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

function lineSeries(
    name: string,
    series: StoredSeries,
    barCount: number,
    grid: number,
    extra: Partial<LineSeriesOption>,
): LineSeriesOption {
    return {
        type: "line",
        name,
        xAxisIndex: grid,
        yAxisIndex: grid,
        showSymbol: false,
        connectNulls: false,
        lineStyle: { color: seriesColor(series) },
        itemStyle: { color: seriesColor(series) },
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
        if (point.bar < 0 || point.bar >= barCount) continue;
        const style = point.style;
        if (style === undefined || style.kind !== "filled-band") continue;
        const bound = pick(style);
        if (bound === null || !Number.isFinite(bound)) continue;
        data[point.bar] = bound;
    }
    return data;
}

// Decompose every live drawing against the chart's viewport into ECharts
// `graphic` elements. `op:"remove"` drawings are already dropped from
// `state.drawings` by `applyDrawing`, so only live drawings are seen here.
// Non-finite primitives are filtered out (see `primitiveIsFinite`).
function buildGraphics(state: AdapterState): EChartsGraphicElement[] {
    const view = buildViewport(state.chart, state.bars);
    const graphics: EChartsGraphicElement[] = [];
    for (const drawing of state.drawings.values()) {
        for (const prim of decomposeDrawing(drawing, view)) {
            if (primitiveIsFinite(prim)) graphics.push(primitiveToGraphic(prim));
        }
    }
    return graphics;
}

function buildOption(state: AdapterState): EChartsOption {
    const barCount = state.bars.length;
    const categories = state.bars.map((bar) => bar.time);
    const grids = state.paneOrder.map((_paneKey, i) => ({
        left: 48,
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
    }));
    const yAxes = state.paneOrder.map((_paneKey, i) => ({
        type: "value" as const,
        gridIndex: i,
        scale: true,
    }));

    const series: SeriesOption[] = [];

    // Candlestick on the overlay grid (index 0). Per-bar itemStyle overrides
    // (candle-override / bar-override / bar-color) tint individual bodies.
    if (barCount > 0) {
        series.push({
            type: "candlestick",
            name: "candles",
            xAxisIndex: 0,
            yAxisIndex: 0,
            data: state.bars.map((bar) => {
                const override = state.candleStyles.get(bar.time);
                const value = [bar.open, bar.close, bar.low, bar.high];
                return override === undefined
                    ? value
                    : { value, itemStyle: { color: override.color, color0: override.color } };
            }),
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
                    lineSeries(name, stored, barCount, grid, {
                        ...(stored.style.kind === "step-line" ? { step: "end" } : {}),
                    }),
                );
                break;
            case "area":
                series.push(
                    lineSeries(name, stored, barCount, grid, {
                        areaStyle: { opacity: stored.style.fillAlpha },
                    }),
                );
                break;
            case "histogram":
            case "horizontal-histogram":
                series.push(barSeries(name, stored, barCount, grid));
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
                    data: bandData(stored.points, barCount, (s) => s.lower),
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
                    data: bandData(stored.points, barCount, (s) =>
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
                series.push(glyphSeries(name, stored, grid));
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
        backgroundColor: state.bgColor ?? state.backgroundColor,
        grid: grids,
        xAxis: xAxes,
        yAxis: yAxes,
        series,
        graphic: buildGraphics(state),
    };
}

// Glyph plot kinds (label / marker / shape / character / arrow) render as a
// `scatter` series carrying a `markPoint`-style symbol at each anchor. Glyph
// kinds ECharts cannot express natively defer to Task 10's `graphic` path.
function glyphSeries(name: string, series: StoredSeries, grid: number): ScatterSeriesOption {
    const data: Array<[number, number]> = [];
    for (const point of series.points) {
        if (point.value === null || !Number.isFinite(point.value)) continue;
        data.push([point.bar, point.value]);
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
        case "bar-color":
            state.candleStyles.set(plot.time, { color: plot.style.color });
            return;
        case "bg-color":
            // Pine `bgcolor` band → chart background (last-write-wins). A true
            // per-bar background band needs the Task-10 `graphic` path.
            state.bgColor = plot.style.color;
            return;
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
 * @since 1.5
 * @experimental
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
        bgColor: undefined,
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
            state.chart.setOption(buildOption(state), { notMerge: true });
        },
        dispose: () => {
            state.bars.length = 0;
            state.paneOrder = ["overlay"];
            state.series.clear();
            state.hlines.clear();
            state.candleStyles.clear();
            state.bgColor = undefined;
            state.recentAlerts.length = 0;
            state.currentAlertConditions.length = 0;
            state.recentLogs.length = 0;
            state.drawings.clear();
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
 * @since 1.5
 * @experimental
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
 * @since 1.5
 * @experimental
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
