// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { GannSquareFixedState, WorldPoint } from "@invinite-org/chartlang-core";
import { afterEach, describe, expect, it } from "vitest";

import {
    ACTIVE_RUNTIME_CONTEXT,
    type MutableRunnerEmissions,
    type RuntimeContext,
} from "../../../runtimeContext";
import { createStreamState } from "../../../streamState";
import { inMemoryStateStore } from "../../../stateStore";
import { gannSquareFixed } from "./gannSquareFixed";

function makeCaps(overrides: Partial<Capabilities> = {}): Capabilities {
    return {
        plots: new Set(),
        drawings: new Set(["gann-square-fixed"]),
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

const ANCHOR: WorldPoint = { time: 1_700_000_000_000, price: 100 };

afterEach(() => {
    ACTIVE_RUNTIME_CONTEXT.current = null;
});

describe("draw.gannSquareFixed — script-facing throw", () => {
    it("throws the sentinel when called without a compiler-injected slot id", () => {
        expect(() => gannSquareFixed(ANCHOR)).toThrow(
            "draw.gannSquareFixed called outside an active script step",
        );
    });

    it("throws when anchor is missing in the compiler-form", () => {
        const { ctx } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        expect(() => gannSquareFixed("slot", undefined as unknown as WorldPoint)).toThrow(
            "draw.gannSquareFixed called outside an active script step",
        );
    });

    it("throws when invoked through the compiled overload outside an active context", () => {
        expect(() => gannSquareFixed("slot", ANCHOR)).toThrow(
            "draw.gannSquareFixed called outside an active script step",
        );
    });
});

describe("draw.gannSquareFixed — happy path", () => {
    it("returns a DrawingHandle and emits op: create with the gann-square-fixed state", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        const handle = gannSquareFixed("sf.chart.ts:1:1#0", ANCHOR, { color: "#a855f7" });
        expect(handle.id).toBe("sf.chart.ts:1:1#0#0");
        const state = emissions.drawings[0].state as GannSquareFixedState;
        expect(state.kind).toBe("gann-square-fixed");
        expect(state.anchor).toEqual(ANCHOR);
        expect(state.style.color).toBe("#a855f7");
    });

    it("defaults opts to {} when omitted", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        gannSquareFixed("slot", ANCHOR);
        const state = emissions.drawings[0].state as GannSquareFixedState;
        expect(state.style).toEqual({});
    });
});

describe("draw.gannSquareFixed — capability gating", () => {
    it("drops + diagnoses unsupported-drawing-kind when capabilities omit gann-square-fixed", () => {
        const caps = makeCaps({ drawings: new Set() });
        const { ctx, emissions } = makeCtx(caps);
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        gannSquareFixed("slot", ANCHOR);
        expect(emissions.drawings).toEqual([]);
        expect(emissions.diagnostics[0].code).toBe("unsupported-drawing-kind");
    });
});

describe("draw.gannSquareFixed — budget gating", () => {
    it("drops + diagnoses drawing-budget-exceeded when other bucket is full", () => {
        const caps = makeCaps({
            maxDrawingsPerScript: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
        });
        const { ctx, emissions } = makeCtx(caps);
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        gannSquareFixed("slot", ANCHOR);
        expect(emissions.drawings).toEqual([]);
        expect(emissions.diagnostics[0].code).toBe("drawing-budget-exceeded");
    });
});
