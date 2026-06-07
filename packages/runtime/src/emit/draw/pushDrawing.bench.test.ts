// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities, DrawingEmission } from "@invinite-org/chartlang-adapter-kit";
import type { LineState } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { RuntimeContext } from "../../runtimeContext";
import { createStreamState } from "../../streamState";
import { inMemoryStateStore } from "../../stateStore";
import { pushDrawing } from "./pushDrawing";

// THRESHOLD_MS — wall-clock budget for 10 000 line drawing emissions
// (each `op: "create"` runs capability gate + `validateEmission` line
// validator + bucket counter increment + linear-dedup scan). Local
// Apple-silicon (M-series) runs land near ~600ms; budget 2 000ms for
// slower CI hardware. Per the §22.10 `ceil(median × 3)` convention.
const THRESHOLD_MS = 2_000;
const ITERATIONS = 10_000;

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
        maxDrawingsPerScript: {
            lines: ITERATIONS + 1,
            labels: 0,
            boxes: 0,
            polylines: 0,
            other: 0,
        },
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

function makeEmission(i: number): DrawingEmission {
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
        handleId: `h:${i}`,
        drawingKind: "line",
        op: "create",
        state,
        bar: i,
        time: 1_700_000_000_000 + i * 60_000,
    };
}

describe("pushDrawing threshold", () => {
    it(`runs ${ITERATIONS} pushDrawing calls under ${THRESHOLD_MS}ms`, () => {
        const ctx = makeCtx();
        const start = performance.now();
        for (let i = 0; i < ITERATIONS; i += 1) {
            pushDrawing(ctx, makeEmission(i));
        }
        const elapsed = performance.now() - start;
        expect(ctx.emissions.drawings).toHaveLength(ITERATIONS);
        expect(elapsed).toBeLessThan(THRESHOLD_MS);
    });
});
