// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { HighlighterState, WorldPoint } from "@invinite-org/chartlang-core";
import { afterEach, describe, expect, it } from "vitest";

import {
    ACTIVE_RUNTIME_CONTEXT,
    type MutableRunnerEmissions,
    type RuntimeContext,
} from "../../../runtimeContext";
import { createStreamState } from "../../../streamState";
import { inMemoryStateStore } from "../../../stateStore";
import { highlighter } from "./highlighter";

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
];

const STYLE = { color: "#facc15", alpha: 0.3 } as const;

afterEach(() => {
    ACTIVE_RUNTIME_CONTEXT.current = null;
});

describe("draw.highlighter — script-facing throw", () => {
    it("throws the sentinel when called without a compiler-injected slot id", () => {
        expect(() => highlighter(POINTS, STYLE)).toThrow(
            "draw.highlighter called outside an active script step",
        );
    });

    it("throws when slotId is provided but anchors are missing", () => {
        const { ctx } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        expect(() =>
            highlighter("slot", undefined as unknown as ReadonlyArray<WorldPoint>, STYLE),
        ).toThrow("draw.highlighter called outside an active script step");
    });

    it("throws when slotId is provided but style is missing", () => {
        const { ctx } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        expect(() => highlighter("slot", POINTS, undefined as unknown as typeof STYLE)).toThrow(
            "draw.highlighter called outside an active script step",
        );
    });

    it("throws when called inside the compiled overload path but outside an active context", () => {
        expect(() => highlighter("slot", POINTS, STYLE)).toThrow(
            "draw.highlighter called outside an active script step",
        );
    });
});

describe("draw.highlighter — happy path", () => {
    it("returns a DrawingHandle and emits op: create with the highlighter state", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        const handle = highlighter("a.chart.ts:1:1#0", POINTS, STYLE);
        expect(handle.id).toBe("a.chart.ts:1:1#0#0");
        const state = emissions.drawings[0].state as HighlighterState;
        expect(state.kind).toBe("highlighter");
        expect(state.anchors).toEqual(POINTS);
        expect(state.style).toEqual(STYLE);
    });
});

describe("draw.highlighter — capability gating", () => {
    it("drops + diagnoses unsupported-drawing-kind when capabilities omit highlighter", () => {
        const caps = makeCaps({ drawings: new Set() });
        const { ctx, emissions } = makeCtx(caps);
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        highlighter("slot", POINTS, STYLE);
        expect(emissions.drawings).toEqual([]);
        expect(emissions.diagnostics[0].code).toBe("unsupported-drawing-kind");
    });
});

describe("draw.highlighter — budget gating", () => {
    it("drops + diagnoses drawing-budget-exceeded when polylines bucket is full", () => {
        const caps = makeCaps({
            maxDrawingsPerScript: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
        });
        const { ctx, emissions } = makeCtx(caps);
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        highlighter("slot", POINTS, STYLE);
        expect(emissions.drawings).toEqual([]);
        expect(emissions.diagnostics[0].code).toBe("drawing-budget-exceeded");
    });
});
