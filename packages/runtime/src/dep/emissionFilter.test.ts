// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    AlertConditionEmission,
    AlertEmission,
    DrawingEmission,
    LogEmission,
    PlotEmission,
    RuntimeDiagnostic,
} from "@invinite-org/chartlang-adapter-kit";
import { describe, expect, it } from "vitest";

import type { MutableRunnerEmissions } from "../runtimeContext.js";
import { type DepOutputStore, createDepOutputStore } from "./DepOutputStore.js";
import {
    type DepRunnerLike,
    type SiblingRunnerLike,
    applyDepEmissionPolicy,
} from "./emissionFilter.js";

function freshEmissions(): MutableRunnerEmissions {
    return {
        plots: [],
        drawings: [],
        alerts: [],
        alertConditions: [],
        logs: [],
        diagnostics: [],
        fromBar: 0,
        toBar: 0,
    };
}

function makePlot(slotId: string, title: string, value: number | null): PlotEmission {
    return {
        kind: "plot",
        slotId,
        title,
        style: { kind: "line", lineWidth: 1, lineStyle: "solid" },
        bar: 0,
        time: 0,
        value,
        color: null,
        meta: {},
        pane: "overlay",
    };
}

function makeAlert(slotId: string): AlertEmission {
    return {
        kind: "alert",
        slotId,
        severity: "warning",
        message: "x",
        bar: 0,
        time: 0,
        meta: {},
        channels: ["toast"],
        dedupeKey: `${slotId}|0|x`,
    };
}

function makeDrawing(): DrawingEmission {
    return {
        kind: "drawing",
        handleId: "h",
        drawingKind: "line",
        op: "create",
        state: { kind: "line", anchors: [], style: {} },
        bar: 0,
        time: 0,
    };
}

function makeLog(): LogEmission {
    return {
        kind: "log",
        level: "info",
        message: "x",
        meta: {},
        bar: 0,
        time: 0,
    };
}

function makeAlertCondition(): AlertConditionEmission {
    return {
        kind: "alert-condition",
        conditionId: "c",
        title: "C",
        description: "",
        defaultMessage: "",
        fired: true,
        bar: 0,
        time: 0,
    };
}

function makeDiagnostic(slotId: string | null): RuntimeDiagnostic {
    return {
        kind: "diagnostic",
        severity: "info",
        code: "runtime-error-thrown",
        message: "x",
        slotId,
        bar: 0,
    };
}

function makeStore(producerId: string, titles: ReadonlyArray<string>): DepOutputStore {
    return createDepOutputStore({
        producers: [{ producerId, outputs: titles.map((t) => ({ title: t })) }],
        capacity: 4,
    });
}

describe("applyDepEmissionPolicy — DepRunner (private)", () => {
    it("captures declared plots into the store and drops them from parent", () => {
        const runnerEmissions = freshEmissions();
        runnerEmissions.plots.push(makePlot("s", "line", 42));
        const parent = freshEmissions();
        const store = makeStore("p", ["line"]);
        const runner: DepRunnerLike = {
            kind: "dep",
            localId: "p",
            slotIdPrefix: "dep:p/",
            declaredOutputs: ["line"],
            emissions: runnerEmissions,
        };
        applyDepEmissionPolicy(runner, parent, store);
        expect(parent.plots).toHaveLength(0);
        expect(store.read("p", "line").current).toBe(42);
        expect(runnerEmissions.plots).toHaveLength(0);
    });

    it("treats null plot values as NaN in the captured buffer", () => {
        const runnerEmissions = freshEmissions();
        runnerEmissions.plots.push(makePlot("s", "line", null));
        const parent = freshEmissions();
        const store = makeStore("p", ["line"]);
        const runner: DepRunnerLike = {
            kind: "dep",
            localId: "p",
            slotIdPrefix: "dep:p/",
            declaredOutputs: ["line"],
            emissions: runnerEmissions,
        };
        applyDepEmissionPolicy(runner, parent, store);
        expect(store.read("p", "line").current).toBeNaN();
    });

    it("raises dep-output-not-titled when a dep plot has no declared title", () => {
        const runnerEmissions = freshEmissions();
        runnerEmissions.plots.push(makePlot("s", "", 1));
        runnerEmissions.plots.push(makePlot("s2", "ghost", 2));
        const parent = freshEmissions();
        const store = makeStore("p", ["line"]);
        const runner: DepRunnerLike = {
            kind: "dep",
            localId: "p",
            slotIdPrefix: "dep:p/",
            declaredOutputs: ["line"],
            emissions: runnerEmissions,
        };
        applyDepEmissionPolicy(runner, parent, store);
        expect(parent.plots).toHaveLength(0);
        expect(parent.diagnostics).toHaveLength(2);
        expect(parent.diagnostics[0].code).toBe("dep-output-not-titled");
        expect(parent.diagnostics[0].slotId).toBe("dep:p/s");
        expect(parent.diagnostics[1].slotId).toBe("dep:p/s2");
    });

    it("drops dep drawings / alerts / alertConditions / logs without diagnostics", () => {
        const runnerEmissions = freshEmissions();
        runnerEmissions.drawings.push(makeDrawing());
        runnerEmissions.alerts.push(makeAlert("s"));
        runnerEmissions.alertConditions = [makeAlertCondition()];
        runnerEmissions.logs.push(makeLog());
        const parent = freshEmissions();
        const store = makeStore("p", []);
        const runner: DepRunnerLike = {
            kind: "dep",
            localId: "p",
            slotIdPrefix: "dep:p/",
            declaredOutputs: [],
            emissions: runnerEmissions,
        };
        applyDepEmissionPolicy(runner, parent, store);
        expect(parent.drawings).toHaveLength(0);
        expect(parent.alerts).toHaveLength(0);
        expect(parent.alertConditions ?? []).toHaveLength(0);
        expect(parent.logs).toHaveLength(0);
        expect(parent.diagnostics).toHaveLength(0);
    });

    it("forwards dep diagnostics with the slot-id prefix", () => {
        const runnerEmissions = freshEmissions();
        runnerEmissions.diagnostics.push(makeDiagnostic("inner"));
        runnerEmissions.diagnostics.push(makeDiagnostic(null));
        const parent = freshEmissions();
        const store = makeStore("p", []);
        const runner: DepRunnerLike = {
            kind: "dep",
            localId: "p",
            slotIdPrefix: "dep:p/",
            declaredOutputs: [],
            emissions: runnerEmissions,
        };
        applyDepEmissionPolicy(runner, parent, store);
        expect(parent.diagnostics).toHaveLength(2);
        expect(parent.diagnostics[0].slotId).toBe("dep:p/inner");
        expect(parent.diagnostics[1].slotId).toBeNull();
    });

    it("NaN-pads declared outputs the dep skipped this bar", () => {
        const runnerEmissions = freshEmissions();
        const parent = freshEmissions();
        const store = makeStore("p", ["line", "histogram"]);
        const runner: DepRunnerLike = {
            kind: "dep",
            localId: "p",
            slotIdPrefix: "dep:p/",
            declaredOutputs: ["line", "histogram"],
            emissions: runnerEmissions,
        };
        applyDepEmissionPolicy(runner, parent, store);
        expect(store.read("p", "line").current).toBeNaN();
        expect(store.read("p", "histogram").current).toBeNaN();
    });
});

describe("applyDepEmissionPolicy — SiblingRunner (drawn)", () => {
    it("captures titled plots AND forwards them with the export prefix", () => {
        const runnerEmissions = freshEmissions();
        runnerEmissions.plots.push(makePlot("s", "line", 7));
        const parent = freshEmissions();
        const store = makeStore("slow", ["line"]);
        const runner: SiblingRunnerLike = {
            kind: "sibling",
            exportName: "slow",
            slotIdPrefix: "export:slow/",
            declaredOutputs: ["line"],
            emissions: runnerEmissions,
        };
        applyDepEmissionPolicy(runner, parent, store);
        expect(parent.plots).toHaveLength(1);
        expect(parent.plots[0].slotId).toBe("export:slow/s");
        expect(store.read("slow", "line").current).toBe(7);
    });

    it("forwards untitled sibling plots without a diagnostic", () => {
        const runnerEmissions = freshEmissions();
        runnerEmissions.plots.push(makePlot("s", "", 1));
        const parent = freshEmissions();
        const store = makeStore("slow", []);
        const runner: SiblingRunnerLike = {
            kind: "sibling",
            exportName: "slow",
            slotIdPrefix: "export:slow/",
            declaredOutputs: [],
            emissions: runnerEmissions,
        };
        applyDepEmissionPolicy(runner, parent, store);
        expect(parent.plots).toHaveLength(1);
        expect(parent.plots[0].slotId).toBe("export:slow/s");
        expect(parent.diagnostics).toHaveLength(0);
    });

    it("forwards drawings without slot-id prefixing", () => {
        const runnerEmissions = freshEmissions();
        runnerEmissions.drawings.push(makeDrawing());
        const parent = freshEmissions();
        const store = makeStore("slow", []);
        const runner: SiblingRunnerLike = {
            kind: "sibling",
            exportName: "slow",
            slotIdPrefix: "export:slow/",
            declaredOutputs: [],
            emissions: runnerEmissions,
        };
        applyDepEmissionPolicy(runner, parent, store);
        expect(parent.drawings).toHaveLength(1);
    });

    it("forwards alerts with prefixed slot id", () => {
        const runnerEmissions = freshEmissions();
        runnerEmissions.alerts.push(makeAlert("alertSlot"));
        const parent = freshEmissions();
        const store = makeStore("slow", []);
        const runner: SiblingRunnerLike = {
            kind: "sibling",
            exportName: "slow",
            slotIdPrefix: "export:slow/",
            declaredOutputs: [],
            emissions: runnerEmissions,
        };
        applyDepEmissionPolicy(runner, parent, store);
        expect(parent.alerts).toHaveLength(1);
        expect(parent.alerts[0].slotId).toBe("export:slow/alertSlot");
    });

    it("forwards alert conditions through the parent queue", () => {
        const runnerEmissions = freshEmissions();
        runnerEmissions.alertConditions = [makeAlertCondition()];
        const parent = freshEmissions();
        const store = makeStore("slow", []);
        const runner: SiblingRunnerLike = {
            kind: "sibling",
            exportName: "slow",
            slotIdPrefix: "export:slow/",
            declaredOutputs: [],
            emissions: runnerEmissions,
        };
        applyDepEmissionPolicy(runner, parent, store);
        expect(parent.alertConditions ?? []).toHaveLength(1);
    });

    it("forwards logs as-is", () => {
        const runnerEmissions = freshEmissions();
        runnerEmissions.logs.push(makeLog());
        const parent = freshEmissions();
        const store = makeStore("slow", []);
        const runner: SiblingRunnerLike = {
            kind: "sibling",
            exportName: "slow",
            slotIdPrefix: "export:slow/",
            declaredOutputs: [],
            emissions: runnerEmissions,
        };
        applyDepEmissionPolicy(runner, parent, store);
        expect(parent.logs).toHaveLength(1);
    });

    it("forwards diagnostics with prefixed slot id", () => {
        const runnerEmissions = freshEmissions();
        runnerEmissions.diagnostics.push(makeDiagnostic("inner"));
        const parent = freshEmissions();
        const store = makeStore("slow", []);
        const runner: SiblingRunnerLike = {
            kind: "sibling",
            exportName: "slow",
            slotIdPrefix: "export:slow/",
            declaredOutputs: [],
            emissions: runnerEmissions,
        };
        applyDepEmissionPolicy(runner, parent, store);
        expect(parent.diagnostics).toHaveLength(1);
        expect(parent.diagnostics[0].slotId).toBe("export:slow/inner");
    });

    it("NaN-pads declared sibling outputs not plotted this bar", () => {
        const runnerEmissions = freshEmissions();
        const parent = freshEmissions();
        const store = makeStore("slow", ["line"]);
        const runner: SiblingRunnerLike = {
            kind: "sibling",
            exportName: "slow",
            slotIdPrefix: "export:slow/",
            declaredOutputs: ["line"],
            emissions: runnerEmissions,
        };
        applyDepEmissionPolicy(runner, parent, store);
        expect(store.read("slow", "line").current).toBeNaN();
    });

    it("handles runner emissions without an alertConditions array", () => {
        const runnerEmissions = freshEmissions();
        // Remove the alertConditions array entirely.
        runnerEmissions.alertConditions = undefined;
        const parent = freshEmissions();
        parent.alertConditions = undefined;
        const store = makeStore("slow", []);
        const runner: SiblingRunnerLike = {
            kind: "sibling",
            exportName: "slow",
            slotIdPrefix: "export:slow/",
            declaredOutputs: [],
            emissions: runnerEmissions,
        };
        applyDepEmissionPolicy(runner, parent, store);
        expect(parent.alertConditions ?? []).toHaveLength(0);
    });

    it("creates the parent's alertConditions array when sibling fires one and parent has none", () => {
        const runnerEmissions = freshEmissions();
        runnerEmissions.alertConditions = [makeAlertCondition()];
        const parent = freshEmissions();
        parent.alertConditions = undefined;
        const store = makeStore("slow", []);
        const runner: SiblingRunnerLike = {
            kind: "sibling",
            exportName: "slow",
            slotIdPrefix: "export:slow/",
            declaredOutputs: [],
            emissions: runnerEmissions,
        };
        applyDepEmissionPolicy(runner, parent, store);
        expect(parent.alertConditions ?? []).toHaveLength(1);
    });

    it("resets the runner's queue after filtering", () => {
        const runnerEmissions = freshEmissions();
        runnerEmissions.plots.push(makePlot("s", "line", 1));
        runnerEmissions.drawings.push(makeDrawing());
        runnerEmissions.alerts.push(makeAlert("s"));
        runnerEmissions.diagnostics.push(makeDiagnostic("d"));
        runnerEmissions.logs.push(makeLog());
        runnerEmissions.alertConditions = [makeAlertCondition()];
        const parent = freshEmissions();
        const store = makeStore("slow", ["line"]);
        const runner: SiblingRunnerLike = {
            kind: "sibling",
            exportName: "slow",
            slotIdPrefix: "export:slow/",
            declaredOutputs: ["line"],
            emissions: runnerEmissions,
        };
        applyDepEmissionPolicy(runner, parent, store);
        expect(runnerEmissions.plots).toHaveLength(0);
        expect(runnerEmissions.drawings).toHaveLength(0);
        expect(runnerEmissions.alerts).toHaveLength(0);
        expect(runnerEmissions.alertConditions ?? []).toHaveLength(0);
        expect(runnerEmissions.logs).toHaveLength(0);
        expect(runnerEmissions.diagnostics).toHaveLength(0);
    });
});
