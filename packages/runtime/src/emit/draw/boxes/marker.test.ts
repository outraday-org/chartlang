// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { MarkerState, WorldPoint } from "@invinite-org/chartlang-core";
import { afterEach, describe, expect, it } from "vitest";

import {
    ACTIVE_RUNTIME_CONTEXT,
    type MutableRunnerEmissions,
    type RuntimeContext,
} from "../../../runtimeContext";
import { createStreamState } from "../../../streamState";
import { inMemoryStateStore } from "../../../stateStore";
import { marker } from "./marker";

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
        maxDrawingsPerScript: { lines: 0, labels: 100, boxes: 0, polylines: 0, other: 0 },
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

const ANCHOR: WorldPoint = { time: 1_700_000_000_000, price: 100 };

afterEach(() => {
    ACTIVE_RUNTIME_CONTEXT.current = null;
});

describe("draw.marker — script-facing throw", () => {
    it("throws the sentinel when called without a compiler-injected slot id", () => {
        expect(() => marker(ANCHOR)).toThrow("draw.marker called outside an active script step");
    });

    it("throws when slotId is provided but the anchor is missing", () => {
        const { ctx } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        expect(() => marker("slot", undefined as unknown as WorldPoint)).toThrow(
            "draw.marker called outside an active script step",
        );
    });

    it("throws when called inside the compiled overload path but outside an active context", () => {
        expect(() => marker("slot", ANCHOR)).toThrow(
            "draw.marker called outside an active script step",
        );
    });
});

describe("draw.marker — happy path", () => {
    it("returns a DrawingHandle and emits op: create with the marker state", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        const handle = marker("a.chart.ts:1:1#0", ANCHOR, {
            text: "B",
            value: 1.5,
            color: "#10b981",
            size: "large",
        });
        expect(handle.id).toBe("a.chart.ts:1:1#0#0");
        const [e] = emissions.drawings;
        expect(e.drawingKind).toBe("marker");
        const state = e.state as MarkerState;
        expect(state.kind).toBe("marker");
        expect(state.anchor).toEqual(ANCHOR);
        expect(state.text).toBe("B");
        expect(state.value).toBe(1.5);
        expect(state.style.color).toBe("#10b981");
        expect(state.style.size).toBe("large");
    });

    it("omits text and value from state when opts omits them", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        marker("slot", ANCHOR, { color: "#10b981" });
        const state = emissions.drawings[0].state as MarkerState;
        expect(state.text).toBeUndefined();
        expect(state.value).toBeUndefined();
        expect(state.style.color).toBe("#10b981");
    });

    it("defaults opts to {} when omitted", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        marker("slot", ANCHOR);
        const state = emissions.drawings[0].state as MarkerState;
        expect(state.style).toEqual({});
    });
});

describe("draw.marker — capability gating", () => {
    it("drops + diagnoses unsupported-drawing-kind when capabilities omit marker", () => {
        const caps = makeCaps({ drawings: new Set() });
        const { ctx, emissions } = makeCtx(caps);
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        marker("slot", ANCHOR);
        expect(emissions.drawings).toEqual([]);
        expect(emissions.diagnostics[0].code).toBe("unsupported-drawing-kind");
    });
});

describe("draw.marker — budget gating", () => {
    it("drops + diagnoses drawing-budget-exceeded when labels bucket is full", () => {
        const caps = makeCaps({
            maxDrawingsPerScript: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
        });
        const { ctx, emissions } = makeCtx(caps);
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        marker("slot", ANCHOR);
        expect(emissions.drawings).toEqual([]);
        expect(emissions.diagnostics[0].code).toBe("drawing-budget-exceeded");
    });
});
