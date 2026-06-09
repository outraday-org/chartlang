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
import { alert } from "./alert";

// THRESHOLD_MS — 10 000 unique-slot alert emissions; alerts include
// a FNV-1a hash + JSON.stringify call per push. Keep the same smoke-test
// budget as plot/hline so recursive workspace `pnpm test` worker
// contention does not make coverage flaky; the strict benchmark lives
// in the dedicated bench harness.
const THRESHOLD_MS = 3000;
const ITERATIONS = 10_000;

function makeCaps(): Capabilities {
    return {
        plots: capabilities.allLines(),
        drawings: new Set(),
        alerts: capabilities.alerts("toast"),
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

describe("alert threshold", () => {
    it(`runs ${ITERATIONS} alert emissions under ${THRESHOLD_MS}ms`, () => {
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
            alert(`a:${i}#0`, `msg ${i}`);
        }
        const elapsed = performance.now() - start;
        expect(emissions.alerts).toHaveLength(ITERATIONS);
        expect(elapsed).toBeLessThan(THRESHOLD_MS);
    });
});
