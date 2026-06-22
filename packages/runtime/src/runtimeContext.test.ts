// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import { afterEach, describe, expect, it } from "vitest";

import {
    ACTIVE_RUNTIME_CONTEXT,
    type MutableRunnerEmissions,
    type RuntimeContext,
} from "./runtimeContext.js";
import { inMemoryStateStore } from "./stateStore.js";
import { createStreamState } from "./streamState.js";
import { createRuntimeViews } from "./views/index.js";

function freshEmissions(): MutableRunnerEmissions {
    return {
        plots: [],
        drawings: [],
        alerts: [],
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

function freshContext(barIndex = 0): RuntimeContext {
    const stream = createStreamState({ interval: "1D", capacity: 3, symbol: "AAPL" });
    return {
        stream,
        stateStore: inMemoryStateStore(),
        capabilities: freshCapabilities(),
        emissions: freshEmissions(),
        barIndex: () => barIndex,
        isTick: false,
        drawingSlots: new Map(),
        drawingSubIdCounters: new Map(),
        drawingBucketCounters: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
        scriptMaxDrawings: null,
        stateSlots: new Map(),
        seriesSlots: new Map(),
        arraySlots: new Map(),
        requestSecurityBars: new Map(),
        diagnosedRequestKeys: new Set(),
        resolvedInputs: Object.freeze({}),
        diagnosedInputKeys: new Set(),
        views: createRuntimeViews(),
    };
}

describe("ACTIVE_RUNTIME_CONTEXT", () => {
    afterEach(() => {
        ACTIVE_RUNTIME_CONTEXT.current = null;
    });

    it("starts null at module load", () => {
        expect(ACTIVE_RUNTIME_CONTEXT.current).toBeNull();
    });

    it("round-trips an assigned RuntimeContext", () => {
        const ctx = freshContext(42);
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        expect(ACTIVE_RUNTIME_CONTEXT.current).toBe(ctx);
        expect(ACTIVE_RUNTIME_CONTEXT.current.barIndex()).toBe(42);
    });

    it("returns to null after clearing", () => {
        ACTIVE_RUNTIME_CONTEXT.current = freshContext();
        ACTIVE_RUNTIME_CONTEXT.current = null;
        expect(ACTIVE_RUNTIME_CONTEXT.current).toBeNull();
    });
});

describe("RuntimeContext shape", () => {
    it("exposes the runtime's per-step handles to primitives", () => {
        const ctx = freshContext(7);
        expect(ctx.stream.interval).toBe("1D");
        expect(ctx.stateStore.has("anything")).toBe(false);
        expect(ctx.emissions.plots).toEqual([]);
        expect(ctx.barIndex()).toBe(7);
        expect(ctx.isTick).toBe(false);
        ctx.isTick = true;
        expect(ctx.isTick).toBe(true);
    });

    it("composition fields default to absent", () => {
        const ctx = freshContext();
        expect(ctx.slotIdPrefix).toBeUndefined();
        expect(ctx.isDep).toBeUndefined();
        expect(ctx.depOutputStore).toBeUndefined();
    });

    it("mutating emissions arrays in place stays visible to readers", () => {
        const ctx = freshContext();
        ctx.emissions.plots.push({
            kind: "plot",
            slotId: "demo.ts:1:1#0",
            title: "demo",
            style: { kind: "line", lineWidth: 1, lineStyle: "solid" },
            bar: 0,
            time: 0,
            value: 1,
            color: null,
            meta: {},
            pane: "overlay",
        });
        expect(ctx.emissions.plots).toHaveLength(1);
        ctx.emissions.plots.length = 0;
        expect(ctx.emissions.plots).toHaveLength(0);
    });

    it("exposes the Phase-3 drawing fields", () => {
        const ctx = freshContext();
        expect(ctx.drawingSlots.size).toBe(0);
        expect(ctx.drawingSubIdCounters.size).toBe(0);
        expect(ctx.drawingBucketCounters).toEqual({
            lines: 0,
            labels: 0,
            boxes: 0,
            polylines: 0,
            other: 0,
        });
        expect(ctx.scriptMaxDrawings).toBeNull();
        expect(ctx.stateSlots.size).toBe(0);
        expect(ctx.requestSecurityBars.size).toBe(0);
        expect(ctx.diagnosedRequestKeys.size).toBe(0);
        expect(ctx.resolvedInputs).toEqual({});
        expect(ctx.diagnosedInputKeys.size).toBe(0);
        expect(ctx.views.barstate.isfirst).toBe(true);
    });
});
