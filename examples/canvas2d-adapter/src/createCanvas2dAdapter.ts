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
    defineAdapter,
    validateEmission,
} from "@invinite-org/chartlang-adapter-kit";
import type { Bar } from "@invinite-org/chartlang-core";
import {
    type ScriptHost,
    type WorkerLike,
    createWorkerHost,
} from "@invinite-org/chartlang-host-worker";

import { CANVAS2D_CAPABILITIES, CANVAS2D_SYM_INFO } from "./capabilities.js";
import { DEFAULT_PALETTE, type Palette } from "./palette.js";
import {
    type HLine,
    type PaneLayoutEntry,
    type PlotPoint,
    type RenderCtx,
    type Viewport,
    clearPaneRect,
    computePaneLayout,
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
    drawHorizontalHistogram,
    drawHorizontalLine,
    drawLine,
    drawLogPane,
    drawPaneSeparator,
    drawShape,
    drawYAxis,
    drawingDispatch,
    medianBarSpacing,
    priceToY,
    projectShiftedX,
    shiftedBarTime,
    timeToX,
} from "./render/index.js";

const DEFAULT_INTERVAL = "1D";
// Badges persist on the chart at the bar where each alert fired, so the
// buffer is sized for a whole session rather than a short feed.
const MAX_RECENT_ALERTS = 256;
const Y_AXIS_PADDING = 0.05;
// Right-edge gutter reserved on every pane for the price-axis labels.
// The plot area (`viewport.pxWidth`) is the pane width minus this gutter,
// so candles / series / hlines stop short of the labels.
const Y_AXIS_GUTTER_PX = 52;
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
    /**
     * When supplied, only alerts for which this returns `true` are kept
     * in the on-canvas badge buffer (`recentAlerts`). `onAlert` still
     * receives every alert. Lets a host hide e.g. history-replay
     * alerts from the chart without losing its own feed.
     */
    readonly alertBadgeFilter?: (a: AlertEmission) => boolean;
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

// `HLine` lives in `render/coords.ts` (consumed structurally by
// `drawHorizontalLine`); the adapter widens it with the resolved pane
// key so the render walk can route each hline into its pane's rect.
type PanedHLine = HLine & { readonly paneKey: string };

type AdapterState = {
    readonly ctx: RenderCtx;
    readonly canvas: { width: number; height: number };
    readonly bars: Bar[];
    // Distinct pane keys in first-emit order; `"overlay"` is always at
    // index 0. Mutable — `applyPlot` pushes a new key on first sight and
    // `dispose` resets it.
    paneOrder: string[];
    // Keyed by `${paneKey}|${slotId}` so the same callsite can land in
    // different panes and a pane's y-scale only sees its own series.
    readonly plotSeries: Map<string, PlotPoint[]>;
    readonly plotSeriesStyle: Map<string, PlotStyle>;
    readonly plotOverlays: Map<string, PlotEmission>;
    // Keyed by slotId (last-write-wins); the value carries its pane key.
    readonly hlines: Map<string, PanedHLine>;
    readonly recentAlerts: AlertEmission[];
    readonly currentAlertConditions: AlertConditionEmission[];
    readonly recentLogs: LogEmission[];
    readonly drawings: Map<string, DrawingEmission>;
    readonly palette: Palette;
};

function paneSlotKey(paneKey: string, slotId: string): string {
    return `${paneKey}|${slotId}`;
}

// Per-pane filter prefix for `plotSeries` / `plotSeriesStyle` keys. The
// canonical key separator (`|`) is owned by `paneSlotKey`; this returns
// the prefix only so callers can `key.startsWith(...)` without
// re-asserting the separator at each site.
function paneKeyPrefix(paneKey: string): string {
    return `${paneKey}|`;
}

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

// Collect the y-range a single pane should span. The overlay pane sees
// bars ∪ overlay-keyed series ∪ overlay-keyed hlines; a subpane sees
// only its own series + hlines (so an RSI band in 0-100 never stretches
// the price scale). Returns `+Inf` / `-Inf` if no finite candidate was
// observed — the caller maps that to the (0, 1) fallback.
function computeYRange(state: AdapterState, paneKey: string): { yMin: number; yMax: number } {
    let yMin = Number.POSITIVE_INFINITY;
    let yMax = Number.NEGATIVE_INFINITY;
    if (paneKey === "overlay") {
        for (const bar of state.bars) {
            if (bar.low < yMin) yMin = bar.low;
            if (bar.high > yMax) yMax = bar.high;
        }
    }
    const prefix = paneKeyPrefix(paneKey);
    for (const [key, series] of state.plotSeries) {
        if (!key.startsWith(prefix)) continue;
        for (const point of series) {
            if (point.value === null) continue;
            if (point.value < yMin) yMin = point.value;
            if (point.value > yMax) yMax = point.value;
        }
    }
    for (const hline of state.hlines.values()) {
        if (hline.paneKey !== paneKey) continue;
        if (hline.price < yMin) yMin = hline.price;
        if (hline.price > yMax) yMax = hline.price;
    }
    return { yMin, yMax };
}

// Largest finite world `time` anchored anywhere in a drawing's state.
// Drawing anchors persist as absolute world `(time, price)` tuples
// (every `WorldPoint` plus `vertical-line`'s bare `time`), so a
// future-projected anchor — e.g. `forecast-line`'s `draw.line` whose
// forward endpoint resolves to `lastTime + k * spacing` — would render
// off the right edge unless it widens `xMax`, exactly like a `+k` plot
// shift. Walks the state structurally so the 60-kind `DrawingState`
// union needs no per-kind anchor enumeration: any nested object/array
// is recursed; a `time` key with a finite number is a candidate.
function maxDrawingAnchorTime(state: object, acc: number): number {
    let max = acc;
    for (const [key, child] of Object.entries(state)) {
        if (key === "time" && Number.isFinite(child)) {
            max = Math.max(max, child as number);
        } else if (child !== null && typeof child === "object") {
            max = maxDrawingAnchorTime(child, max);
        }
    }
    return max;
}

// Widen `xMax` so any future-projected (`+k`) point in this pane stays
// inside the viewport instead of being clipped past the data edge.
// Walks the pane's series points (and, for the overlay pane, the glyph
// overlays plus every drawing's anchors) for a positive `xShift` /
// future anchor whose target reaches past the last bar, taking the
// largest projected target time. No-shift frames with no future-anchored
// drawing leave `xMax` untouched, so the baseline render is byte-identical.
function extendXMaxForShifts(
    state: AdapterState,
    paneKey: string,
    spacing: number,
    xMax: number,
): number {
    const { bars } = state;
    let extended = xMax;
    const consider = (bar: number, xShift: number | undefined): void => {
        if (xShift === undefined || xShift <= 0) return;
        const t = shiftedBarTime({ bars, bar, xShift, spacing });
        if (t > extended) extended = t;
    };
    const prefix = paneKeyPrefix(paneKey);
    for (const [key, series] of state.plotSeries) {
        if (!key.startsWith(prefix)) continue;
        for (const point of series) {
            if (point.value === null || !Number.isFinite(point.value)) continue;
            consider(point.bar, point.xShift);
        }
    }
    if (paneKey === "overlay") {
        for (const plot of state.plotOverlays.values()) {
            if (plot.value === null) continue;
            // Only the shifted-series glyphs (shape / character / arrow)
            // honour `xShift`; candle-state overrides
            // (bg / bar / candle-override, horizontal-histogram) keep their
            // own anchor and must not widen the viewport.
            if (
                plot.style.kind !== "shape" &&
                plot.style.kind !== "character" &&
                plot.style.kind !== "arrow"
            ) {
                continue;
            }
            consider(plot.bar, plot.xShift);
        }
        // Drawings render only in the overlay pane (`renderOverlayTail`).
        // Their anchors carry absolute world times, so a future endpoint
        // widens `xMax` directly — no `xShift` / `spacing` indirection.
        for (const drawing of state.drawings.values()) {
            extended = maxDrawingAnchorTime(drawing.state, extended);
        }
    }
    return extended;
}

// Build the y-scale for a single pane. The `pxWidth`/`pxHeight` come from
// the pane's rect, so the pure render helpers (which map against
// `viewport.pxHeight`) emit pane-relative y.
function computePaneViewport(
    state: AdapterState,
    entry: PaneLayoutEntry,
    spacing: number,
): Viewport {
    const { bars } = state;
    const { rect, paneKey } = entry;
    // Reserve the right gutter for the price axis; the plot area is the
    // pane width minus the gutter (clamped so a sub-gutter pane stays ≥ 1).
    const plotWidth = Math.max(1, rect.w - Y_AXIS_GUTTER_PX);
    if (bars.length === 0) {
        return {
            xMin: 0,
            xMax: 1,
            yMin: 0,
            yMax: 1,
            pxWidth: plotWidth,
            pxHeight: rect.h,
        };
    }
    let xMin = Number.POSITIVE_INFINITY;
    let xMax = Number.NEGATIVE_INFINITY;
    for (const bar of bars) {
        if (bar.time < xMin) xMin = bar.time;
        if (bar.time > xMax) xMax = bar.time;
    }
    xMax = extendXMaxForShifts(state, paneKey, spacing, xMax);
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
        pxWidth: plotWidth,
        pxHeight: rect.h,
    };
}

function renderHistogramSeries(
    ctx: RenderCtx,
    series: ReadonlyArray<PlotPoint>,
    baseline: number,
    world: { readonly bars: ReadonlyArray<Bar>; readonly spacing: number },
    viewport: Viewport,
    palette: Palette,
): void {
    const baselineY = priceToY(baseline, viewport);
    for (const point of series) {
        if (point.value === null || !Number.isFinite(point.value)) continue;
        drawHistogram(
            ctx,
            {
                x: projectShiftedX(
                    {
                        bars: world.bars,
                        bar: point.bar,
                        xShift: point.xShift,
                        spacing: world.spacing,
                    },
                    viewport,
                ),
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

function renderGlyphOverlays(state: AdapterState, spacing: number, viewport: Viewport): void {
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
        // Glyph plots (shape / character / arrow) are shifted series
        // visuals, so they route through the same bar-offset projection as
        // line / histogram instead of `timeToX(plot.time)`.
        const x = projectShiftedX(
            { bars: state.bars, bar: plot.bar, xShift: plot.xShift, spacing },
            viewport,
        );
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

// Drawings, alert badges, alert conditions, and the log pane are all
// overlay-bound (pane-routed drawings are deferred — see the README).
// Drawn against the overlay viewport inside the overlay-pane translate
// so they share the price pane's coordinate space.
function renderOverlayTail(state: AdapterState, viewport: Viewport): void {
    for (const drawing of state.drawings.values()) {
        drawingDispatch(state.ctx, drawing, viewport);
    }
    if (state.bars.length === 0) {
        drawLogPane(state.ctx, state.recentLogs, viewport, state.palette);
        return;
    }
    const lastBar = state.bars[state.bars.length - 1];
    for (const alert of state.recentAlerts) {
        // Anchor each badge at the bar where the alert fired; alerts
        // whose bar index is outside the rendered range (e.g. a host
        // that trimmed history) fall back to the latest bar.
        const anchorBar = state.bars[alert.bar] ?? lastBar;
        const x = timeToX(anchorBar.time, viewport);
        const y = priceToY(anchorBar.high, viewport);
        drawAlertBadge(state.ctx, alert, { x, y }, state.palette);
    }
    drawAlertConditions(state.ctx, state.currentAlertConditions, viewport, state.palette);
    drawLogPane(state.ctx, state.recentLogs, viewport, state.palette);
}

// Draw every plot series belonging to one pane, dispatching histogram
// styles to `renderHistogramSeries` and everything else to `drawLine`.
// `spacing` is the run's median bar spacing, threaded into the shifted-
// series x projection both render paths share.
function renderPaneSeries(
    state: AdapterState,
    paneKey: string,
    spacing: number,
    viewport: Viewport,
): void {
    const prefix = paneKeyPrefix(paneKey);
    const world = { bars: state.bars, spacing };
    for (const [key, series] of state.plotSeries) {
        if (!key.startsWith(prefix)) continue;
        const style = state.plotSeriesStyle.get(key);
        if (style !== undefined && style.kind === "histogram") {
            renderHistogramSeries(
                state.ctx,
                series,
                style.baseline,
                world,
                viewport,
                state.palette,
            );
            continue;
        }
        drawLine(state.ctx, series, world, viewport, state.palette);
    }
}

function renderFrame(state: AdapterState): void {
    const layout = computePaneLayout(state.paneOrder, state.canvas);
    // Median adjacent-bar spacing of the run, computed once per frame and
    // threaded into every shifted-series projection so a `+k` shift past
    // the data edge extrapolates a target time from a stable cadence.
    const spacing = medianBarSpacing(state.bars);
    // Captured during the pane walk so `renderOverlayTail` reuses the
    // overlay pane's viewport without a second O(bars+series) pass.
    // `computePaneLayout` is required to emit `"overlay"` at index 0, so
    // the first loop iteration populates this.
    let overlayViewport: Viewport | undefined;
    let overlayRectY = 0;

    for (const entry of layout) {
        const viewport = computePaneViewport(state, entry, spacing);
        if (entry.paneKey === "overlay") {
            overlayViewport = viewport;
            overlayRectY = entry.rect.y;
        }
        clearPaneRect(state.ctx, entry.rect, state.palette);
        state.ctx.save();
        // Shift the origin to the pane's top so the pure render helpers,
        // which map y against `viewport.pxHeight`, draw inside the rect.
        state.ctx.translate(0, entry.rect.y);

        // Price axis first (faint gridlines + gutter labels) so candles and
        // series draw on top. Skipped on empty frames — there is no scale.
        if (state.bars.length > 0) drawYAxis(state.ctx, viewport, state.palette);

        if (entry.paneKey === "overlay") {
            renderBackgroundOverlays(state, viewport);
            drawCandles(state.ctx, state.bars, viewport, state.palette);
            renderBarOverlays(state, viewport);
        }
        renderPaneSeries(state, entry.paneKey, spacing, viewport);
        if (entry.paneKey === "overlay") renderGlyphOverlays(state, spacing, viewport);
        for (const hline of state.hlines.values()) {
            if (hline.paneKey !== entry.paneKey) continue;
            drawHorizontalLine(state.ctx, hline, viewport, state.palette);
        }

        state.ctx.restore();
        // The separator divides a subpane from the pane above it; drawn
        // in untranslated canvas space because `rect.y` is absolute.
        if (entry.paneKey !== "overlay") {
            drawPaneSeparator(state.ctx, entry.rect, state.palette);
        }
    }

    if (overlayViewport !== undefined) {
        state.ctx.save();
        state.ctx.translate(0, overlayRectY);
        renderOverlayTail(state, overlayViewport);
        state.ctx.restore();
    }
}

function applyPlot(state: AdapterState, plot: PlotEmission): void {
    // A host override hid this slot: contribute nothing — no series point,
    // hline, or overlay. `computePaneViewport` derives its y-range from
    // `plotSeries`, so dropping the point here also excludes the hidden
    // slot from the scale (a hidden oscillator never stretches the viewport).
    if (plot.visible === false) return;
    const paneKey = plot.pane;
    if (paneKey !== "overlay" && !state.paneOrder.includes(paneKey)) {
        state.paneOrder.push(paneKey);
    }
    if (
        plot.style.kind === "line" ||
        plot.style.kind === "step-line" ||
        plot.style.kind === "histogram"
    ) {
        const key = paneSlotKey(paneKey, plot.slotId);
        const series = state.plotSeries.get(key) ?? [];
        series.push({
            time: plot.time,
            value: plot.value,
            color: plot.color,
            bar: plot.bar,
            // Omit a no-shift `xShift` so the stored point (and therefore
            // the rendered x) is byte-identical to a pre-feature emission.
            ...(plot.xShift === undefined || plot.xShift === 0 ? {} : { xShift: plot.xShift }),
        });
        state.plotSeries.set(key, series);
        state.plotSeriesStyle.set(key, plot.style);
        return;
    }
    if (plot.style.kind === "horizontal-line") {
        state.hlines.set(plot.slotId, {
            price: plot.value ?? 0,
            color: plot.color,
            lineWidth: plot.style.lineWidth,
            lineStyle: plot.style.lineStyle,
            paneKey,
        });
        return;
    }
    // Glyph / per-bar overlays (shape, marker, character, arrow,
    // bg-color, bar-color, candle/bar-override, horizontal-histogram)
    // are keyed by slot id AND bar time so a callsite that emits on
    // many bars accumulates one overlay per bar. Keying by slot id
    // alone would collapse every emission to the last bar's value —
    // e.g. crossover marks would show only at the final crossover.
    // Re-emission within an in-progress bar (ticks) shares the bar's
    // time, so last-write-wins per bar is preserved.
    state.plotOverlays.set(`${plot.slotId}@${plot.time}`, plot);
}

function applyAlert(
    state: AdapterState,
    alert: AlertEmission,
    onAlert?: (a: AlertEmission) => void,
    badgeFilter?: (a: AlertEmission) => boolean,
): void {
    if (badgeFilter === undefined || badgeFilter(alert)) {
        state.recentAlerts.push(alert);
        while (state.recentAlerts.length > MAX_RECENT_ALERTS) {
            state.recentAlerts.shift();
        }
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
    badgeFilter?: (a: AlertEmission) => boolean,
): void {
    applyValidated(emissions.plots, (plot) => applyPlot(state, plot));
    applyValidated(emissions.drawings, (drawing) => applyDrawing(state, drawing));
    applyValidated(emissions.alerts, (alert) => applyAlert(state, alert, onAlert, badgeFilter));
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
        paneOrder: ["overlay"],
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
            ingest(state, emissions, opts.onAlert, opts.alertBadgeFilter);
            renderFrame(state);
        },
        dispose: () => {
            state.bars.length = 0;
            state.paneOrder = ["overlay"];
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
