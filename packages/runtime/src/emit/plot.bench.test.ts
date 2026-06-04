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
import { plot } from "./plot";

// THRESHOLD_MS — wall-clock budget for 10 000 plot emissions with
// unique (slotId, bar) pairs (each one appends; no dedup work).
// Local Apple-silicon (M-series) typical runs land near 500ms
// because each push routes through `validateEmission`'s plain-object
// check + style validation — budget 1500ms for slower CI hardware.
const THRESHOLD_MS = 1500;
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

describe("plot threshold", () => {
    it(`runs ${ITERATIONS} plot emissions under ${THRESHOLD_MS}ms`, () => {
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
        };
        ACTIVE_RUNTIME_CONTEXT.current = ctx;
        const start = performance.now();
        for (let i = 0; i < ITERATIONS; i += 1) {
            plot(`a:${i}#0`, i);
        }
        const elapsed = performance.now() - start;
        expect(emissions.plots).toHaveLength(ITERATIONS);
        expect(elapsed).toBeLessThan(THRESHOLD_MS);
    });
});
