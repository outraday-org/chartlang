// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import { bench, describe } from "vitest";

import {
    ACTIVE_RUNTIME_CONTEXT,
    type MutableRunnerEmissions,
    type RuntimeContext,
} from "../runtimeContext.js";
import { createStreamState } from "../streamState.js";
import { inMemoryStateStore } from "../stateStore.js";
import { hline } from "./hline.js";

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

describe("hline hot loop", () => {
    bench(
        "hline — 10k unique-slot emissions",
        () => {
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
            try {
                for (let i = 0; i < ITERATIONS; i += 1) {
                    hline(`a:${i}#0`, i);
                }
            } finally {
                ACTIVE_RUNTIME_CONTEXT.current = null;
            }
        },
        { iterations: 5 },
    );
});
