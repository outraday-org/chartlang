// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    AlertEmission,
    AlertConditionEmission,
    DrawingEmission,
    LogEmission,
    PlotEmission,
    RunnerEmissions,
    RuntimeDiagnostic,
} from "@invinite-org/chartlang-adapter-kit";
import { describe, expect, it } from "vitest";

import { filterEmissions } from "./filterEmissions.js";

function validPlot(): PlotEmission {
    return {
        kind: "plot",
        slotId: "demo.ts:1:1#0",
        title: "EMA",
        style: { kind: "line", lineWidth: 1, lineStyle: "solid" },
        bar: 1,
        time: 1_700_000_000_000,
        value: 1.5,
        color: "#3b82f6",
        meta: {},
        pane: "overlay",
    };
}

function validAlert(): AlertEmission {
    return {
        kind: "alert",
        slotId: "demo.ts:2:1#0",
        severity: "warning",
        message: "x",
        bar: 1,
        time: 1_700_000_000_000,
        meta: {},
        channels: ["toast"],
        dedupeKey: "demo.ts:2:1#0|1|abc",
    };
}

function validAlertCondition(): AlertConditionEmission {
    return {
        kind: "alert-condition",
        conditionId: "bullishCross",
        title: "Bullish cross",
        description: "Fast EMA crossed above slow EMA",
        defaultMessage: "{{ticker}} crossed up",
        fired: true,
        bar: 1,
        time: 1_700_000_000_000,
    };
}

function validLog(): LogEmission {
    return {
        kind: "log",
        level: "info",
        message: "ema warmed",
        meta: { ema: 42 },
        bar: 1,
        time: 1_700_000_000_000,
    };
}

function validDrawing(): DrawingEmission {
    return {
        kind: "drawing",
        handleId: "demo.ts:3:1#0",
        drawingKind: "line",
        op: "create",
        state: null,
        bar: 1,
        time: 1_700_000_000_000,
    };
}

function existingDiagnostic(): RuntimeDiagnostic {
    return {
        kind: "diagnostic",
        severity: "info",
        code: "dropped-by-policy",
        message: "carried through",
        slotId: null,
        bar: null,
    };
}

function snapshot(overrides: Partial<RunnerEmissions> = {}): RunnerEmissions {
    return {
        plots: [],
        drawings: [],
        alerts: [],
        alertConditions: [],
        logs: [],
        diagnostics: [],
        fromBar: 1,
        toBar: 2,
        ...overrides,
    };
}

describe("filterEmissions", () => {
    it("passes through a clean snapshot intact", () => {
        const input = snapshot({
            plots: [validPlot()],
            drawings: [validDrawing()],
            alerts: [validAlert()],
            alertConditions: [validAlertCondition()],
            logs: [validLog()],
            diagnostics: [existingDiagnostic()],
        });
        const out = filterEmissions(input);
        expect(out.plots).toHaveLength(1);
        expect(out.alerts).toHaveLength(1);
        expect(out.alertConditions).toHaveLength(1);
        expect(out.logs).toHaveLength(1);
        expect(out.drawings).toHaveLength(1);
        expect(out.diagnostics).toHaveLength(1);
        expect(out.fromBar).toBe(1);
        expect(out.toBar).toBe(2);
    });

    it("sinks malformed plots into the diagnostics array", () => {
        const malformed = { ...validPlot(), style: { kind: "area" } } as unknown as PlotEmission;
        const out = filterEmissions(snapshot({ plots: [malformed] }));
        expect(out.plots).toEqual([]);
        expect(out.diagnostics).toHaveLength(1);
        expect(out.diagnostics[0].code).toBe("malformed-emission");
        expect(out.diagnostics[0].slotId).toBe(malformed.slotId);
        expect(out.diagnostics[0].bar).toBe(malformed.bar);
    });

    it("sinks malformed alerts into the diagnostics array", () => {
        const malformed = { ...validAlert(), channels: "toast" } as unknown as AlertEmission;
        const out = filterEmissions(snapshot({ alerts: [malformed] }));
        expect(out.alerts).toEqual([]);
        expect(out.diagnostics).toHaveLength(1);
        expect(out.diagnostics[0].code).toBe("malformed-emission");
        expect(out.diagnostics[0].slotId).toBe(malformed.slotId);
    });

    it("sinks malformed alert conditions into the diagnostics array", () => {
        const malformed = {
            ...validAlertCondition(),
            fired: "yes",
        } as unknown as AlertConditionEmission;
        const out = filterEmissions(snapshot({ alertConditions: [malformed] }));
        expect(out.alertConditions).toEqual([]);
        expect(out.diagnostics).toHaveLength(1);
        expect(out.diagnostics[0].code).toBe("malformed-emission");
        expect(out.diagnostics[0].slotId).toBeNull();
        expect(out.diagnostics[0].bar).toBe(malformed.bar);
    });

    it("sinks malformed logs into the diagnostics array", () => {
        const malformed = { ...validLog(), level: "debug" } as unknown as LogEmission;
        const out = filterEmissions(snapshot({ logs: [malformed] }));
        expect(out.logs).toEqual([]);
        expect(out.diagnostics).toHaveLength(1);
        expect(out.diagnostics[0].code).toBe("malformed-emission");
        expect(out.diagnostics[0].slotId).toBeNull();
        expect(out.diagnostics[0].bar).toBe(malformed.bar);
    });

    it("preserves pre-existing diagnostics and appends new ones", () => {
        const malformedP = { ...validPlot(), value: "nope" } as unknown as PlotEmission;
        const malformedA = { ...validAlert(), message: "" } as unknown as AlertEmission;
        const out = filterEmissions(
            snapshot({
                plots: [malformedP, validPlot()],
                alerts: [malformedA, validAlert()],
                diagnostics: [existingDiagnostic()],
            }),
        );
        expect(out.plots).toHaveLength(1);
        expect(out.alerts).toHaveLength(1);
        expect(out.diagnostics).toHaveLength(3);
        expect(out.diagnostics[0]).toEqual(existingDiagnostic());
    });

    it("passes drawings through unchanged in Phase 1", () => {
        const d = validDrawing();
        const out = filterEmissions(snapshot({ drawings: [d] }));
        expect(out.drawings).toEqual([d]);
    });

    it("round-trips `dep:` and `export:` slot-id prefixes on valid plots", () => {
        // §22.10 indicator-composition: the runtime namespaces sibling
        // plots with `export:<exportName>/` and private-dep diagnostics
        // with `dep:<localId>/`. The host-worker filter must NOT strip
        // emissions on slot-id format — it only validates the emission
        // shape via adapter-kit's `validateEmission`.
        const sibling: PlotEmission = {
            ...validPlot(),
            slotId: "export:sibling/sibling.chart.ts:1:1#0",
        };
        const out = filterEmissions(snapshot({ plots: [sibling] }));
        expect(out.plots).toEqual([sibling]);
        expect(out.diagnostics).toHaveLength(0);
    });

    it("round-trips every Phase-7 `dep-*` diagnostic code through the diagnostics array", () => {
        // The wire format already widened in Task 1; the filter just
        // copies diagnostics through. This pins the contract end-to-end.
        const depCodes = [
            "dep-error",
            "dep-cycle",
            "dep-unknown-output",
            "dep-invalid-input-override",
            "dep-dynamic",
            "dep-output-not-titled",
        ] as const;
        const diagnostics: ReadonlyArray<RuntimeDiagnostic> = depCodes.map((code) => ({
            kind: "diagnostic",
            severity: "error",
            code,
            message: `${code} message`,
            slotId: "dep:trend/inner.chart.ts:1:1#0",
            bar: 3,
        }));
        const out = filterEmissions(snapshot({ diagnostics }));
        expect(out.diagnostics).toEqual(diagnostics);
        for (const d of out.diagnostics) {
            expect(d.slotId).toBe("dep:trend/inner.chart.ts:1:1#0");
        }
    });
});
