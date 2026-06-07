// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import { describe, expect, it } from "vitest";

import type { RuntimeContext } from "../../runtimeContext";
import { createStreamState } from "../../streamState";
import { inMemoryStateStore } from "../../stateStore";
import { nextSubId, resetSubIdCounters } from "./subIdAllocator";

function makeCaps(): Capabilities {
    return {
        plots: capabilities.allLines(),
        drawings: new Set(),
        alerts: new Set(),
        alertConditions: false,
        logs: false,
        inputs: new Set(),
        intervals: [],
        multiTimeframe: false,
        subPanes: 0,
        symInfoFields: new Set(),
        maxDrawingsPerScript: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
        maxLookback: 5000,
        maxTickHz: 10,
    };
}

function makeCtx(): RuntimeContext {
    return {
        stream: createStreamState({ interval: "", capacity: 4, symbol: "" }),
        stateStore: inMemoryStateStore(),
        capabilities: makeCaps(),
        emissions: {
            plots: [],
            drawings: [],
            alerts: [],
            diagnostics: [],
            fromBar: 0,
            toBar: 0,
        },
        barIndex: () => 0,
        isTick: false,
        drawingSlots: new Map(),
        drawingSubIdCounters: new Map(),
        drawingBucketCounters: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
        scriptMaxDrawings: null,
    };
}

describe("nextSubId", () => {
    it("starts at 0 and increments per call at the same slotId", () => {
        const ctx = makeCtx();
        expect(nextSubId(ctx, "a:1:1#0")).toBe(0);
        expect(nextSubId(ctx, "a:1:1#0")).toBe(1);
        expect(nextSubId(ctx, "a:1:1#0")).toBe(2);
    });

    it("tracks distinct slotIds independently", () => {
        const ctx = makeCtx();
        expect(nextSubId(ctx, "a:1:1#0")).toBe(0);
        expect(nextSubId(ctx, "b:1:1#0")).toBe(0);
        expect(nextSubId(ctx, "a:1:1#0")).toBe(1);
        expect(nextSubId(ctx, "b:1:1#0")).toBe(1);
    });
});

describe("resetSubIdCounters", () => {
    it("clears every counter so the next call at any slotId starts at 0", () => {
        const ctx = makeCtx();
        nextSubId(ctx, "a:1:1#0");
        nextSubId(ctx, "a:1:1#0");
        nextSubId(ctx, "b:1:1#0");
        resetSubIdCounters(ctx);
        expect(ctx.drawingSubIdCounters.size).toBe(0);
        expect(nextSubId(ctx, "a:1:1#0")).toBe(0);
        expect(nextSubId(ctx, "b:1:1#0")).toBe(0);
    });
});
