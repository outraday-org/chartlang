// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { AnchorTriple, FibWedgeState } from "@invinite-org/chartlang-core";
import { afterEach, describe, expect, it } from "vitest";

import {
    ACTIVE_RUNTIME_CONTEXT,
    type MutableRunnerEmissions,
    type RuntimeContext,
} from "../../../runtimeContext";
import { createStreamState } from "../../../streamState";
import { inMemoryStateStore } from "../../../stateStore";
import { fibWedge } from "./fibWedge";

function makeCaps(overrides: Partial<Capabilities> = {}): Capabilities {
    return {
        plots: new Set(),
        drawings: new Set(["fib-wedge"]),
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
        diagnostics: [],
        fromBar: 0,
        toBar: 0,
    };
    const stream = createStreamState({ interval: "", capacity: 4, symbol: "" });
    stream.bar.time = 1_700_000_000_000;
    const ctx: RuntimeContext = {
        stream,
        stateStore: inMemoryStateStore(),
        capabilities: caps ?? makeCaps(),
        emissions,
        barIndex: () => 0,
        isTick: false,
        drawingSlots: new Map(),
        drawingSubIdCounters: new Map(),
        drawingBucketCounters: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
        scriptMaxDrawings: null,
        stateSlots: new Map(),
    };
    return { ctx, emissions };
}

const ANCHORS: AnchorTriple = [
    { time: 1_700_000_000_000, price: 100 },
    { time: 1_700_000_030_000, price: 120 },
    { time: 1_700_000_030_000, price: 80 },
];

afterEach(() => {
    ACTIVE_RUNTIME_CONTEXT.current = null;
});

describe("draw.fibWedge — script-facing throw", () => {
    it("throws the sentinel when called without a compiler-injected slot id", () => {
        expect(() => fibWedge(ANCHORS)).toThrow(
            "draw.fibWedge called outside an active script step",
        );
    });

    it("throws when anchors is missing", () => {
        const { ctx } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        expect(() => fibWedge("slot", undefined as unknown as AnchorTriple)).toThrow(
            "draw.fibWedge called outside an active script step",
        );
    });

    it("throws when invoked through the compiled overload outside an active context", () => {
        expect(() => fibWedge("slot", ANCHORS)).toThrow(
            "draw.fibWedge called outside an active script step",
        );
    });
});

describe("draw.fibWedge — happy path", () => {
    it("returns a DrawingHandle and emits op: create with the fib-wedge state", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        const handle = fibWedge("fw.chart.ts:1:1#0", ANCHORS, { color: "#facc15" });
        expect(handle.id).toBe("fw.chart.ts:1:1#0#0");
        const state = emissions.drawings[0].state as FibWedgeState;
        expect(state.kind).toBe("fib-wedge");
        expect(state.anchors).toEqual(ANCHORS);
        expect(state.style.color).toBe("#facc15");
    });

    it("defaults opts to {} when omitted", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        fibWedge("slot", ANCHORS);
        const state = emissions.drawings[0].state as FibWedgeState;
        expect(state.style).toEqual({});
    });
});

describe("draw.fibWedge — capability gating", () => {
    it("drops + diagnoses unsupported-drawing-kind when capabilities omit fib-wedge", () => {
        const caps = makeCaps({ drawings: new Set() });
        const { ctx, emissions } = makeCtx(caps);
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        fibWedge("slot", ANCHORS);
        expect(emissions.drawings).toEqual([]);
        expect(emissions.diagnostics[0].code).toBe("unsupported-drawing-kind");
    });
});

describe("draw.fibWedge — budget gating", () => {
    it("drops + diagnoses drawing-budget-exceeded when other bucket is full", () => {
        const caps = makeCaps({
            maxDrawingsPerScript: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
        });
        const { ctx, emissions } = makeCtx(caps);
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        fibWedge("slot", ANCHORS);
        expect(emissions.drawings).toEqual([]);
        expect(emissions.diagnostics[0].code).toBe("drawing-budget-exceeded");
    });
});
