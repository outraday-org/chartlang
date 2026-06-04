// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { AlertEmission, PlotEmission } from "@invinite-org/chartlang-adapter-kit";
import { describe, expect, it } from "vitest";

import type { MutableRunnerEmissions } from "../runtimeContext";
import { pushAlert, pushDiagnostic, pushPlot } from "./emissionsQueue";

function makeQueue(): MutableRunnerEmissions {
    return {
        plots: [],
        drawings: [],
        alerts: [],
        diagnostics: [],
        fromBar: 0,
        toBar: 0,
    };
}

function makePlot(slotId: string, bar: number, value: number | null): PlotEmission {
    return {
        kind: "plot",
        slotId,
        title: "",
        style: { kind: "line", lineWidth: 1, lineStyle: "solid" },
        bar,
        time: 1_700_000_000_000,
        value,
        color: null,
        meta: {},
        pane: "overlay",
    };
}

function makeAlert(slotId: string, bar: number, message: string): AlertEmission {
    return {
        kind: "alert",
        slotId,
        severity: "info",
        message,
        bar,
        time: 1_700_000_000_000,
        meta: {},
        channels: Object.freeze(["toast"] as const),
        dedupeKey: `${slotId}::${bar}::deadbeef`,
    };
}

describe("pushPlot", () => {
    it("appends a valid PlotEmission", () => {
        const q = makeQueue();
        const p = makePlot("a:1:1#0", 0, 42);
        pushPlot(q, p);
        expect(q.plots).toEqual([p]);
        expect(q.diagnostics).toEqual([]);
    });

    it("dedups (slotId, bar) — last write wins", () => {
        const q = makeQueue();
        const p1 = makePlot("a:1:1#0", 0, 1);
        const p2 = makePlot("a:1:1#0", 0, 2);
        pushPlot(q, p1);
        pushPlot(q, p2);
        expect(q.plots).toEqual([p2]);
    });

    it("appends a second plot with different slotId", () => {
        const q = makeQueue();
        const p1 = makePlot("a:1:1#0", 0, 1);
        const p2 = makePlot("b:1:1#0", 0, 2);
        pushPlot(q, p1);
        pushPlot(q, p2);
        expect(q.plots).toEqual([p1, p2]);
    });

    it("appends a second plot with the same slotId but different bar", () => {
        const q = makeQueue();
        const p1 = makePlot("a:1:1#0", 0, 1);
        const p2 = makePlot("a:1:1#0", 1, 2);
        pushPlot(q, p1);
        pushPlot(q, p2);
        expect(q.plots).toEqual([p1, p2]);
    });

    it("drops a malformed plot and emits a malformed-emission diagnostic", () => {
        const q = makeQueue();
        // `value: NaN` violates the §7.3 universal payload rule (no
        // non-finite numbers); `validateEmission` rejects it.
        const bad: PlotEmission = { ...makePlot("a:1:1#0", 0, 0), value: Number.NaN };
        pushPlot(q, bad);
        expect(q.plots).toEqual([]);
        expect(q.diagnostics).toHaveLength(1);
        expect(q.diagnostics[0].code).toBe("malformed-emission");
        expect(q.diagnostics[0].slotId).toBe("a:1:1#0");
    });
});

describe("pushAlert", () => {
    it("appends a valid AlertEmission", () => {
        const q = makeQueue();
        const a = makeAlert("a:1:1#0", 0, "hi");
        pushAlert(q, a);
        expect(q.alerts).toEqual([a]);
        expect(q.diagnostics).toEqual([]);
    });

    it("dedups (slotId, bar) — last write wins", () => {
        const q = makeQueue();
        const a1 = makeAlert("a:1:1#0", 0, "one");
        const a2 = makeAlert("a:1:1#0", 0, "two");
        pushAlert(q, a1);
        pushAlert(q, a2);
        expect(q.alerts).toEqual([a2]);
    });

    it("appends a second alert with different slotId", () => {
        const q = makeQueue();
        const a1 = makeAlert("a:1:1#0", 0, "one");
        const a2 = makeAlert("b:1:1#0", 0, "two");
        pushAlert(q, a1);
        pushAlert(q, a2);
        expect(q.alerts).toEqual([a1, a2]);
    });

    it("appends a second alert with the same slotId but different bar", () => {
        const q = makeQueue();
        const a1 = makeAlert("a:1:1#0", 0, "one");
        const a2 = makeAlert("a:1:1#0", 1, "two");
        pushAlert(q, a1);
        pushAlert(q, a2);
        expect(q.alerts).toEqual([a1, a2]);
    });

    it("drops a malformed alert and emits a malformed-emission diagnostic", () => {
        const q = makeQueue();
        // Empty message fails `validateAlertEmission` ("must be a non-empty string").
        const bad: AlertEmission = { ...makeAlert("a:1:1#0", 0, "hi"), message: "" };
        pushAlert(q, bad);
        expect(q.alerts).toEqual([]);
        expect(q.diagnostics).toHaveLength(1);
        expect(q.diagnostics[0].code).toBe("malformed-emission");
    });
});

describe("pushDiagnostic", () => {
    it("appends unconditionally", () => {
        const q = makeQueue();
        pushDiagnostic(q, {
            kind: "diagnostic",
            severity: "warning",
            code: "unsupported-plot-kind",
            message: "drop",
            slotId: "a:1:1#0",
            bar: 0,
        });
        expect(q.diagnostics).toHaveLength(1);
    });

    it("appends a second diagnostic with the same slotId+bar", () => {
        const q = makeQueue();
        const d = {
            kind: "diagnostic" as const,
            severity: "warning" as const,
            code: "unsupported-plot-kind" as const,
            message: "drop",
            slotId: "a:1:1#0",
            bar: 0,
        };
        pushDiagnostic(q, d);
        pushDiagnostic(q, d);
        expect(q.diagnostics).toHaveLength(2);
    });
});
