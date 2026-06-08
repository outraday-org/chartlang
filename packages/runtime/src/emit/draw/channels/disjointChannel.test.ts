// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { AnchorQuad, DisjointChannelState } from "@invinite-org/chartlang-core";
import { afterEach, describe, expect, it } from "vitest";

import {
    ACTIVE_RUNTIME_CONTEXT,
    type MutableRunnerEmissions,
    type RuntimeContext,
} from "../../../runtimeContext";
import { createStreamState } from "../../../streamState";
import { inMemoryStateStore } from "../../../stateStore";
import { disjointChannel } from "./disjointChannel";

function makeCaps(overrides: Partial<Capabilities> = {}): Capabilities {
    return {
        plots: capabilities.allLines(),
        drawings: new Set([...capabilities.allChannelDrawings()]),
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

const ANCHORS: AnchorQuad = [
    { time: 1_700_000_000_000, price: 100 },
    { time: 1_700_000_030_000, price: 110 },
    { time: 1_700_000_000_000, price: 95 },
    { time: 1_700_000_030_000, price: 105 },
];

afterEach(() => {
    ACTIVE_RUNTIME_CONTEXT.current = null;
});

describe("draw.disjointChannel — script-facing throw", () => {
    it("throws the sentinel when called without a compiler-injected slot id", () => {
        expect(() => disjointChannel(ANCHORS)).toThrow(
            "draw.disjointChannel called outside an active script step",
        );
    });

    it("throws when slotId is provided but anchors are missing", () => {
        const { ctx } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        expect(() => disjointChannel("slot", undefined as unknown as AnchorQuad)).toThrow(
            "draw.disjointChannel called outside an active script step",
        );
    });

    it("throws when called inside the compiled overload path but outside an active context", () => {
        expect(() => disjointChannel("slot", ANCHORS)).toThrow(
            "draw.disjointChannel called outside an active script step",
        );
    });
});

describe("draw.disjointChannel — happy path", () => {
    it("returns a DrawingHandle and emits op: create with the disjoint-channel state", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        const handle = disjointChannel("dc.chart.ts:1:1#0", ANCHORS, {
            color: "#3b82f6",
            lineWidth: 2,
        });
        expect(handle.id).toBe("dc.chart.ts:1:1#0#0");
        expect(emissions.drawings).toHaveLength(1);
        const [e] = emissions.drawings;
        expect(e.drawingKind).toBe("disjoint-channel");
        expect(e.op).toBe("create");
        const state = e.state as DisjointChannelState;
        expect(state.kind).toBe("disjoint-channel");
        expect(state.anchors).toEqual(ANCHORS);
        expect(state.style.color).toBe("#3b82f6");
        expect(state.style.lineWidth).toBe(2);
    });

    it("defaults opts to {} when omitted", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        disjointChannel("slot", ANCHORS);
        const state = emissions.drawings[0].state as DisjointChannelState;
        expect(state.style).toEqual({});
    });
});

describe("draw.disjointChannel — capability gating", () => {
    it("drops + diagnoses unsupported-drawing-kind when capabilities omit disjoint-channel", () => {
        const caps = makeCaps({ drawings: new Set() });
        const { ctx, emissions } = makeCtx(caps);
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        disjointChannel("slot", ANCHORS);
        expect(emissions.drawings).toEqual([]);
        expect(emissions.diagnostics[0].code).toBe("unsupported-drawing-kind");
    });
});

describe("draw.disjointChannel — budget gating", () => {
    it("drops + diagnoses drawing-budget-exceeded when polylines bucket is full", () => {
        const caps = makeCaps({
            maxDrawingsPerScript: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
        });
        const { ctx, emissions } = makeCtx(caps);
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        disjointChannel("slot", ANCHORS);
        expect(emissions.drawings).toEqual([]);
        expect(emissions.diagnostics[0].code).toBe("drawing-budget-exceeded");
    });
});
