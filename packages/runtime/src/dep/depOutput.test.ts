// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import { afterEach, describe, expect, it } from "vitest";

import {
    ACTIVE_RUNTIME_CONTEXT,
    type MutableRunnerEmissions,
    type RuntimeContext,
} from "../runtimeContext.js";
import { inMemoryStateStore } from "../stateStore.js";
import { createStreamState } from "../streamState.js";
import { createRuntimeViews } from "../views/index.js";
import { createDepOutputStore } from "./DepOutputStore.js";
import {
    DEP_OUTPUT_GLOBAL_KEY,
    __chartlang_depOutput,
    installDepOutputGlobal,
} from "./depOutput.js";

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

function freshCapabilities(): Capabilities {
    return {
        plots: capabilities.allLines(),
        drawings: new Set(),
        alerts: new Set(),
        alertConditions: false,
        logs: false,
        inputs: new Set(),
        intervals: [],
        multiTimeframe: false,
        subPanes: 0,
        symInfoFields: new Set(),
        maxDrawingsPerScript: {
            lines: 0,
            labels: 0,
            boxes: 0,
            polylines: 0,
            other: 0,
        },
        maxLookback: 5000,
        maxTickHz: 10,
    };
}

function freshContext(): RuntimeContext {
    const stream = createStreamState({ interval: "1D", capacity: 3, symbol: "AAPL" });
    return {
        stream,
        stateStore: inMemoryStateStore(),
        lastPersistTime: 0,
        capabilities: freshCapabilities(),
        emissions: freshEmissions(),
        barIndex: () => 0,
        isTick: false,
        drawingSlots: new Map(),
        drawingSubIdCounters: new Map(),
        drawingBucketCounters: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
        scriptMaxDrawings: null,
        stateSlots: new Map(),
        seriesSlots: new Map(),
        arraySlots: new Map(),
        mapSlots: new Map(),
        objectSeriesSlots: new Map(),
        chartSymbol: "",
        secondaryStreams: new Map(),
        requestSecurityBars: new Map(),
        requestSecurityAlignments: new Map(),
        requestSecurityAscendingBars: new Map(),
        requestLowerTfViews: new Map(),
        diagnosedRequestKeys: new Set(),
        diagnosedTzKeys: new Set(),
        logBudget: 0,
        logBudgetExceededDiagnosed: false,
        resolvedInputs: Object.freeze({}),
        externalSeriesFeeds: Object.freeze({}),
        externalSeriesSlots: new Map(),
        defaultPane: "overlay",
        scriptPane: "script:demo",
        plotOverrides: Object.freeze({}),
        diagnosedInputKeys: new Set(),
        views: createRuntimeViews(),
    };
}

describe("__chartlang_depOutput", () => {
    afterEach(() => {
        ACTIVE_RUNTIME_CONTEXT.current = null;
    });

    it("throws when no context is active", () => {
        expect(() => __chartlang_depOutput("slot", "p", "x")).toThrowError(
            /outside an active script step/,
        );
    });

    it("throws when context has no dep output store", () => {
        const ctx = freshContext();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        expect(() => __chartlang_depOutput("slot", "p", "x")).toThrowError(/no dep output store/);
    });

    it("throws when context's dep output store is explicit null", () => {
        const ctx = freshContext();
        ctx.depOutputStore = null;
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        expect(() => __chartlang_depOutput("slot", "p", "x")).toThrowError(/no dep output store/);
    });

    it("returns the producer's Series<number> for a declared output", () => {
        const ctx = freshContext();
        const store = createDepOutputStore({
            producers: [{ producerId: "p", outputs: [{ title: "x" }] }],
            capacity: 4,
        });
        store.push("p", "x", 42);
        ctx.depOutputStore = store;
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        const series = __chartlang_depOutput("slot", "p", "x");
        expect(series.current).toBe(42);
    });

    it("pushes a dep-unknown-output diagnostic and returns a NaN series for unknown title", () => {
        const ctx = freshContext();
        const store = createDepOutputStore({
            producers: [{ producerId: "p", outputs: [{ title: "x" }] }],
            capacity: 4,
        });
        ctx.depOutputStore = store;
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        const series = __chartlang_depOutput("slot", "p", "missing");
        expect(series.current).toBeNaN();
        expect(ctx.emissions.diagnostics).toHaveLength(1);
        const diag = ctx.emissions.diagnostics[0];
        expect(diag.code).toBe("dep-unknown-output");
        expect(diag.slotId).toBe("slot");
        expect(diag.severity).toBe("error");
    });
});

describe("installDepOutputGlobal", () => {
    afterEach(() => {
        delete (globalThis as Record<string, unknown>)[DEP_OUTPUT_GLOBAL_KEY];
    });

    it("installs the helper on globalThis", () => {
        installDepOutputGlobal();
        const holder = globalThis as Record<string, unknown>;
        expect(holder[DEP_OUTPUT_GLOBAL_KEY]).toBe(__chartlang_depOutput);
    });

    it("is idempotent — second install does not overwrite", () => {
        const stub = (): unknown => null;
        (globalThis as Record<string, unknown>)[DEP_OUTPUT_GLOBAL_KEY] = stub;
        installDepOutputGlobal();
        const holder = globalThis as Record<string, unknown>;
        expect(holder[DEP_OUTPUT_GLOBAL_KEY]).toBe(stub);
    });
});
