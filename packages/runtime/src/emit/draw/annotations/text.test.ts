// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { TextState, WorldPoint } from "@invinite-org/chartlang-core";
import { afterEach, describe, expect, it } from "vitest";

import {
    ACTIVE_RUNTIME_CONTEXT,
    type MutableRunnerEmissions,
    type RuntimeContext,
} from "../../../runtimeContext";
import { createStreamState } from "../../../streamState";
import { inMemoryStateStore } from "../../../stateStore";
import { text } from "./text";

function makeCaps(overrides: Partial<Capabilities> = {}): Capabilities {
    return {
        plots: capabilities.allLines(),
        drawings: capabilities.allAnnotationDrawings(),
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
const BODY = "Inverse Head and Shoulders Confirmed";

afterEach(() => {
    ACTIVE_RUNTIME_CONTEXT.current = null;
});

describe("draw.text — script-facing throw", () => {
    it("throws the sentinel when called without a compiler-injected slot id", () => {
        expect(() => text(ANCHOR, BODY)).toThrow("draw.text called outside an active script step");
    });

    it("throws when slotId is provided but anchor is missing", () => {
        const { ctx } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        expect(() => text("slot", undefined as unknown as WorldPoint, BODY)).toThrow(
            "draw.text called outside an active script step",
        );
    });

    it("throws when slotId is provided but body is missing", () => {
        const { ctx } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        expect(() => text("slot", ANCHOR, undefined as unknown as string)).toThrow(
            "draw.text called outside an active script step",
        );
    });

    it("throws when called inside the compiled overload path but outside an active context", () => {
        expect(() => text("slot", ANCHOR, BODY)).toThrow(
            "draw.text called outside an active script step",
        );
    });
});

describe("draw.text — happy path", () => {
    it("returns a DrawingHandle and emits op: create with the text state", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        const handle = text("a.chart.ts:1:1#0", ANCHOR, BODY, { color: "#1e293b" });
        expect(handle.id).toBe("a.chart.ts:1:1#0#0");
        const state = emissions.drawings[0].state as TextState;
        expect(state.kind).toBe("text");
        expect(state.anchor).toEqual(ANCHOR);
        expect(state.body).toBe(BODY);
        expect(state.style.color).toBe("#1e293b");
    });

    it("defaults opts to {} when omitted", () => {
        const { ctx, emissions } = makeCtx();
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        text("slot", ANCHOR, BODY);
        const state = emissions.drawings[0].state as TextState;
        expect(state.style).toEqual({});
    });
});

describe("draw.text — capability gating", () => {
    it("drops + diagnoses unsupported-drawing-kind when capabilities omit text", () => {
        const caps = makeCaps({ drawings: new Set() });
        const { ctx, emissions } = makeCtx(caps);
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        text("slot", ANCHOR, BODY);
        expect(emissions.drawings).toEqual([]);
        expect(emissions.diagnostics[0].code).toBe("unsupported-drawing-kind");
    });
});

describe("draw.text — budget gating", () => {
    it("drops + diagnoses drawing-budget-exceeded when labels bucket is full", () => {
        const caps = makeCaps({
            maxDrawingsPerScript: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
        });
        const { ctx, emissions } = makeCtx(caps);
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        text("slot", ANCHOR, BODY);
        expect(emissions.drawings).toEqual([]);
        expect(emissions.diagnostics[0].code).toBe("drawing-budget-exceeded");
    });
});
