// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator } from "@invinite-org/chartlang-core";
import type { Bar } from "@invinite-org/chartlang-core";
import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities, RunnerEmissions } from "@invinite-org/chartlang-adapter-kit";
import { describe, expect, it } from "vitest";

import { createScriptRunner } from "./createScriptRunner";
import { alert, plot } from "./emit";

function makeCapabilities(overrides: Partial<Capabilities> = {}): Capabilities {
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
        ...overrides,
    };
}

function mulberry32(seed: number): () => number {
    let s = seed;
    return () => {
        s |= 0;
        s = (s + 0x6d2b79f5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
    };
}

function makeSyntheticBars(count: number, seed = 0xc0ffee): Bar[] {
    const rand = mulberry32(seed);
    const bars: Bar[] = [];
    let price = 100;
    for (let i = 0; i < count; i += 1) {
        const drift = (rand() - 0.5) * 2;
        const open = price;
        const close = price + drift;
        const high = Math.max(open, close) + rand();
        const low = Math.min(open, close) - rand();
        const volume = 1000 + rand() * 1000;
        bars.push({
            time: 1_700_000_000_000 + i * 60_000,
            open,
            high,
            low,
            close,
            volume,
            symbol: "AAPL",
            interval: "1m",
        });
        price = close;
    }
    return bars;
}

async function runOnce(bars: Bar[]): Promise<{
    finalIndex: number;
    emissions: RunnerEmissions;
    closes: number[];
}> {
    const closes: number[] = [];
    const compiled = defineIndicator({
        name: "determinism",
        apiVersion: 1,
        compute: ({ bar }) => {
            closes.push(bar.close);
        },
    });
    const runner = createScriptRunner({
        compiled: { ...compiled, manifest: { ...compiled.manifest, maxLookback: 50 } },
        capabilities: makeCapabilities(),
    });
    await runner.onHistory(bars);
    const emissions = runner.drain();
    // barIndex is private; observe via a side-channel — call a no-op
    // close after drain and inspect emissions.fromBar (which the next
    // close sets to barIndex before incrementing).
    // Cleaner: instrument the last compute call to capture barIndex.
    runner.dispose();
    return { finalIndex: closes.length, emissions, closes };
}

async function runWithPrimitives(bars: Bar[]): Promise<RunnerEmissions> {
    const compiled = defineIndicator({
        name: "determinism-primitives",
        apiVersion: 1,
        compute: ({ bar }) => {
            // Compiler-injected slot ids — hard-coded here because the
            // compiler isn't in scope. The runtime treats them as opaque
            // strings so the dedup + emission paths exercise verbatim.
            plot("script.ts:1:1#0", bar.close);
            alert("script.ts:2:1#0", "tick");
        },
    });
    const runner = createScriptRunner({
        compiled: { ...compiled, manifest: { ...compiled.manifest, maxLookback: 50 } },
        capabilities: makeCapabilities({ alerts: capabilities.alerts("toast") }),
    });
    let lastEmissions: RunnerEmissions = {
        plots: [],
        drawings: [],
        alerts: [],
        diagnostics: [],
        fromBar: 0,
        toBar: 0,
    };
    for (const b of bars) {
        await runner.onBarClose(b);
        lastEmissions = runner.drain();
    }
    runner.dispose();
    return lastEmissions;
}

describe("determinism (§6.4)", () => {
    it("two runs over the same 500 bars produce structurally identical emissions and compute reads", async () => {
        const bars = makeSyntheticBars(500);
        const run1 = await runOnce(bars);
        const run2 = await runOnce(bars);
        expect(run1.finalIndex).toBe(500);
        expect(run2.finalIndex).toBe(500);
        expect(run1.closes).toEqual(run2.closes);
        expect(run1.emissions.plots).toEqual(run2.emissions.plots);
        expect(run1.emissions.drawings).toEqual(run2.emissions.drawings);
        expect(run1.emissions.alerts).toEqual(run2.emissions.alerts);
        expect(run1.emissions.diagnostics).toEqual(run2.emissions.diagnostics);
        expect(run1.emissions.fromBar).toBe(run2.emissions.fromBar);
        expect(run1.emissions.toBar).toBe(run2.emissions.toBar);
    });

    it("two runs calling plot + alert per bar produce structurally identical emissions", async () => {
        const bars = makeSyntheticBars(500);
        const e1 = await runWithPrimitives(bars);
        const e2 = await runWithPrimitives(bars);
        expect(e1.plots).toEqual(e2.plots);
        expect(e1.alerts).toEqual(e2.alerts);
        expect(e1.diagnostics).toEqual(e2.diagnostics);
        // Sanity: the last bar pushed one plot + one alert with stable
        // dedupeKey + slot id.
        expect(e1.plots).toHaveLength(1);
        expect(e1.alerts).toHaveLength(1);
    });
});
