// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { AnchorQuad, RotatedRectangleState } from "@invinite-org/chartlang-core";
import { afterEach, describe, expect, it } from "vitest";

import {
    ACTIVE_RUNTIME_CONTEXT,
    type MutableRunnerEmissions,
    type RuntimeContext,
} from "../../../runtimeContext";
import { createStreamState } from "../../../streamState";
import { inMemoryStateStore } from "../../../stateStore";
import { rotatedRectangle } from "./rotatedRectangle";

function makeCaps(overrides: Partial<Capabilities> = {}): Capabilities {
    return {
        plots: capabilities.allLines(),
        drawings: capabilities.allBoxDrawings(),
        alerts: new Set(),
        alertConditions: false,
        logs: false,
        inputs: new Set(),
        intervals: [],
        multiTimeframe: false,
        subPanes: 0,
        symInfoFields: new Set(),
        maxDrawingsPerScript: { lines: 0, labels: 0, boxes: 100, polylines: 0, other: 0 },
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
    };
    return { ctx, emissions };
}

const QUAD: AnchorQuad = [
    { time: 1_700_000_000_000, price: 100 },
    { time: 1_700_000_060_000, price: 110 },
    { time: 1_700_000_120_000, price: 105 },
    { time: 1_700_000_060_000, price: 95 },
];

afterEach(() => {
    ACTIVE_RUNTIME_CONTEXT.current = null;
});

describe("draw.rotatedRectangle — script-facing throw", () => {
    it("throws the sentinel when called without a compiler-injected slot id", () => {
        expect(() => rotatedRectangle(QUAD)).toThrow(
            "draw.rotatedRectangle called outside an active script step",
        );
    });

    it("throws when slotId is provided but anchors are missing", () => {
        const { ctx } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        expect(() =>
            rotatedRectangle("slot", undefined as unknown as AnchorQuad),
        ).toThrow("draw.rotatedRectangle called outside an active script step");
    });

    it("throws when called inside the compiled overload path but outside an active context", () => {
        expect(() => rotatedRectangle("slot", QUAD)).toThrow(
            "draw.rotatedRectangle called outside an active script step",
        );
    });
});

describe("draw.rotatedRectangle — happy path", () => {
    it("returns a DrawingHandle with stable id and emits op: create with the rotated-rectangle state", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        const handle = rotatedRectangle("a.chart.ts:1:1#0", QUAD, { stroke: "#22c55e" });
        expect(handle.id).toBe("a.chart.ts:1:1#0#0");
        expect(emissions.drawings).toHaveLength(1);
        const [e] = emissions.drawings;
        expect(e.drawingKind).toBe("rotated-rectangle");
        expect(e.op).toBe("create");
        const state = e.state as RotatedRectangleState;
        expect(state.kind).toBe("rotated-rectangle");
        expect(state.anchors).toEqual(QUAD);
        expect(state.style.stroke).toBe("#22c55e");
    });

    it("defaults opts to {} when omitted", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        rotatedRectangle("slot", QUAD);
        const state = emissions.drawings[0].state as RotatedRectangleState;
        expect(state.style).toEqual({});
    });
});

describe("draw.rotatedRectangle — capability gating", () => {
    it("drops + diagnoses unsupported-drawing-kind when capabilities omit rotated-rectangle", () => {
        const caps = makeCaps({ drawings: new Set() });
        const { ctx, emissions } = makeCtx(caps);
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        rotatedRectangle("slot", QUAD);
        expect(emissions.drawings).toEqual([]);
        expect(emissions.diagnostics[0].code).toBe("unsupported-drawing-kind");
    });
});

describe("draw.rotatedRectangle — budget gating", () => {
    it("drops + diagnoses drawing-budget-exceeded when boxes bucket is full", () => {
        const caps = makeCaps({
            maxDrawingsPerScript: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
        });
        const { ctx, emissions } = makeCtx(caps);
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        rotatedRectangle("slot", QUAD);
        expect(emissions.drawings).toEqual([]);
        expect(emissions.diagnostics[0].code).toBe("drawing-budget-exceeded");
    });
});
