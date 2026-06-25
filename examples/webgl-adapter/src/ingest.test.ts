// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    AlertConditionEmission,
    AlertEmission,
    DrawingEmission,
    LogEmission,
    PlotEmission,
    PlotStyle,
    RunnerEmissions,
} from "@invinite-org/chartlang-adapter-kit";
import type { DrawingState } from "@invinite-org/chartlang-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { applyEmissions } from "./ingest.js";
import { type AdapterState, createAdapterState, paneSlotKey } from "./state.js";

function plotEmission(overrides: Partial<PlotEmission> & { slotId: string }): PlotEmission {
    return {
        kind: "plot",
        slotId: overrides.slotId,
        title: overrides.title ?? "",
        style: overrides.style ?? { kind: "line", lineWidth: 1, lineStyle: "solid" },
        bar: overrides.bar ?? 0,
        time: overrides.time ?? 1000,
        value: "value" in overrides ? (overrides.value as number | null) : 100,
        color: overrides.color ?? null,
        meta: overrides.meta ?? {},
        pane: overrides.pane ?? "overlay",
        ...(overrides.visible === undefined ? {} : { visible: overrides.visible }),
        ...(overrides.xShift === undefined ? {} : { xShift: overrides.xShift }),
        ...(overrides.z === undefined ? {} : { z: overrides.z }),
        ...("colorValue" in overrides ? { colorValue: overrides.colorValue } : {}),
    };
}

function emissions(overrides: Partial<RunnerEmissions> = {}): RunnerEmissions {
    return {
        plots: overrides.plots ?? [],
        drawings: overrides.drawings ?? [],
        alerts: overrides.alerts ?? [],
        alertConditions: overrides.alertConditions ?? [],
        logs: overrides.logs ?? [],
        diagnostics: overrides.diagnostics ?? [],
        fromBar: overrides.fromBar ?? 0,
        toBar: overrides.toBar ?? 0,
    };
}

function alertEmission(overrides: Partial<AlertEmission> & { slotId: string }): AlertEmission {
    return {
        kind: "alert",
        slotId: overrides.slotId,
        severity: overrides.severity ?? "info",
        message: overrides.message ?? "hi",
        bar: overrides.bar ?? 0,
        time: overrides.time ?? 1000,
        meta: overrides.meta ?? {},
        channels: overrides.channels ?? ["log"],
        dedupeKey: overrides.dedupeKey ?? "k",
    };
}

function logEmission(message: string): LogEmission {
    return { kind: "log", level: "info", message, bar: 0, time: 1000, meta: {} };
}

const LINE_STATE: DrawingState = {
    kind: "line",
    anchors: [
        { time: 0, price: 0 },
        { time: 1, price: 1 },
    ],
    style: {},
} as unknown as DrawingState;

function drawingEmission(handleId: string, op: DrawingEmission["op"]): DrawingEmission {
    return {
        kind: "drawing",
        handleId,
        op,
        drawingKind: "line",
        state: LINE_STATE,
        bar: 0,
        time: 0,
    };
}

let state: AdapterState;
beforeEach(() => {
    state = createAdapterState();
});

describe("applyEmissions — plot series accumulation", () => {
    it("accumulates line points keyed by ${paneKey}|${slotId}", () => {
        applyEmissions(state, emissions({ plots: [plotEmission({ slotId: "a", value: 1 })] }));
        applyEmissions(state, emissions({ plots: [plotEmission({ slotId: "a", value: 2 })] }));
        const series = state.plotSeries.get(paneSlotKey("overlay", "a"));
        expect(series?.map((p) => p.value)).toEqual([1, 2]);
    });

    it("partitions the same slot id into different panes", () => {
        applyEmissions(
            state,
            emissions({
                plots: [
                    plotEmission({ slotId: "x", pane: "overlay", value: 1 }),
                    plotEmission({ slotId: "x", pane: "rsi", value: 2 }),
                ],
            }),
        );
        expect(state.plotSeries.get(paneSlotKey("overlay", "x"))?.length).toBe(1);
        expect(state.plotSeries.get(paneSlotKey("rsi", "x"))?.length).toBe(1);
        expect(state.paneOrder).toEqual(["overlay", "rsi"]);
    });

    it("hides a visible:false slot entirely (no series, no scale contribution)", () => {
        applyEmissions(
            state,
            emissions({ plots: [plotEmission({ slotId: "h", visible: false, value: 5 })] }),
        );
        expect(state.plotSeries.size).toBe(0);
    });

    it("assigns z (default 0) and a global declaration seq at ingest", () => {
        applyEmissions(
            state,
            emissions({
                plots: [
                    plotEmission({ slotId: "a", value: 1, z: 2 }),
                    plotEmission({ slotId: "b", value: 1 }),
                ],
            }),
        );
        const a = state.plotSeries.get(paneSlotKey("overlay", "a"))?.[0];
        const b = state.plotSeries.get(paneSlotKey("overlay", "b"))?.[0];
        expect(a?.z).toBe(2);
        expect(b?.z).toBe(0);
        expect(a?.seq).toBe(0);
        expect(b?.seq).toBe(1);
    });

    it("retains line-family colorValue 3-state (omitted / present / null)", () => {
        applyEmissions(
            state,
            emissions({
                plots: [
                    plotEmission({ slotId: "a", value: 1 }),
                    plotEmission({ slotId: "a", value: 2, colorValue: "#111" }),
                    plotEmission({ slotId: "a", value: 3, colorValue: null }),
                ],
            }),
        );
        const series = state.plotSeries.get(paneSlotKey("overlay", "a"));
        expect("colorValue" in (series?.[0] ?? {})).toBe(false);
        expect(series?.[1].colorValue).toBe("#111");
        expect(series?.[2].colorValue).toBeNull();
    });

    it("omits a zero / absent xShift but stores a non-zero one", () => {
        applyEmissions(
            state,
            emissions({
                plots: [
                    plotEmission({ slotId: "a", value: 1, xShift: 0 }),
                    plotEmission({ slotId: "a", value: 2, xShift: 3 }),
                ],
            }),
        );
        const series = state.plotSeries.get(paneSlotKey("overlay", "a"));
        expect("xShift" in (series?.[0] ?? {})).toBe(false);
        expect(series?.[1].xShift).toBe(3);
    });

    it("stores a filled-band's per-bar edges on the point", () => {
        const style: PlotStyle = { kind: "filled-band", upper: 10, lower: 2, alpha: 0.2 };
        applyEmissions(
            state,
            emissions({ plots: [plotEmission({ slotId: "band", value: null, style })] }),
        );
        const series = state.plotSeries.get(paneSlotKey("overlay", "band"));
        expect(series?.[0].upper).toBe(10);
        expect(series?.[0].lower).toBe(2);
    });
});

describe("applyEmissions — hlines + overlays", () => {
    it("stores a horizontal-line last-write-wins per slot, carrying its pane", () => {
        const style: PlotStyle = { kind: "horizontal-line", lineWidth: 1, lineStyle: "dashed" };
        applyEmissions(
            state,
            emissions({ plots: [plotEmission({ slotId: "h", value: 70, style, pane: "rsi" })] }),
        );
        applyEmissions(
            state,
            emissions({ plots: [plotEmission({ slotId: "h", value: 30, style, pane: "rsi" })] }),
        );
        const hline = state.hlines.get("h");
        expect(hline?.price).toBe(30);
        expect(hline?.paneKey).toBe("rsi");
    });

    it("keys glyph / override overlays by slot AND bar time (one per bar)", () => {
        const style: PlotStyle = { kind: "shape", shape: "circle", size: 1 };
        applyEmissions(
            state,
            emissions({
                plots: [
                    plotEmission({ slotId: "s", time: 1000, value: 1, style }),
                    plotEmission({ slotId: "s", time: 2000, value: 1, style }),
                ],
            }),
        );
        expect(state.plotOverlays.size).toBe(2);
        expect(state.overlaySeq.size).toBe(2);
    });

    it("routes the candle-override style into the overlay store", () => {
        const style: PlotStyle = { kind: "candle-override", bull: "#0f0", bear: "#f00" };
        applyEmissions(
            state,
            emissions({ plots: [plotEmission({ slotId: "co", value: null, style })] }),
        );
        expect(state.plotOverlays.get("co@1000")?.style.kind).toBe("candle-override");
    });
});

describe("applyEmissions — alerts, conditions, logs, drawings", () => {
    it("rings the alert buffer and honours the badge filter", () => {
        applyEmissions(
            state,
            emissions({
                alerts: [
                    alertEmission({ slotId: "a", dedupeKey: "1" }),
                    alertEmission({ slotId: "a", dedupeKey: "2", message: "drop" }),
                ],
            }),
            undefined,
            (a) => a.message !== "drop",
        );
        expect(state.recentAlerts).toHaveLength(1);
    });

    it("invokes onAlert for every alert regardless of the badge filter", () => {
        const onAlert = vi.fn();
        applyEmissions(
            state,
            emissions({ alerts: [alertEmission({ slotId: "a" })] }),
            onAlert,
            () => false,
        );
        expect(onAlert).toHaveBeenCalledTimes(1);
        expect(state.recentAlerts).toHaveLength(0);
    });

    it("replaces alert conditions per batch (current-frame semantics)", () => {
        const cond = (id: string): AlertConditionEmission => ({
            kind: "alert-condition",
            conditionId: id,
            title: id,
            description: id,
            defaultMessage: id,
            fired: true,
            bar: 0,
            time: 1000,
        });
        applyEmissions(state, emissions({ alertConditions: [cond("a"), cond("b")] }));
        expect(state.currentAlertConditions).toHaveLength(2);
        applyEmissions(state, emissions({ alertConditions: [cond("c")] }));
        expect(state.currentAlertConditions.map((c) => c.conditionId)).toEqual(["c"]);
    });

    it("caps the log ring buffer at 5", () => {
        applyEmissions(
            state,
            emissions({ logs: Array.from({ length: 8 }, (_, i) => logEmission(`m${i}`)) }),
        );
        expect(state.recentLogs).toHaveLength(5);
        expect(state.recentLogs[0].message).toBe("m3");
    });

    it("adds then removes a drawing, clearing its seq", () => {
        applyEmissions(state, emissions({ drawings: [drawingEmission("d1", "create")] }));
        expect(state.drawings.has("d1")).toBe(true);
        expect(state.drawingSeq.has("d1")).toBe(true);
        applyEmissions(state, emissions({ drawings: [drawingEmission("d1", "remove")] }));
        expect(state.drawings.has("d1")).toBe(false);
        expect(state.drawingSeq.has("d1")).toBe(false);
    });
});

describe("applyEmissions — validation + diagnostics", () => {
    it("drops an invalid emission (non-finite value) before accumulating", () => {
        const bad = plotEmission({ slotId: "x", value: Number.NaN });
        applyEmissions(state, emissions({ plots: [bad] }));
        expect(state.plotSeries.size).toBe(0);
    });

    it("warns on warning / error diagnostics", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        applyEmissions(
            state,
            emissions({
                diagnostics: [
                    {
                        kind: "diagnostic",
                        severity: "error",
                        code: "unsupported-plot-kind",
                        message: "boom",
                        slotId: null,
                        bar: 0,
                    },
                    {
                        kind: "diagnostic",
                        severity: "info",
                        code: "unsupported-plot-kind",
                        message: "fyi",
                        slotId: null,
                        bar: 0,
                    },
                ],
            }),
        );
        expect(warn).toHaveBeenCalledTimes(1);
        warn.mockRestore();
    });
});

afterEach(() => {
    vi.restoreAllMocks();
});
