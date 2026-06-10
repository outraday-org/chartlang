// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import {
    defineAdapter,
    validateEmission,
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
} from "@invinite-org/chartlang-adapter-kit";
import {
    createWorkerHost,
    type ScriptHost,
    type WorkerLike,
} from "@invinite-org/chartlang-host-worker";

import { CANVAS2D_CAPABILITIES, CANVAS2D_SYM_INFO } from "./capabilities.js";
import { DEFAULT_PALETTE, type Palette } from "./palette.js";
import {
    clear,
    drawAlertBadge,
    drawAlertConditions,
    drawArrow,
    drawBarColor,
    drawBarOverride,
    drawBgColor,
    drawCandleOverride,
    drawCandles,
    drawCharacter,
    drawHistogram,
    drawHorizontalLine,
    drawHorizontalHistogram,
    drawLogPane,
    drawLine,
    drawShape,
    drawingDispatch,
    priceToY,
    timeToX,
    type HLine,
    type PlotPoint,
    type RenderCtx,
    type Viewport,
} from "./render/index.js";

const DEFAULT_INTERVAL = "1D";
const MAX_RECENT_ALERTS = 8;
const Y_AXIS_PADDING = 0.05;
const HISTOGRAM_BAR_WIDTH_PX = 4;
const HORIZONTAL_HISTOGRAM_MAX_WIDTH_PX = 96;
const HORIZONTAL_HISTOGRAM_ROW_HEIGHT_PX = 6;

/**
 * Constructor options for {@link createCanvas2dAdapter}. The
 * `host`/`workerLike` fields exist as test seams: production callers
 * leave them undefined and the adapter spins up a real Web Worker via
 * {@link createWorkerHost}; tests inject a `MessageChannel`-backed
 * `WorkerLike` or a pre-built `ScriptHost` directly. Likewise
 * `ctx` lets tests supply a {@link RenderCtx} mock directly when
 * `canvas.getContext("2d")` is not available.
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const canvas: HTMLCanvasElement;
 *     declare const candleSource: AsyncIterable<CandleEvent>;
 *     const opts: CreateCanvas2dAdapterOpts = { canvas, candleSource };
 *     void opts;
 */
export type CreateCanvas2dAdapterOpts = {
    readonly canvas: HTMLCanvasElement | OffscreenCanvas | { width: number; height: number };
    readonly ctx?: RenderCtx;
    readonly candleSource: AsyncIterable<CandleEvent>;
    readonly capabilities?: Capabilities;
    readonly interval?: string;
    readonly palette?: Palette;
    readonly resolveInputs?: (scriptId: string) => Readonly<Record<string, unknown>>;
    readonly onAlert?: (a: AlertEmission) => void;
    readonly host?: ScriptHost;
    readonly workerLike?: WorkerLike;
};

/**
 * Public handle the consumer drives. `host` is exposed so callers can
 * `await adapter.host.load(compiled)` before invoking
 * {@link runRendererLoop}.
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const adapter: Canvas2dAdapterHandle;
 *     // await adapter.host.load(compiled);
 *     void adapter;
 */
export type Canvas2dAdapterHandle = Adapter & { readonly host: ScriptHost };

type AdapterState = {
    readonly ctx: RenderCtx;
    readonly canvas: { width: number; height: number };
    readonly bars: Bar[];
    readonly plotSeries: Map<string, PlotPoint[]>;
    readonly plotSeriesStyle: Map<string, PlotStyle>;
    readonly plotOverlays: Map<string, PlotEmission>;
    readonly hlines: Map<string, HLine>;
    readonly recentAlerts: AlertEmission[];
    readonly currentAlertConditions: AlertConditionEmission[];
    readonly recentLogs: LogEmission[];
    readonly drawings: Map<string, DrawingEmission>;
    readonly palette: Palette;
};

const HANDLE_STATE: WeakMap<Canvas2dAdapterHandle, AdapterState> = new WeakMap();
const HANDLE_INTERVAL: WeakMap<Canvas2dAdapterHandle, string> = new WeakMap();

function resolveCtx(opts: CreateCanvas2dAdapterOpts): RenderCtx {
    if (opts.ctx !== undefined) return opts.ctx;
    const fromCanvas = (opts.canvas as { getContext?: (id: "2d") => RenderCtx | null }).getContext;
    if (typeof fromCanvas !== "function") {
        throw new Error(
            "createCanvas2dAdapter: canvas has no getContext('2d') and no opts.ctx supplied",
        );
    }
    const ctx = fromCanvas.call(opts.canvas, "2d");
    if (ctx === null) {
        throw new Error("createCanvas2dAdapter: canvas.getContext('2d') returned null");
    }
    return ctx;
}

function computeViewport(state: AdapterState): Viewport {
    const { bars, plotSeries, canvas } = state;
    if (bars.length === 0) {
        return {
            xMin: 0,
            xMax: 1,
            yMin: 0,
            yMax: 1,
            pxWidth: canvas.width,
            pxHeight: canvas.height,
        };
    }
    let xMin = Number.POSITIVE_INFINITY;
    let xMax = Number.NEGATIVE_INFINITY;
    let yMin = Number.POSITIVE_INFINITY;
    let yMax = Number.NEGATIVE_INFINITY;
    for (const bar of bars) {
        if (bar.time < xMin) xMin = bar.time;
        if (bar.time > xMax) xMax = bar.time;
        if (bar.low < yMin) yMin = bar.low;
        if (bar.high > yMax) yMax = bar.high;
    }
    for (const series of plotSeries.values()) {
        for (const point of series) {
            if (point.value === null) continue;
            if (point.value < yMin) yMin = point.value;
            if (point.value > yMax) yMax = point.value;
        }
    }
    if (yMin === yMax) {
        yMin -= 1;
        yMax += 1;
    }
    const yPad = (yMax - yMin) * Y_AXIS_PADDING;
    return {
        xMin,
        xMax: xMax === xMin ? xMin + 1 : xMax,
        yMin: yMin - yPad,
        yMax: yMax + yPad,
        pxWidth: canvas.width,
        pxHeight: canvas.height,
    };
}

function renderHistogramSeries(
    ctx: RenderCtx,
    series: ReadonlyArray<PlotPoint>,
    baseline: number,
    viewport: Viewport,
    palette: Palette,
): void {
    const baselineY = priceToY(baseline, viewport);
    for (const point of series) {
        if (point.value === null || !Number.isFinite(point.value)) continue;
        drawHistogram(
            ctx,
            {
                x: timeToX(point.time, viewport),
                y: priceToY(point.value, viewport),
                baseline: baselineY,
                color: point.color,
                width: HISTOGRAM_BAR_WIDTH_PX,
            },
            palette,
        );
    }
}

function renderBackgroundOverlays(state: AdapterState, viewport: Viewport): void {
    for (const plot of state.plotOverlays.values()) {
        if (plot.style.kind !== "bg-color") continue;
        drawBgColor(
            state.ctx,
            {
                time: plot.time,
                color: plot.style.color,
                ...(plot.style.transp === undefined ? {} : { transp: plot.style.transp }),
                barCount: state.bars.length,
            },
            viewport,
        );
    }
}

function renderBarOverlays(state: AdapterState, viewport: Viewport): void {
    for (const plot of state.plotOverlays.values()) {
        const bar = state.bars.find((candidate) => candidate.time === plot.time);
        if (bar === undefined) continue;
        switch (plot.style.kind) {
            case "candle-override":
                drawCandleOverride(
                    state.ctx,
                    {
                        bar,
                        bull: plot.style.bull,
                        bear: plot.style.bear,
                        ...(plot.style.doji === undefined ? {} : { doji: plot.style.doji }),
                        barCount: state.bars.length,
                    },
                    viewport,
                );
                break;
            case "bar-override":
                drawBarOverride(
                    state.ctx,
                    { bar, color: plot.style.color, barCount: state.bars.length },
                    viewport,
                );
                break;
            case "bar-color":
                drawBarColor(
                    state.ctx,
                    { bar, color: plot.style.color, barCount: state.bars.length },
                    viewport,
                );
                break;
            default:
                break;
        }
    }
}

function withLocation<L>(location: L | undefined): { location?: L } {
    return location === undefined ? {} : { location };
}

function renderGlyphOverlays(state: AdapterState, viewport: Viewport): void {
    for (const plot of state.plotOverlays.values()) {
        if (plot.style.kind === "horizontal-histogram") {
            drawHorizontalHistogram(
                state.ctx,
                {
                    buckets: plot.style.buckets,
                    maxWidth: HORIZONTAL_HISTOGRAM_MAX_WIDTH_PX,
                    rowHeight: HORIZONTAL_HISTOGRAM_ROW_HEIGHT_PX,
                },
                viewport,
                state.palette,
            );
            continue;
        }
        if (plot.value === null) continue;
        const x = timeToX(plot.time, viewport);
        const y = priceToY(plot.value, viewport);
        switch (plot.style.kind) {
            case "shape":
                drawShape(
                    state.ctx,
                    {
                        x,
                        y,
                        shape: plot.style.shape,
                        size: plot.style.size,
                        ...withLocation(plot.style.location),
                        color: plot.color,
                    },
                    state.palette,
                );
                break;
            case "character":
                drawCharacter(
                    state.ctx,
                    {
                        x,
                        y,
                        char: plot.style.char,
                        size: plot.style.size,
                        ...withLocation(plot.style.location),
                        color: plot.color,
                    },
                    state.palette,
                );
                break;
            case "arrow":
                drawArrow(
                    state.ctx,
                    {
                        x,
                        y,
                        direction: plot.style.direction,
                        size: plot.style.size,
                        color: plot.color,
                    },
                    state.palette,
                );
                break;
            default:
                break;
        }
    }
}

function renderFrame(state: AdapterState): void {
    const viewport = computeViewport(state);
    clear(state.ctx, viewport, state.palette);
    renderBackgroundOverlays(state, viewport);
    drawCandles(state.ctx, state.bars, viewport, state.palette);
    renderBarOverlays(state, viewport);
    for (const [slotId, series] of state.plotSeries) {
        const style = state.plotSeriesStyle.get(slotId);
        if (style !== undefined && style.kind === "histogram") {
            renderHistogramSeries(state.ctx, series, style.baseline, viewport, state.palette);
            continue;
        }
        drawLine(state.ctx, series, viewport, state.palette);
    }
    renderGlyphOverlays(state, viewport);
    for (const hline of state.hlines.values()) {
        drawHorizontalLine(state.ctx, hline, viewport, state.palette);
    }
    for (const drawing of state.drawings.values()) {
        drawingDispatch(state.ctx, drawing, viewport);
    }
    if (state.bars.length === 0) {
        drawLogPane(state.ctx, state.recentLogs, viewport, state.palette);
        return;
    }
    const lastBar = state.bars[state.bars.length - 1];
    const x = timeToX(lastBar.time, viewport);
    const y = priceToY(lastBar.high, viewport);
    for (const alert of state.recentAlerts) {
        drawAlertBadge(state.ctx, alert, { x, y }, state.palette);
    }
    drawAlertConditions(state.ctx, state.currentAlertConditions, viewport, state.palette);
    drawLogPane(state.ctx, state.recentLogs, viewport, state.palette);
}

function applyPlot(state: AdapterState, plot: PlotEmission): void {
    if (
        plot.style.kind === "line" ||
        plot.style.kind === "step-line" ||
        plot.style.kind === "histogram"
    ) {
        const series = state.plotSeries.get(plot.slotId) ?? [];
        series.push({ time: plot.time, value: plot.value, color: plot.color });
        state.plotSeries.set(plot.slotId, series);
        state.plotSeriesStyle.set(plot.slotId, plot.style);
        return;
    }
    if (plot.style.kind === "horizontal-line") {
        state.hlines.set(plot.slotId, {
            price: plot.value ?? 0,
            color: plot.color,
            lineWidth: plot.style.lineWidth,
            lineStyle: plot.style.lineStyle,
        });
        return;
    }
    state.plotOverlays.set(plot.slotId, plot);
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

function applyAlertCondition(state: AdapterState, condition: AlertConditionEmission): void {
    state.currentAlertConditions.push(condition);
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
    applyValidated(emissions.alertConditions, (condition) => applyAlertCondition(state, condition));
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
 * Build a frozen canvas2d reference adapter. Wires a `<canvas>`
 * (or `OffscreenCanvas`, or a structural `{ width, height }` plus an
 * explicit `opts.ctx` — the testing path), a candle source, the
 * adapter-kit `defineAdapter` factory, and a worker host into one
 * object. The returned `host` is exposed so the consumer can
 * `await adapter.host.load(compiled)` before invoking
 * {@link runRendererLoop}.
 *
 * The adapter's `onEmissions` callback validates every emission via
 * {@link validateEmission}, accumulates plot / horizontal-line / alert
 * state, and redraws the frame against `opts.canvas`.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { createCanvas2dAdapter } from "chartlang-example-canvas2d-adapter";
 *     import { mockCandleSource } from "@invinite-org/chartlang-adapter-kit";
 *     declare const canvas: HTMLCanvasElement;
 *     const adapter = createCanvas2dAdapter({
 *         canvas,
 *         candleSource: mockCandleSource([]),
 *     });
 *     void adapter;
 */
export function createCanvas2dAdapter(opts: CreateCanvas2dAdapterOpts): Canvas2dAdapterHandle {
    const capabilities = opts.capabilities ?? CANVAS2D_CAPABILITIES;
    const palette = opts.palette ?? DEFAULT_PALETTE;
    const ctx = resolveCtx(opts);
    const state: AdapterState = {
        ctx,
        canvas: { width: opts.canvas.width, height: opts.canvas.height },
        bars: [],
        plotSeries: new Map(),
        plotSeriesStyle: new Map(),
        plotOverlays: new Map(),
        hlines: new Map(),
        recentAlerts: [],
        currentAlertConditions: [],
        recentLogs: [],
        drawings: new Map(),
        palette,
    };
    const host =
        opts.host ??
        createWorkerHost(
            opts.workerLike !== undefined
                ? {
                      capabilities,
                      symInfo: CANVAS2D_SYM_INFO,
                      ...(opts.resolveInputs !== undefined
                          ? { resolveInputs: opts.resolveInputs }
                          : {}),
                      workerLike: opts.workerLike,
                  }
                : {
                      capabilities,
                      symInfo: CANVAS2D_SYM_INFO,
                      ...(opts.resolveInputs !== undefined
                          ? { resolveInputs: opts.resolveInputs }
                          : {}),
                  },
        );

    const adapter = defineAdapter({
        id: "canvas2d-reference",
        name: "Canvas 2D Reference Adapter",
        capabilities,
        ...(opts.resolveInputs !== undefined ? { resolveInputs: opts.resolveInputs } : {}),
        symInfo: CANVAS2D_SYM_INFO,
        candles: () => opts.candleSource,
        onEmissions: (emissions) => {
            ingest(state, emissions, opts.onAlert);
            renderFrame(state);
        },
        dispose: () => {
            state.bars.length = 0;
            state.plotSeries.clear();
            state.plotSeriesStyle.clear();
            state.plotOverlays.clear();
            state.hlines.clear();
            state.recentAlerts.length = 0;
            state.currentAlertConditions.length = 0;
            state.recentLogs.length = 0;
            state.drawings.clear();
            host.dispose();
        },
    });

    const handle: Canvas2dAdapterHandle = Object.freeze({ ...adapter, host });
    HANDLE_STATE.set(handle, state);
    HANDLE_INTERVAL.set(handle, opts.interval ?? DEFAULT_INTERVAL);
    return handle;
}

/**
 * Optional second argument for {@link runRendererLoop}. Pass a
 * `signal` from an `AbortController` to cancel the loop cleanly:
 * once the signal aborts, the loop drops the current iteration's
 * remaining work, breaks out of the async-iterator, and resolves
 * (no throw). This is the convention every consumer needs when a
 * React component unmounts mid-stream — the loop returns silently
 * and the caller does not have to swallow rejections.
 *
 * @since 0.5
 * @stable
 * @example
 *     const opts: RunRendererLoopOpts = { signal: new AbortController().signal };
 *     void opts;
 */
export type RunRendererLoopOpts = Readonly<{
    signal?: AbortSignal;
}>;

/**
 * Drive a built adapter through one full pass of its candle source:
 * iterate the events, mirror them into the renderer's bar window,
 * `await host.push(event)` for each, and call `host.drain()` +
 * `adapter.onEmissions(...)` between events. Returns when the source
 * completes; throws whatever the source / host throws.
 *
 * Pass `opts.signal` (typically from an `AbortController`) to cancel
 * the loop cleanly. On abort the loop returns silently — no throw —
 * after finishing at most one in-flight `host.push` / `host.drain`.
 * This lets React consumers unmount mid-stream without swallowing
 * rejections from a torn-down adapter.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { createCanvas2dAdapter, runRendererLoop } from "chartlang-example-canvas2d-adapter";
 *     import { mockCandleSource } from "@invinite-org/chartlang-adapter-kit";
 *     declare const canvas: HTMLCanvasElement;
 *     const adapter = createCanvas2dAdapter({
 *         canvas,
 *         candleSource: mockCandleSource([]),
 *     });
 *     // await adapter.host.load(compiled);
 *     // await runRendererLoop(adapter);
 *     const fn: typeof runRendererLoop = runRendererLoop;
 *     void fn;
 */
export async function runRendererLoop(
    handle: Canvas2dAdapterHandle,
    opts: RunRendererLoopOpts = {},
): Promise<void> {
    const state = HANDLE_STATE.get(handle);
    const interval = HANDLE_INTERVAL.get(handle);
    if (state === undefined || interval === undefined) {
        throw new Error("runRendererLoop: handle was not produced by createCanvas2dAdapter");
    }
    const signal = opts.signal;
    const aborted = (): boolean => signal?.aborted ?? false;
    if (aborted()) return;
    for await (const event of handle.candles({ interval })) {
        if (aborted()) return;
        applyCandleEvent(state, event);
        await handle.host.push(event);
        if (aborted()) return;
        // Yield once so an async worker host can complete its
        // candle-event dispatch before the drain frame is processed.
        // In-process hosts resolve `push` synchronously and the
        // microtask flush below is a no-op for them.
        await new Promise<void>((r) => setTimeout(r, 0));
        if (aborted()) return;
        const emissions = await handle.host.drain();
        if (aborted()) return;
        handle.onEmissions(emissions);
    }
}
