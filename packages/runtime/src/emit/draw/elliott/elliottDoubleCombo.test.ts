// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { AnchorHept, ElliottDoubleComboState } from "@invinite-org/chartlang-core";
import { afterEach, describe, expect, it } from "vitest";

import {
    ACTIVE_RUNTIME_CONTEXT,
    type MutableRunnerEmissions,
    type RuntimeContext,
} from "../../../runtimeContext.js";
import { createStreamState } from "../../../streamState.js";
import { inMemoryStateStore } from "../../../stateStore.js";
import { elliottDoubleCombo } from "./elliottDoubleCombo.js";

function makeCaps(overrides: Partial<Capabilities> = {}): Capabilities {
    return {
        plots: new Set(),
        drawings: new Set(["elliott-double-combo"]),
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

const ANCHORS: AnchorHept = [
    { time: 1_700_000_000_000, price: 100 },
    { time: 1_700_000_010_000, price: 115 },
    { time: 1_700_000_020_000, price: 108 },
    { time: 1_700_000_030_000, price: 125 },
    { time: 1_700_000_040_000, price: 116 },
    { time: 1_700_000_050_000, price: 135 },
    { time: 1_700_000_060_000, price: 124 },
];

afterEach(() => {
    ACTIVE_RUNTIME_CONTEXT.current = null;
});

describe("draw.elliottDoubleCombo — script-facing throw", () => {
    it("throws the sentinel when called without a compiler-injected slot id", () => {
        expect(() => elliottDoubleCombo(ANCHORS)).toThrow(
            "draw.elliottDoubleCombo called outside an active script step",
        );
    });

    it("throws when slotId is provided but anchors are missing", () => {
        const { ctx } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        expect(() => elliottDoubleCombo("slot", undefined as unknown as AnchorHept)).toThrow(
            "draw.elliottDoubleCombo called outside an active script step",
        );
    });

    it("throws when invoked through the compiled overload outside an active context", () => {
        expect(() => elliottDoubleCombo("slot", ANCHORS)).toThrow(
            "draw.elliottDoubleCombo called outside an active script step",
        );
    });
});

describe("draw.elliottDoubleCombo — happy path", () => {
    it("returns a DrawingHandle and emits op:create with the elliott-double-combo state", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        const handle = elliottDoubleCombo("edc.chart.ts:1:1#0", ANCHORS, {
            color: "#14b8a6",
        });
        expect(handle.id).toBe("edc.chart.ts:1:1#0#0");
        const state = emissions.drawings[0].state as ElliottDoubleComboState;
        expect(state.kind).toBe("elliott-double-combo");
        expect(state.anchors).toEqual(ANCHORS);
        expect(state.style.color).toBe("#14b8a6");
        expect(state.labels).toBeUndefined();
    });

    it("defaults opts to {} when omitted", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        elliottDoubleCombo("slot", ANCHORS);
        const state = emissions.drawings[0].state as ElliottDoubleComboState;
        expect(state.style).toEqual({});
    });

    it("forwards opts.labels onto state.labels and strips it from style", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        elliottDoubleCombo("slot", ANCHORS, {
            labels: ["S", "W", "x1", "X", "x2", "Yi", "Y"],
        } as unknown as Parameters<typeof elliottDoubleCombo>[2]);
        const state = emissions.drawings[0].state as ElliottDoubleComboState;
        expect(state.labels).toEqual(["S", "W", "x1", "X", "x2", "Yi", "Y"]);
        expect(state.style).toEqual({});
    });
});

describe("draw.elliottDoubleCombo — capability gating", () => {
    it("drops + diagnoses unsupported-drawing-kind when caps omit elliott-double-combo", () => {
        const caps = makeCaps({ drawings: new Set() });
        const { ctx, emissions } = makeCtx(caps);
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        elliottDoubleCombo("slot", ANCHORS);
        expect(emissions.drawings).toEqual([]);
        expect(emissions.diagnostics[0].code).toBe("unsupported-drawing-kind");
    });
});

describe("draw.elliottDoubleCombo — budget gating", () => {
    it("drops + diagnoses drawing-budget-exceeded when polylines bucket is full", () => {
        const caps = makeCaps({
            maxDrawingsPerScript: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
        });
        const { ctx, emissions } = makeCtx(caps);
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        elliottDoubleCombo("slot", ANCHORS);
        expect(emissions.drawings).toEqual([]);
        expect(emissions.diagnostics[0].code).toBe("drawing-budget-exceeded");
    });
});
