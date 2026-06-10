// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { CircleState, WorldPoint } from "@invinite-org/chartlang-core";
import { afterEach, describe, expect, it } from "vitest";

import {
    ACTIVE_RUNTIME_CONTEXT,
    type MutableRunnerEmissions,
    type RuntimeContext,
} from "../../../runtimeContext.js";
import { createStreamState } from "../../../streamState.js";
import { inMemoryStateStore } from "../../../stateStore.js";
import { circle } from "./circle.js";

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
        stateSlots: new Map(),
    };
    return { ctx, emissions };
}

const CENTRE: WorldPoint = { time: 1_700_000_000_000, price: 100 };
const EDGE: WorldPoint = { time: 1_700_000_060_000, price: 110 };

afterEach(() => {
    ACTIVE_RUNTIME_CONTEXT.current = null;
});

describe("draw.circle — script-facing throw", () => {
    it("throws the sentinel when called without a compiler-injected slot id", () => {
        expect(() => circle(CENTRE, EDGE)).toThrow(
            "draw.circle called outside an active script step",
        );
    });

    it("throws when slotId is provided but the edge anchor is missing", () => {
        const { ctx } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        expect(() => circle("slot", CENTRE, undefined as unknown as WorldPoint)).toThrow(
            "draw.circle called outside an active script step",
        );
    });

    it("throws when called inside the compiled overload path but outside an active context", () => {
        expect(() => circle("slot", CENTRE, EDGE)).toThrow(
            "draw.circle called outside an active script step",
        );
    });
});

describe("draw.circle — happy path", () => {
    it("returns a DrawingHandle and emits op: create with the circle state", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        const handle = circle("a.chart.ts:1:1#0", CENTRE, EDGE, {
            stroke: "#3b82f6",
            fill: "#dbeafe",
            fillAlpha: 0.3,
        });
        expect(handle.id).toBe("a.chart.ts:1:1#0#0");
        expect(emissions.drawings).toHaveLength(1);
        const [e] = emissions.drawings;
        expect(e.drawingKind).toBe("circle");
        expect(e.op).toBe("create");
        const state = e.state as CircleState;
        expect(state.kind).toBe("circle");
        expect(state.anchors).toEqual([CENTRE, EDGE]);
        expect(state.style.stroke).toBe("#3b82f6");
        expect(state.style.fillAlpha).toBe(0.3);
    });

    it("defaults opts to {} when omitted", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        circle("slot", CENTRE, EDGE);
        const state = emissions.drawings[0].state as CircleState;
        expect(state.style).toEqual({});
    });
});

describe("draw.circle — capability gating", () => {
    it("drops + diagnoses unsupported-drawing-kind when capabilities omit circle", () => {
        const caps = makeCaps({ drawings: new Set() });
        const { ctx, emissions } = makeCtx(caps);
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        circle("slot", CENTRE, EDGE);
        expect(emissions.drawings).toEqual([]);
        expect(emissions.diagnostics[0].code).toBe("unsupported-drawing-kind");
    });
});

describe("draw.circle — budget gating", () => {
    it("drops + diagnoses drawing-budget-exceeded when boxes bucket is full", () => {
        const caps = makeCaps({
            maxDrawingsPerScript: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
        });
        const { ctx, emissions } = makeCtx(caps);
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        circle("slot", CENTRE, EDGE);
        expect(emissions.drawings).toEqual([]);
        expect(emissions.diagnostics[0].code).toBe("drawing-budget-exceeded");
    });
});
