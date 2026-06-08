// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { FrameState, WorldPoint } from "@invinite-org/chartlang-core";
import { afterEach, describe, expect, it } from "vitest";

import {
    ACTIVE_RUNTIME_CONTEXT,
    type MutableRunnerEmissions,
    type RuntimeContext,
} from "../../../runtimeContext";
import { createStreamState } from "../../../streamState";
import { inMemoryStateStore } from "../../../stateStore";
import { frame } from "./frame";

function makeCaps(overrides: Partial<Capabilities> = {}): Capabilities {
    return {
        plots: new Set(),
        drawings: new Set(["frame"]),
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

const A: WorldPoint = { time: 1_700_000_000_000, price: 100 };
const B: WorldPoint = { time: 1_700_000_060_000, price: 120 };

afterEach(() => {
    ACTIVE_RUNTIME_CONTEXT.current = null;
});

describe("draw.frame — script-facing throw", () => {
    it("throws the sentinel when called without a compiler-injected slot id", () => {
        expect(() => frame(A, B)).toThrow("draw.frame called outside an active script step");
    });

    it("throws when slotId is provided but anchors are missing", () => {
        const { ctx } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        expect(() => frame("slot", undefined as unknown as WorldPoint, B)).toThrow(
            "draw.frame called outside an active script step",
        );
    });

    it("throws when invoked through the compiled overload outside an active context", () => {
        expect(() => frame("slot", A, B)).toThrow(
            "draw.frame called outside an active script step",
        );
    });
});

describe("draw.frame — happy path", () => {
    it("returns a DrawingHandle and emits op:create with the frame state", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        const handle = frame("f.chart.ts:1:1#0", A, B, {
            label: "Idea",
            bgColor: "#f1f5f9",
        });
        expect(handle.id).toBe("f.chart.ts:1:1#0#0");
        const state = emissions.drawings[0].state as FrameState;
        expect(state.kind).toBe("frame");
        expect(state.anchors).toEqual([A, B]);
        expect(state.childHandleIds).toEqual([]);
        expect(state.style.label).toBe("Idea");
        expect(state.style.bgColor).toBe("#f1f5f9");
    });

    it("defaults opts to {} when omitted", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        frame("slot", A, B);
        const state = emissions.drawings[0].state as FrameState;
        expect(state.style).toEqual({});
    });
});

describe("draw.frame — capability gating", () => {
    it("drops + diagnoses unsupported-drawing-kind when caps omit frame", () => {
        const caps = makeCaps({ drawings: new Set() });
        const { ctx, emissions } = makeCtx(caps);
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        frame("slot", A, B);
        expect(emissions.drawings).toEqual([]);
        expect(emissions.diagnostics[0].code).toBe("unsupported-drawing-kind");
    });
});

describe("draw.frame — budget gating", () => {
    it("drops + diagnoses drawing-budget-exceeded when other bucket is full", () => {
        const caps = makeCaps({
            maxDrawingsPerScript: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
        });
        const { ctx, emissions } = makeCtx(caps);
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        frame("slot", A, B);
        expect(emissions.drawings).toEqual([]);
        expect(emissions.diagnostics[0].code).toBe("drawing-budget-exceeded");
    });
});
