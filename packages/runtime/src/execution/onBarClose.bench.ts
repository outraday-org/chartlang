// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator } from "@invinite-org/chartlang-core";
import type { Bar } from "@invinite-org/chartlang-core";
import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import { bench, describe } from "vitest";

import { createScriptRunner } from "../createScriptRunner.js";

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

describe("onBarClose hot loop", () => {
    bench(
        "onBarClose empty-compute throughput",
        async () => {
            const compiled = defineIndicator({
                name: "bench",
                apiVersion: 1,
                compute: ({ bar }) => {
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
        },
        { iterations: 5 },
    );
});
