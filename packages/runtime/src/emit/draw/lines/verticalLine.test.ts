// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { VerticalLineState } from "@invinite-org/chartlang-core";
import { afterEach, describe, expect, it } from "vitest";

import {
    ACTIVE_RUNTIME_CONTEXT,
    type MutableRunnerEmissions,
    type RuntimeContext,
} from "../../../runtimeContext";
import { createStreamState } from "../../../streamState";
import { inMemoryStateStore } from "../../../stateStore";
import { verticalLine } from "./verticalLine";

function makeCaps(overrides: Partial<Capabilities> = {}): Capabilities {
    return {
        plots: capabilities.allLines(),
        drawings: capabilities.allLineDrawings(),
        alerts: new Set(),
        alertConditions: false,
        logs: false,
        inputs: new Set(),
        intervals: [],
        multiTimeframe: false,
        subPanes: 0,
        symInfoFields: new Set(),
        maxDrawingsPerScript: { lines: 100, labels: 0, boxes: 0, polylines: 0, other: 0 },
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

afterEach(() => {
    ACTIVE_RUNTIME_CONTEXT.current = null;
});

describe("draw.verticalLine — script-facing throw", () => {
    it("throws the sentinel when called without a compiler-injected slot id", () => {
        expect(() => verticalLine(1_700_000_000_000)).toThrow(
            "draw.verticalLine called outside an active script step",
        );
    });

    it("throws when slotId is provided but time is missing", () => {
        const { ctx } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        expect(() => verticalLine("slot", undefined as unknown as number)).toThrow(
            "draw.verticalLine called outside an active script step",
        );
    });

    it("throws when called inside the compiled overload path but outside an active context", () => {
        expect(() => verticalLine("slot", 1_700_000_000_000)).toThrow(
            "draw.verticalLine called outside an active script step",
        );
    });
});

describe("draw.verticalLine — happy path + gating", () => {
    it("emits op: create with the vertical-line state and a stable handle id", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        const handle = verticalLine("a.chart.ts:1:1#0", 1_700_000_000_000, { color: "#f97316" });
        expect(handle.id).toBe("a.chart.ts:1:1#0#0");
        const state = emissions.drawings[0].state as VerticalLineState;
        expect(state.kind).toBe("vertical-line");
        expect(state.time).toBe(1_700_000_000_000);
        expect(state.style.color).toBe("#f97316");
    });

    it("defaults opts to {} when omitted", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        verticalLine("slot", 1_700_000_000_000);
        expect((emissions.drawings[0].state as VerticalLineState).style).toEqual({});
    });

    it("drops + diagnoses unsupported-drawing-kind when capabilities omit vertical-line", () => {
        const caps = makeCaps({ drawings: new Set() });
        const { ctx, emissions } = makeCtx(caps);
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        verticalLine("slot", 1_700_000_000_000);
        expect(emissions.drawings).toEqual([]);
        expect(emissions.diagnostics[0].code).toBe("unsupported-drawing-kind");
    });

    it("drops + diagnoses drawing-budget-exceeded when lines bucket is full", () => {
        const caps = makeCaps({
            maxDrawingsPerScript: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
        });
        const { ctx, emissions } = makeCtx(caps);
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        verticalLine("slot", 1_700_000_000_000);
        expect(emissions.diagnostics[0].code).toBe("drawing-budget-exceeded");
    });
});
