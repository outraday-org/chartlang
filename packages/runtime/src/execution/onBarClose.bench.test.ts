// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator } from "@invinite-org/chartlang-core";
import type { Bar } from "@invinite-org/chartlang-core";
import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import { describe, expect, it } from "vitest";

import { createScriptRunner } from "../createScriptRunner";

// THRESHOLD_MS — ceil(median × 3) on local Apple-silicon (M-series).
// 10k bars of empty-compute onBarClose runs sub-50ms on M2; budget
// 200ms to keep slower CI runners green. The empty-compute path
// exercises the buffer appends, BarView mutations, and the
// ACTIVE_RUNTIME_CONTEXT swap — the dominant cost in Phase 1's runner.
const THRESHOLD_MS = 1500;
const ITERATIONS = 10_000;

function makeCapabilities(): Capabilities {
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
        maxDrawingsPerScript: {
            lines: 0,
            labels: 0,
            boxes: 0,
            polylines: 0,
            other: 0,
        },
        maxLookback: 5000,
        maxTickHz: 10,
    };
}

function makeBar(i: number): Bar {
    return {
        time: 1_700_000_000_000 + i * 60_000,
        open: 100 + (i % 1000),
        high: 101 + (i % 1000),
        low: 99 + (i % 1000),
        close: 100.5 + (i % 1000),
        volume: 1000 + (i % 1000),
        symbol: "AAPL",
        interval: "1m",
    };
}

async function hotLoop(): Promise<void> {
    const compiled = defineIndicator({
        name: "bench",
        apiVersion: 1,
        compute: ({ bar }) => {
            // Touch a field so the compute body is not optimised away.
            void bar.close;
        },
    });
    const runner = createScriptRunner({
        compiled: { ...compiled, manifest: { ...compiled.manifest, maxLookback: 50 } },
        capabilities: makeCapabilities(),
    });
    for (let i = 0; i < ITERATIONS; i += 1) {
        await runner.onBarClose(makeBar(i));
    }
    runner.dispose();
}

describe("onBarClose threshold", () => {
    it(`runs ${ITERATIONS} empty-compute onBarClose under ${THRESHOLD_MS}ms`, async () => {
        const start = performance.now();
        await hotLoop();
        const elapsed = performance.now() - start;
        expect(elapsed).toBeLessThan(THRESHOLD_MS);
    });
});
