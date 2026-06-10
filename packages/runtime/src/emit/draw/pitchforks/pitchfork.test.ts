// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { AnchorTriple, PitchforkState } from "@invinite-org/chartlang-core";
import { afterEach, describe, expect, it } from "vitest";

import {
    ACTIVE_RUNTIME_CONTEXT,
    type MutableRunnerEmissions,
    type RuntimeContext,
} from "../../../runtimeContext.js";
import { createStreamState } from "../../../streamState.js";
import { inMemoryStateStore } from "../../../stateStore.js";
import { pitchfork } from "./pitchfork.js";

function makeCaps(overrides: Partial<Capabilities> = {}): Capabilities {
    return {
        plots: new Set(),
        drawings: new Set(["pitchfork"]),
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

const ANCHORS: AnchorTriple = [
    { time: 1_700_000_000_000, price: 100 },
    { time: 1_700_000_030_000, price: 110 },
    { time: 1_700_000_060_000, price: 95 },
];

afterEach(() => {
    ACTIVE_RUNTIME_CONTEXT.current = null;
});

describe("draw.pitchfork — script-facing throw", () => {
    it("throws the sentinel when called without a compiler-injected slot id", () => {
        expect(() => pitchfork(ANCHORS)).toThrow(
            "draw.pitchfork called outside an active script step",
        );
    });

    it("throws when slotId is provided but anchors are missing", () => {
        const { ctx } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        expect(() => pitchfork("slot", undefined as unknown as AnchorTriple)).toThrow(
            "draw.pitchfork called outside an active script step",
        );
    });

    it("throws when invoked through the compiled overload outside an active context", () => {
        expect(() => pitchfork("slot", ANCHORS)).toThrow(
            "draw.pitchfork called outside an active script step",
        );
    });
});

describe("draw.pitchfork — happy path", () => {
    it("returns a DrawingHandle and emits op: create with the pitchfork state", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        const handle = pitchfork("pf.chart.ts:1:1#0", ANCHORS, {
            variant: "modifiedSchiff",
            color: "#ec4899",
        });
        expect(handle.id).toBe("pf.chart.ts:1:1#0#0");
        expect(emissions.drawings).toHaveLength(1);
        const state = emissions.drawings[0].state as PitchforkState;
        expect(state.kind).toBe("pitchfork");
        expect(state.anchors).toEqual(ANCHORS);
        expect(state.variant).toBe("modifiedSchiff");
        expect(state.style.color).toBe("#ec4899");
    });

    it("defaults variant to 'standard' when opts omit it", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        pitchfork("slot", ANCHORS);
        const state = emissions.drawings[0].state as PitchforkState;
        expect(state.variant).toBe("standard");
        expect(state.style).toEqual({});
    });

    it("strips the variant field out of the style payload", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        pitchfork("slot", ANCHORS, { variant: "schiff", lineWidth: 2 });
        const state = emissions.drawings[0].state as PitchforkState;
        expect(state.style).toEqual({ lineWidth: 2 });
        expect((state.style as Record<string, unknown>).variant).toBeUndefined();
    });

    it("supports each of the 4 variants", () => {
        for (const variant of ["standard", "schiff", "modifiedSchiff", "inside"] as const) {
            const { ctx, emissions } = makeCtx();
            ACTIVE_RUNTIME_CONTEXT.current = ctx;
            pitchfork("slot", ANCHORS, { variant });
            const state = emissions.drawings[0].state as PitchforkState;
            expect(state.variant).toBe(variant);
            ACTIVE_RUNTIME_CONTEXT.current = null;
        }
    });
});

describe("draw.pitchfork — capability gating", () => {
    it("drops + diagnoses unsupported-drawing-kind when capabilities omit pitchfork", () => {
        const caps = makeCaps({ drawings: new Set() });
        const { ctx, emissions } = makeCtx(caps);
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        pitchfork("slot", ANCHORS);
        expect(emissions.drawings).toEqual([]);
        expect(emissions.diagnostics[0].code).toBe("unsupported-drawing-kind");
    });
});

describe("draw.pitchfork — budget gating", () => {
    it("drops + diagnoses drawing-budget-exceeded when polylines bucket is full", () => {
        const caps = makeCaps({
            maxDrawingsPerScript: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
        });
        const { ctx, emissions } = makeCtx(caps);
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        pitchfork("slot", ANCHORS);
        expect(emissions.drawings).toEqual([]);
        expect(emissions.diagnostics[0].code).toBe("drawing-budget-exceeded");
    });
});
