// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { BrushState, WorldPoint } from "@invinite-org/chartlang-core";
import { afterEach, describe, expect, it } from "vitest";

import {
    ACTIVE_RUNTIME_CONTEXT,
    type MutableRunnerEmissions,
    type RuntimeContext,
} from "../../../runtimeContext";
import { createStreamState } from "../../../streamState";
import { inMemoryStateStore } from "../../../stateStore";
import { brush } from "./brush";

function makeCaps(overrides: Partial<Capabilities> = {}): Capabilities {
    return {
        plots: capabilities.allLines(),
        drawings: capabilities.allFreehandDrawings(),
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

const POINTS: ReadonlyArray<WorldPoint> = [
    { time: 1_700_000_000_000, price: 100 },
    { time: 1_700_000_030_000, price: 110 },
    { time: 1_700_000_060_000, price: 105 },
];

const STYLE = { stroke: "#000000", fill: "#dbeafe" } as const;

afterEach(() => {
    ACTIVE_RUNTIME_CONTEXT.current = null;
});

describe("draw.brush — script-facing throw", () => {
    it("throws the sentinel when called without a compiler-injected slot id", () => {
        expect(() => brush(POINTS, STYLE)).toThrow(
            "draw.brush called outside an active script step",
        );
    });

    it("throws when slotId is provided but anchors are missing", () => {
        const { ctx } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        expect(() =>
            brush("slot", undefined as unknown as ReadonlyArray<WorldPoint>, STYLE),
        ).toThrow("draw.brush called outside an active script step");
    });

    it("throws when slotId is provided but style is missing", () => {
        const { ctx } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        expect(() => brush("slot", POINTS, undefined as unknown as typeof STYLE)).toThrow(
            "draw.brush called outside an active script step",
        );
    });

    it("throws when called inside the compiled overload path but outside an active context", () => {
        expect(() => brush("slot", POINTS, STYLE)).toThrow(
            "draw.brush called outside an active script step",
        );
    });
});

describe("draw.brush — happy path", () => {
    it("returns a DrawingHandle and emits op: create with the brush state", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        const handle = brush("a.chart.ts:1:1#0", POINTS, STYLE);
        expect(handle.id).toBe("a.chart.ts:1:1#0#0");
        const state = emissions.drawings[0].state as BrushState;
        expect(state.kind).toBe("brush");
        expect(state.anchors).toEqual(POINTS);
        expect(state.style).toEqual(STYLE);
    });
});

describe("draw.brush — capability gating", () => {
    it("drops + diagnoses unsupported-drawing-kind when capabilities omit brush", () => {
        const caps = makeCaps({ drawings: new Set() });
        const { ctx, emissions } = makeCtx(caps);
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        brush("slot", POINTS, STYLE);
        expect(emissions.drawings).toEqual([]);
        expect(emissions.diagnostics[0].code).toBe("unsupported-drawing-kind");
    });
});

describe("draw.brush — budget gating", () => {
    it("drops + diagnoses drawing-budget-exceeded when polylines bucket is full", () => {
        const caps = makeCaps({
            maxDrawingsPerScript: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
        });
        const { ctx, emissions } = makeCtx(caps);
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        brush("slot", POINTS, STYLE);
        expect(emissions.drawings).toEqual([]);
        expect(emissions.diagnostics[0].code).toBe("drawing-budget-exceeded");
    });
});
