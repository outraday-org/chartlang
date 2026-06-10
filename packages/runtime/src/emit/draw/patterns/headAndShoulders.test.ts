// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { AnchorQuint, HeadAndShouldersState } from "@invinite-org/chartlang-core";
import { afterEach, describe, expect, it } from "vitest";

import {
    ACTIVE_RUNTIME_CONTEXT,
    type MutableRunnerEmissions,
    type RuntimeContext,
} from "../../../runtimeContext.js";
import { createStreamState } from "../../../streamState.js";
import { inMemoryStateStore } from "../../../stateStore.js";
import { headAndShoulders } from "./headAndShoulders.js";

function makeCaps(overrides: Partial<Capabilities> = {}): Capabilities {
    return {
        plots: new Set(),
        drawings: new Set(["head-and-shoulders"]),
        alerts: new Set(),
        alertConditions: false,
        logs: false,
        inputs: new Set(),
        intervals: [],
        multiTimeframe: false,
        subPanes: 0,
        symInfoFields: new Set(),
        maxDrawingsPerScript: { lines: 0, labels: 0, boxes: 0, polylines: 100, other: 0 },
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

const ANCHORS: AnchorQuint = [
    { time: 1_700_000_000_000, price: 120 },
    { time: 1_700_000_015_000, price: 100 },
    { time: 1_700_000_030_000, price: 140 },
    { time: 1_700_000_045_000, price: 100 },
    { time: 1_700_000_060_000, price: 118 },
];

afterEach(() => {
    ACTIVE_RUNTIME_CONTEXT.current = null;
});

describe("draw.headAndShoulders — script-facing throw", () => {
    it("throws the sentinel when called without a compiler-injected slot id", () => {
        expect(() => headAndShoulders(ANCHORS)).toThrow(
            "draw.headAndShoulders called outside an active script step",
        );
    });

    it("throws when slotId is provided but anchors are missing", () => {
        const { ctx } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        expect(() => headAndShoulders("slot", undefined as unknown as AnchorQuint)).toThrow(
            "draw.headAndShoulders called outside an active script step",
        );
    });

    it("throws when invoked through the compiled overload outside an active context", () => {
        expect(() => headAndShoulders("slot", ANCHORS)).toThrow(
            "draw.headAndShoulders called outside an active script step",
        );
    });
});

describe("draw.headAndShoulders — happy path", () => {
    it("returns a DrawingHandle and emits op: create with the head-and-shoulders state", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        const handle = headAndShoulders("hs.chart.ts:1:1#0", ANCHORS, { color: "#f59e0b" });
        expect(handle.id).toBe("hs.chart.ts:1:1#0#0");
        const state = emissions.drawings[0].state as HeadAndShouldersState;
        expect(state.kind).toBe("head-and-shoulders");
        expect(state.anchors).toEqual(ANCHORS);
        expect(state.style.color).toBe("#f59e0b");
    });

    it("defaults opts to {} when omitted", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        headAndShoulders("slot", ANCHORS);
        const state = emissions.drawings[0].state as HeadAndShouldersState;
        expect(state.style).toEqual({});
    });
});

describe("draw.headAndShoulders — capability gating", () => {
    it("drops + diagnoses unsupported-drawing-kind when capabilities omit head-and-shoulders", () => {
        const caps = makeCaps({ drawings: new Set() });
        const { ctx, emissions } = makeCtx(caps);
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        headAndShoulders("slot", ANCHORS);
        expect(emissions.drawings).toEqual([]);
        expect(emissions.diagnostics[0].code).toBe("unsupported-drawing-kind");
    });
});

describe("draw.headAndShoulders — budget gating", () => {
    it("drops + diagnoses drawing-budget-exceeded when polylines bucket is full", () => {
        const caps = makeCaps({
            maxDrawingsPerScript: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
        });
        const { ctx, emissions } = makeCtx(caps);
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        headAndShoulders("slot", ANCHORS);
        expect(emissions.drawings).toEqual([]);
        expect(emissions.diagnostics[0].code).toBe("drawing-budget-exceeded");
    });
});
