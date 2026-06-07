// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { RegressionTrendState, WorldPoint } from "@invinite-org/chartlang-core";
import { afterEach, describe, expect, it } from "vitest";

import {
    ACTIVE_RUNTIME_CONTEXT,
    type MutableRunnerEmissions,
    type RuntimeContext,
} from "../../../runtimeContext";
import { createStreamState } from "../../../streamState";
import { inMemoryStateStore } from "../../../stateStore";
import { regressionTrend } from "./regressionTrend";

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
    };
    return { ctx, emissions };
}

const A: WorldPoint = { time: 1_700_000_000_000, price: 100 };
const B: WorldPoint = { time: 1_700_000_030_000, price: 110 };

afterEach(() => {
    ACTIVE_RUNTIME_CONTEXT.current = null;
});

describe("draw.regressionTrend — script-facing throw", () => {
    it("throws the sentinel when called without a compiler-injected slot id", () => {
        expect(() => regressionTrend(A, B)).toThrow(
            "draw.regressionTrend called outside an active script step",
        );
    });

    it("throws when slotId is provided but anchors are missing", () => {
        const { ctx } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        expect(() =>
            regressionTrend("slot", undefined as unknown as WorldPoint, B),
        ).toThrow("draw.regressionTrend called outside an active script step");
    });

    it("throws when called inside the compiled overload path but outside an active context", () => {
        expect(() => regressionTrend("slot", A, B)).toThrow(
            "draw.regressionTrend called outside an active script step",
        );
    });
});

describe("draw.regressionTrend — happy path", () => {
    it("returns a DrawingHandle and emits op: create with the regression-trend state", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        const handle = regressionTrend("rt.chart.ts:1:1#0", A, B, {
            source: "close",
            stdevMultiplier: 2,
            showUpperBand: true,
            showLowerBand: true,
            color: "#3b82f6",
        });
        expect(handle.id).toBe("rt.chart.ts:1:1#0#0");
        expect(emissions.drawings).toHaveLength(1);
        const [e] = emissions.drawings;
        expect(e.drawingKind).toBe("regression-trend");
        expect(e.op).toBe("create");
        const state = e.state as RegressionTrendState;
        expect(state.kind).toBe("regression-trend");
        expect(state.anchors).toEqual([A, B]);
        expect(state.style.source).toBe("close");
        expect(state.style.stdevMultiplier).toBe(2);
        expect(state.style.showUpperBand).toBe(true);
        expect(state.style.showLowerBand).toBe(true);
        expect(state.style.color).toBe("#3b82f6");
    });

    it("defaults opts to {} when omitted", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        regressionTrend("slot", A, B);
        const state = emissions.drawings[0].state as RegressionTrendState;
        expect(state.style).toEqual({});
    });
});

describe("draw.regressionTrend — capability gating", () => {
    it("drops + diagnoses unsupported-drawing-kind when capabilities omit regression-trend", () => {
        const caps = makeCaps({ drawings: new Set() });
        const { ctx, emissions } = makeCtx(caps);
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        regressionTrend("slot", A, B);
        expect(emissions.drawings).toEqual([]);
        expect(emissions.diagnostics[0].code).toBe("unsupported-drawing-kind");
    });
});

describe("draw.regressionTrend — budget gating", () => {
    it("drops + diagnoses drawing-budget-exceeded when polylines bucket is full", () => {
        const caps = makeCaps({
            maxDrawingsPerScript: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
        });
        const { ctx, emissions } = makeCtx(caps);
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        regressionTrend("slot", A, B);
        expect(emissions.drawings).toEqual([]);
        expect(emissions.diagnostics[0].code).toBe("drawing-budget-exceeded");
    });
});
