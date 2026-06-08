// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { AnchorTriple, FibChannelState } from "@invinite-org/chartlang-core";
import { afterEach, describe, expect, it } from "vitest";

import {
    ACTIVE_RUNTIME_CONTEXT,
    type MutableRunnerEmissions,
    type RuntimeContext,
} from "../../../runtimeContext";
import { createStreamState } from "../../../streamState";
import { inMemoryStateStore } from "../../../stateStore";
import { fibChannel } from "./fibChannel";

function makeCaps(overrides: Partial<Capabilities> = {}): Capabilities {
    return {
        plots: new Set(),
        drawings: new Set(["fib-channel"]),
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
    { time: 1_700_000_030_000, price: 110 },
    { time: 1_700_000_000_000, price: 95 },
];

afterEach(() => {
    ACTIVE_RUNTIME_CONTEXT.current = null;
});

describe("draw.fibChannel — script-facing throw", () => {
    it("throws the sentinel when called without a compiler-injected slot id", () => {
        expect(() => fibChannel(ANCHORS)).toThrow(
            "draw.fibChannel called outside an active script step",
        );
    });

    it("throws when anchors is missing", () => {
        const { ctx } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        expect(() => fibChannel("slot", undefined as unknown as AnchorTriple)).toThrow(
            "draw.fibChannel called outside an active script step",
        );
    });

    it("throws when invoked through the compiled overload outside an active context", () => {
        expect(() => fibChannel("slot", ANCHORS)).toThrow(
            "draw.fibChannel called outside an active script step",
        );
    });
});

describe("draw.fibChannel — happy path", () => {
    it("returns a DrawingHandle and emits op: create with the fib-channel state", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        const handle = fibChannel("fc.chart.ts:1:1#0", ANCHORS, { color: "#facc15" });
        expect(handle.id).toBe("fc.chart.ts:1:1#0#0");
        const state = emissions.drawings[0].state as FibChannelState;
        expect(state.kind).toBe("fib-channel");
        expect(state.anchors).toEqual(ANCHORS);
        expect(state.style.color).toBe("#facc15");
    });

    it("defaults opts to {} when omitted", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        fibChannel("slot", ANCHORS);
        const state = emissions.drawings[0].state as FibChannelState;
        expect(state.style).toEqual({});
    });
});

describe("draw.fibChannel — capability gating", () => {
    it("drops + diagnoses unsupported-drawing-kind when capabilities omit fib-channel", () => {
        const caps = makeCaps({ drawings: new Set() });
        const { ctx, emissions } = makeCtx(caps);
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        fibChannel("slot", ANCHORS);
        expect(emissions.drawings).toEqual([]);
        expect(emissions.diagnostics[0].code).toBe("unsupported-drawing-kind");
    });
});

describe("draw.fibChannel — budget gating", () => {
    it("drops + diagnoses drawing-budget-exceeded when other bucket is full", () => {
        const caps = makeCaps({
            maxDrawingsPerScript: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
        });
        const { ctx, emissions } = makeCtx(caps);
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        fibChannel("slot", ANCHORS);
        expect(emissions.drawings).toEqual([]);
        expect(emissions.diagnostics[0].code).toBe("drawing-budget-exceeded");
    });
});
