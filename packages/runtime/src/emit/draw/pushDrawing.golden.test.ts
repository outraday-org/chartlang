// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { createHash } from "node:crypto";

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities, DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { LineState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { RuntimeContext } from "../../runtimeContext.js";
import { createStreamState } from "../../streamState.js";
import { inMemoryStateStore } from "../../stateStore.js";
import { pushDrawing } from "./pushDrawing.js";

// Re-pin by copying the `actual` hash from a failure message — same
// workflow as `plot-hash` (PLAN.md §22.10 reproducibility contract).
const GOLDEN_SHA256 = "5745ecccc11f539ed5cb34cc562650d28f65378bbfd6be79350bea3ee103887a";
const ITERATIONS = 50;

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

function lineEmission(i: number): DrawingEmission {
    const state: LineState = {
        kind: "line",
        anchors: [
            { time: i, price: i },
            { time: i + 1, price: i + 1 },
        ],
        style: {},
    };
    return {
        kind: "drawing",
        handleId: `golden:${i}`,
        drawingKind: "line",
        op: "create",
        state,
        bar: i,
        time: 1_700_000_000_000 + i * 60_000,
    };
}

describe("pushDrawing — golden", () => {
    it(`SHA-256 over a ${ITERATIONS}-line emission batch matches the pinned hash`, () => {
        const ctx = makeCtx();
        for (let i = 0; i < ITERATIONS; i += 1) {
            pushDrawing(ctx, lineEmission(i));
        }
        expect(ctx.emissions.drawings).toHaveLength(ITERATIONS);
        const tuples = ctx.emissions.drawings.map((d) => ({
            handleId: d.handleId,
            kind: d.drawingKind,
            op: d.op,
            state: d.state,
            bar: d.bar,
        }));
        const actual = createHash("sha256").update(JSON.stringify(tuples)).digest("hex");
        expect(actual).toBe(GOLDEN_SHA256);
    });
});
