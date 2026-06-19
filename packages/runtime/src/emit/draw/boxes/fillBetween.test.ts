// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { FillBetweenState, WorldPoint } from "@invinite-org/chartlang-core";
import { afterEach, describe, expect, it } from "vitest";

import {
    ACTIVE_RUNTIME_CONTEXT,
    type MutableRunnerEmissions,
    type RuntimeContext,
} from "../../../runtimeContext.js";
import { createStreamState } from "../../../streamState.js";
import { inMemoryStateStore } from "../../../stateStore.js";
import { fillBetween } from "./fillBetween.js";

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

const EDGE_A: ReadonlyArray<WorldPoint> = [
    { time: 1_700_000_000_000, price: 110 },
    { time: 1_700_000_060_000, price: 120 },
];
const EDGE_B: ReadonlyArray<WorldPoint> = [
    { time: 1_700_000_000_000, price: 100 },
    { time: 1_700_000_060_000, price: 105 },
];

afterEach(() => {
    ACTIVE_RUNTIME_CONTEXT.current = null;
});

describe("draw.fillBetween — script-facing throw", () => {
    it("throws the sentinel when called without a compiler-injected slot id", () => {
        expect(() => fillBetween(EDGE_A, EDGE_B)).toThrow(
            "draw.fillBetween called outside an active script step",
        );
    });

    it("throws when slotId is provided but the first edge is missing", () => {
        const { ctx } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        expect(() =>
            fillBetween("slot", undefined as unknown as ReadonlyArray<WorldPoint>, EDGE_B),
        ).toThrow("draw.fillBetween called outside an active script step");
    });

    it("throws when slotId + first edge are provided but the second edge is missing", () => {
        const { ctx } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        expect(() =>
            fillBetween("slot", EDGE_A, undefined as unknown as ReadonlyArray<WorldPoint>),
        ).toThrow("draw.fillBetween called outside an active script step");
    });

    it("throws when called inside the compiled overload path but outside an active context", () => {
        expect(() => fillBetween("slot", EDGE_A, EDGE_B)).toThrow(
            "draw.fillBetween called outside an active script step",
        );
    });
});

describe("draw.fillBetween — happy path", () => {
    it("returns a DrawingHandle and emits op: create with the fill-between state", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        const handle = fillBetween("a.chart.ts:1:1#0", EDGE_A, EDGE_B, {
            fill: "#3b82f6",
            fillAlpha: 0.2,
            color: "#1d4ed8",
        });
        expect(handle.id).toBe("a.chart.ts:1:1#0#0");
        const [e] = emissions.drawings;
        expect(e.drawingKind).toBe("fill-between");
        expect(e.op).toBe("create");
        const state = e.state as FillBetweenState;
        expect(state.kind).toBe("fill-between");
        expect(state.edgeA).toEqual(EDGE_A);
        expect(state.edgeB).toEqual(EDGE_B);
        expect(state.style.fill).toBe("#3b82f6");
        expect(state.style.fillAlpha).toBe(0.2);
        expect(state.style.color).toBe("#1d4ed8");
    });

    it("defaults opts to {} when omitted", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        fillBetween("slot", EDGE_A, EDGE_B);
        const state = emissions.drawings[0].state as FillBetweenState;
        expect(state.style).toEqual({});
    });

    it("update() patches the style and re-emits op: update", () => {
        // create + update land on the same (slotId, bar), so `pushDrawing`
        // dedups last-write-wins — the buffer holds the single `update`
        // emission carrying the merged state.
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        const handle = fillBetween("slot", EDGE_A, EDGE_B, { fill: "#3b82f6" });
        handle.update({ style: { fill: "#ef4444" } });
        expect(emissions.drawings).toHaveLength(1);
        const [update] = emissions.drawings;
        expect(update.op).toBe("update");
        const state = update.state as FillBetweenState;
        expect(state.style.fill).toBe("#ef4444");
    });

    it("remove() emits op: remove", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        const handle = fillBetween("slot", EDGE_A, EDGE_B);
        handle.remove();
        expect(emissions.drawings).toHaveLength(1);
        const [removal] = emissions.drawings;
        expect(removal.op).toBe("remove");
    });
});
