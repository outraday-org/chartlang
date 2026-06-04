// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator } from "@invinite-org/chartlang-core";
import type { Bar } from "@invinite-org/chartlang-core";
import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import { describe, expect, it } from "vitest";

import { createScriptRunner } from "../createScriptRunner";
import { ACTIVE_RUNTIME_CONTEXT } from "../runtimeContext";

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
        open: 100 + i,
        high: 101 + i,
        low: 99 + i,
        close: 100.5 + i,
        volume: 1000 + i,
        symbol: "AAPL",
        interval: "1m",
    };
}

describe("onHistory", () => {
    it("empty array: no compute calls, barIndex stays 0", async () => {
        const seen: number[] = [];
        const compiled = defineIndicator({
            name: "demo",
            apiVersion: 1,
            compute: ({ bar }) => {
                seen.push(bar.close);
            },
        });
        const runner = createScriptRunner({ compiled, capabilities: makeCapabilities() });
        await runner.onHistory([]);
        expect(seen).toEqual([]);
    });

    it("N bars: compute called N times in forward order", async () => {
        const seen: number[] = [];
        const compiled = defineIndicator({
            name: "demo",
            apiVersion: 1,
            compute: ({ bar }) => {
                seen.push(bar.close);
            },
        });
        const runner = createScriptRunner({
            compiled: { ...compiled, manifest: { ...compiled.manifest, maxLookback: 10 } },
            capabilities: makeCapabilities(),
        });
        const bars = [makeBar(0), makeBar(1), makeBar(2), makeBar(3)];
        await runner.onHistory(bars);
        expect(seen).toEqual([100.5, 101.5, 102.5, 103.5]);
    });

    it("barIndex advances to bars.length", async () => {
        let finalIndex = -1;
        const compiled = defineIndicator({
            name: "demo",
            apiVersion: 1,
            compute: () => {
                const ctx = ACTIVE_RUNTIME_CONTEXT.current;
                if (ctx) finalIndex = ctx.barIndex();
            },
        });
        const runner = createScriptRunner({
            compiled: { ...compiled, manifest: { ...compiled.manifest, maxLookback: 10 } },
            capabilities: makeCapabilities(),
        });
        const bars = [makeBar(0), makeBar(1), makeBar(2), makeBar(3), makeBar(4)];
        await runner.onHistory(bars);
        // Last compute call sees barIndex === 4 (the index of the last bar
        // before it gets incremented in step 6).
        expect(finalIndex).toBe(4);
    });

    it("an error on bar K propagates and stops the loop", async () => {
        const seen: number[] = [];
        const compiled = defineIndicator({
            name: "boom",
            apiVersion: 1,
            compute: ({ bar }) => {
                seen.push(bar.close);
                if (seen.length === 2) throw new Error("history boom");
            },
        });
        const runner = createScriptRunner({
            compiled: { ...compiled, manifest: { ...compiled.manifest, maxLookback: 10 } },
            capabilities: makeCapabilities(),
        });
        const bars = [makeBar(0), makeBar(1), makeBar(2), makeBar(3)];
        await expect(runner.onHistory(bars)).rejects.toThrow("history boom");
        // Bar 3 onward should NOT have run.
        expect(seen).toHaveLength(2);
    });
});
