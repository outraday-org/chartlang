// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import { afterEach, describe, expect, it } from "vitest";

import {
    ACTIVE_RUNTIME_CONTEXT,
    type MutableRunnerEmissions,
    type RuntimeContext,
} from "../runtimeContext";
import { createStreamState } from "../streamState";
import { inMemoryStateStore } from "../stateStore";
import { hline } from "./hline";

// THRESHOLD_MS — 10 000 unique-slot hline emissions; same budget as
// `plot.bench.test.ts` (the path is nearly identical, just a different
// style kind). Bumped to 4000ms after the workspace `pnpm test` load
// (665 test files in parallel) was observed spiking to ~3150ms under
// parallel-worker scheduling contention — past the prior 3000ms gate.
// Isolation runs land near 180ms, so 4000ms still catches a >20× regression.
const THRESHOLD_MS = 4000;
const ITERATIONS = 10_000;

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

afterEach(() => {
    ACTIVE_RUNTIME_CONTEXT.current = null;
});

describe("hline threshold", () => {
    it(`runs ${ITERATIONS} hline emissions under ${THRESHOLD_MS}ms`, () => {
        const emissions: MutableRunnerEmissions = {
            plots: [],
            drawings: [],
            alerts: [],
            diagnostics: [],
            fromBar: 0,
            toBar: 0,
        };
        const stream = createStreamState({ interval: "", capacity: 4, symbol: "" });
        const ctx: RuntimeContext = {
            stream,
            stateStore: inMemoryStateStore(),
            capabilities: makeCaps(),
            emissions,
            barIndex: () => 0,
            isTick: false,
            drawingSlots: new Map(),
            drawingSubIdCounters: new Map(),
            drawingBucketCounters: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
            scriptMaxDrawings: null,
            stateSlots: new Map(),
        };
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        const start = performance.now();
        for (let i = 0; i < ITERATIONS; i += 1) {
            hline(`a:${i}#0`, i);
        }
        const elapsed = performance.now() - start;
        expect(emissions.plots).toHaveLength(ITERATIONS);
        expect(elapsed).toBeLessThan(THRESHOLD_MS);
    });
});
