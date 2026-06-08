// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities, DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { LineState } from "@invinite-org/chartlang-core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import type { RuntimeContext } from "../../runtimeContext";
import { createStreamState } from "../../streamState";
import { inMemoryStateStore } from "../../stateStore";
import { pushDrawing } from "./pushDrawing";

function makeCaps(): Capabilities {
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
        maxDrawingsPerScript: { lines: 1000, labels: 0, boxes: 0, polylines: 0, other: 0 },
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
        stateSlots: new Map(),
    };
}

function lineEmission(
    handleId: string,
    bar: number,
    op: DrawingEmission["op"],
    value: number,
): DrawingEmission {
    const state: LineState = {
        kind: "line",
        anchors: [
            { time: 1, price: value },
            { time: 2, price: value + 1 },
        ],
        style: {},
    };
    return {
        kind: "drawing",
        handleId,
        drawingKind: "line",
        op,
        state,
        bar,
        time: 1_700_000_000_000,
    };
}

describe("pushDrawing — properties", () => {
    it("N repeated emissions on the same (handleId, bar) collapse to exactly 1 entry", () => {
        fc.assert(
            fc.property(fc.integer({ min: 1, max: 16 }), (n) => {
                const ctx = makeCtx();
                for (let i = 0; i < n; i += 1) {
                    pushDrawing(ctx, lineEmission("h", 0, i === 0 ? "create" : "update", i));
                }
                expect(ctx.emissions.drawings).toHaveLength(1);
                const last = ctx.emissions.drawings[0];
                expect(last.state).toMatchObject({
                    anchors: [
                        { time: 1, price: n - 1 },
                        { time: 2, price: n },
                    ],
                });
            }),
        );
    });

    it("create → remove → create on the same bucket nets +1 bucket consumption", () => {
        const ctx = makeCtx();
        pushDrawing(ctx, lineEmission("h0", 0, "create", 0));
        expect(ctx.drawingBucketCounters.lines).toBe(1);
        pushDrawing(ctx, lineEmission("h0", 1, "remove", 0));
        expect(ctx.drawingBucketCounters.lines).toBe(0);
        pushDrawing(ctx, lineEmission("h0", 2, "create", 0));
        expect(ctx.drawingBucketCounters.lines).toBe(1);
    });

    it("emission count never exceeds the configured budget after K creates", () => {
        fc.assert(
            fc.property(fc.integer({ min: 1, max: 50 }), (k) => {
                const ctx = makeCtx();
                for (let i = 0; i < k; i += 1) {
                    pushDrawing(ctx, lineEmission(`h${i}`, i, "create", i));
                }
                expect(ctx.drawingBucketCounters.lines).toBeLessThanOrEqual(
                    ctx.capabilities.maxDrawingsPerScript.lines,
                );
            }),
        );
    });
});
