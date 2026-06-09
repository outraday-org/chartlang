// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { TableOpts, TableState } from "@invinite-org/chartlang-core";
import { afterEach, describe, expect, it } from "vitest";

import {
    ACTIVE_RUNTIME_CONTEXT,
    type MutableRunnerEmissions,
    type RuntimeContext,
} from "../../../runtimeContext";
import { inMemoryStateStore } from "../../../stateStore";
import { createStreamState } from "../../../streamState";
import { createRuntimeViews } from "../../../views";
import { table } from "./table";

function makeCaps(overrides: Partial<Capabilities> = {}): Capabilities {
    return {
        plots: new Set(),
        drawings: new Set(["table"]),
        alerts: new Set(),
        alertConditions: false,
        logs: false,
        inputs: new Set(),
        intervals: [],
        multiTimeframe: false,
        subPanes: 0,
        symInfoFields: new Set(),
        maxDrawingsPerScript: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 100 },
        maxLookback: 5000,
        maxTickHz: 10,
        ...overrides,
    };
}

function makeCtx(caps?: Capabilities): { ctx: RuntimeContext; emissions: MutableRunnerEmissions } {
    const emissions: MutableRunnerEmissions = {
        plots: [],
        drawings: [],
        alerts: [],
        alertConditions: [],
        logs: [],
        diagnostics: [],
        fromBar: 0,
        toBar: 0,
    };
    const stream = createStreamState({ interval: "", capacity: 4, symbol: "" });
    stream.bar.time = 1_700_000_000_000;
    const ctx: RuntimeContext = {
        stream,
        stateStore: inMemoryStateStore(),
        lastPersistTime: 0,
        capabilities: caps ?? makeCaps(),
        emissions,
        barIndex: () => 0,
        isTick: false,
        drawingSlots: new Map(),
        drawingSubIdCounters: new Map(),
        drawingBucketCounters: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
        scriptMaxDrawings: null,
        stateSlots: new Map(),
        secondaryStreams: new Map(),
        requestSecurityBars: new Map(),
        requestSecurityAlignments: new Map(),
        requestSecurityAscendingBars: new Map(),
        diagnosedRequestKeys: new Set(),
        diagnosedAlertConditionKeys: new Set(),
        logBudget: 0,
        logBudgetExceededDiagnosed: false,
        resolvedInputs: {},
        diagnosedInputKeys: new Set(),
        views: createRuntimeViews(),
    };
    return { ctx, emissions };
}

const OPTS: TableOpts = {
    position: "top-right",
    cells: [[{ text: "P&L" }, { text: "+12.5%", textColor: "#16a34a" }]],
    borderColor: "#94a3b8",
    borderWidth: 1,
    frame: { color: "#475569", width: 2 },
};

afterEach(() => {
    ACTIVE_RUNTIME_CONTEXT.current = null;
});

describe("draw.table — script-facing throw", () => {
    it("throws the sentinel when called without a compiler-injected slot id", () => {
        expect(() => table(OPTS)).toThrow("draw.table called outside an active script step");
    });

    it("throws when called through the compiled overload outside an active context", () => {
        expect(() => table("slot", OPTS)).toThrow(
            "draw.table called outside an active script step",
        );
    });
});

describe("draw.table — happy path", () => {
    it("returns a DrawingHandle and emits op:create with table state", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        const handle = table("dash.chart.ts:1:1#0", OPTS);
        expect(handle.id).toBe("dash.chart.ts:1:1#0#0");
        expect(emissions.drawings).toHaveLength(1);
        const emission = emissions.drawings[0];
        expect(emission.drawingKind).toBe("table");
        expect(emission.op).toBe("create");
        const state = emission.state as TableState;
        expect(state.kind).toBe("table");
        expect(state.position).toBe("top-right");
        expect(state.cells[0][1].text).toBe("+12.5%");
        expect(state.frame?.width).toBe(2);
    });

    it("omits optional style fields when table opts leave them undefined", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        table("dash.chart.ts:1:1#0", {
            position: "bottom-left",
            cells: [[{ text: "Only cells" }]],
        });
        const state = emissions.drawings[0].state as TableState;
        expect(state).toEqual({
            kind: "table",
            position: "bottom-left",
            cells: [[{ text: "Only cells" }]],
        });
    });

    it("handle.update merges and emits the full table state", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        const handle = table("dash.chart.ts:1:1#0", OPTS);
        handle.update({
            kind: "table",
            cells: [[{ text: "Updated" }]],
        });
        expect(emissions.drawings).toHaveLength(1);
        const emission = emissions.drawings[0];
        expect(emission.op).toBe("update");
        const state = emission.state as TableState;
        expect(state.position).toBe("top-right");
        expect(state.cells).toEqual([[{ text: "Updated" }]]);
    });
});

describe("draw.table — capability gating", () => {
    it("drops + diagnoses unsupported-drawing-kind when caps omit table", () => {
        const { ctx, emissions } = makeCtx(makeCaps({ drawings: new Set() }));
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        table("slot", OPTS);
        expect(emissions.drawings).toEqual([]);
        expect(emissions.diagnostics[0].code).toBe("unsupported-drawing-kind");
    });

    it("drops + diagnoses drawing-budget-exceeded when other bucket is full", () => {
        const { ctx, emissions } = makeCtx(
            makeCaps({
                maxDrawingsPerScript: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
            }),
        );
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        table("slot", OPTS);
        expect(emissions.drawings).toEqual([]);
        expect(emissions.diagnostics[0].code).toBe("drawing-budget-exceeded");
    });
});
