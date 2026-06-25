// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import {
    type AlertConditionEmission,
    type AlertEmission,
    type DrawingEmission,
    type LogEmission,
    type PlotEmission,
    type RunnerEmissions,
    validateEmission,
} from "@invinite-org/chartlang-adapter-kit";

import { type AdapterState, paneSlotKey } from "./state.js";

// Badges persist on the chart at the bar where each alert fired, so the
// buffer is sized for a whole session rather than a short feed.
const MAX_RECENT_ALERTS = 256;
const MAX_RECENT_LOGS = 5;

// Accumulate one validated plot / hline / overlay emission into state, exactly
// like the canvas2d reference's `applyPlot`: last-write-wins per slot,
// pane-keyed series, `z` / `seq` assigned at ingest, override stores keyed by
// `${slotId}@${time}`, and the line-family `colorValue` retained per point.
function applyPlot(state: AdapterState, plot: PlotEmission): void {
    // A host override hid this slot: contribute nothing — no series point,
    // hline, or overlay. Dropping the point here also excludes the hidden slot
    // from the y-scale (`buildFrame` derives its range from `plotSeries`).
    if (plot.visible === false) return;
    const paneKey = plot.pane;
    // One declaration-sequence number per ingested mark (ingest order = script
    // declaration order). `z` defaults to `0`.
    const seq = state.seq++;
    const z = plot.z ?? 0;
    if (paneKey !== "overlay" && !state.paneOrder.includes(paneKey)) {
        state.paneOrder.push(paneKey);
    }
    if (
        plot.style.kind === "line" ||
        plot.style.kind === "step-line" ||
        plot.style.kind === "histogram" ||
        plot.style.kind === "area" ||
        plot.style.kind === "filled-band"
    ) {
        const key = paneSlotKey(paneKey, plot.slotId);
        const series = state.plotSeries.get(key) ?? [];
        series.push({
            time: plot.time,
            value: plot.value,
            color: plot.color,
            bar: plot.bar,
            // Omit a no-shift `xShift` so the stored point is byte-identical
            // to a pre-feature emission.
            ...(plot.xShift === undefined || plot.xShift === 0 ? {} : { xShift: plot.xShift }),
            z,
            seq,
            // A `filled-band` carries its per-bar edges on the point (the band
            // geometry IS the series); every other style reads `value` only.
            ...(plot.style.kind === "filled-band"
                ? { upper: plot.style.upper, lower: plot.style.lower }
                : {}),
            // Per-bar dynamic color. Omit when absent so a no-`colorValue`
            // point is byte-identical; the descriptor builders resolve the
            // 3-state precedence via `resolvePaintColor`.
            ...(plot.colorValue === undefined ? {} : { colorValue: plot.colorValue }),
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
            z,
            seq,
        });
        return;
    }
    // Glyph / per-bar overlays (shape / character / arrow / marker / label /
    // bg-color / bar-color / candle-override / bar-override /
    // horizontal-histogram) are keyed by slot id AND bar time so a callsite
    // emitting on many bars accumulates one overlay per bar (keying by slot
    // alone would collapse to the last bar). Re-emission within an in-progress
    // bar (ticks) shares the bar's time, so last-write-wins per bar holds.
    const overlayKey = `${plot.slotId}@${plot.time}`;
    state.plotOverlays.set(overlayKey, plot);
    state.overlaySeq.set(overlayKey, seq);
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
    while (state.recentLogs.length > MAX_RECENT_LOGS) {
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
    // Declaration sequence beside the emission (which carries `z`).
    // Last-write-wins per handle, matching the drawing's own dedup.
    state.drawingSeq.set(drawing.handleId, state.seq++);
}

function applyValidated<T>(items: ReadonlyArray<T>, apply: (item: T) => void): void {
    for (const item of items) {
        if (validateEmission(item).ok) apply(item);
    }
}

/**
 * Accumulate one drained {@link RunnerEmissions} batch into the renderer
 * {@link AdapterState} — the WebGL adapter's pure ingestion pass, reproducing
 * the post-parity canvas2d reference semantics exactly:
 *
 * - every emission is validated via the shared `validateEmission` and dropped
 *   if invalid;
 * - plots accumulate last-write-wins per `${paneKey}|${slotId}` series (or per
 *   `${slotId}@${time}` overlay), with `z` / `seq` assigned at ingest and the
 *   line-family `colorValue` 3-state retained per point;
 * - `bg-color` / `bar-color` / `candle-override` / `bar-override` /
 *   `horizontal-histogram` land in the overlay store (drawn in Task 14);
 * - `currentAlertConditions` is replaced per batch; alerts + logs are ring
 *   buffers; drawings honour `op:"remove"`.
 *
 * Pure — no GL, no DOM, no rendering. Task 5's `onEmissions` calls this then
 * `buildFrame` + GL paint.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { createAdapterState, applyEmissions } from "chartlang-example-webgl-adapter";
 *     const state = createAdapterState();
 *     applyEmissions(state, {
 *         plots: [], drawings: [], alerts: [], alertConditions: [],
 *         logs: [], diagnostics: [],
 *     });
 *     void state;
 */
export function applyEmissions(
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
