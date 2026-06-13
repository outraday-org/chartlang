// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import { defineIndicator } from "@invinite-org/chartlang-core";
import type { Bar, CompiledScriptBundle, CompiledScriptObject } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { createScriptRunner } from "../createScriptRunner.js";

// THRESHOLD_MS — ceil(median × 3) budget on a local M-series, padded
// generously for slower CI runners. Bundle execution adds one dep step
// per (dep|sibling) per bar on top of the primary's compute; the
// dominant cost is still the buffer appends + ACTIVE_RUNTIME_CONTEXT
// swap. The 10-dep × 1000-bar configuration measured ~15ms locally;
// budget 3000ms for the slowest CI runner.
const THRESHOLD_MS_1_DEP = 2000;
const THRESHOLD_MS_5_DEP = 3000;
const THRESHOLD_MS_10_DEP = 4500;
const ITERATIONS = 1000;

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

function withTitledOutput(title: string, compiled: CompiledScriptObject): CompiledScriptObject {
    return Object.freeze({
        manifest: { ...compiled.manifest, outputs: [{ title, kind: "series-number" as const }] },
        compute: compiled.compute,
        output: compiled.output,
        withInputs: compiled.withInputs,
    });
}

function depIndicator(id: string): CompiledScriptObject {
    return withTitledOutput(
        "line",
        defineIndicator({
            name: `dep_${id}`,
            apiVersion: 1,
            compute: ({ bar, plot }) => {
                plot(`d:${id}:1#0`, bar.close, { title: "line" });
            },
        }),
    );
}

function primaryConsumer(depIds: ReadonlyArray<string>): CompiledScriptObject {
    return defineIndicator({
        name: "primary",
        apiVersion: 1,
        compute: ({ plot }) => {
            const fn = (globalThis as Record<string, unknown>).__chartlang_depOutput as (
                s: string,
                l: string,
                t: string,
            ) => { current: number };
            let sum = 0;
            for (const id of depIds) {
                sum += fn(`p:${id}`, id, "line").current;
            }
            plot("primary:1:1#0", sum, { title: "sum" });
        },
    });
}

function bundleWithNDeps(n: number): CompiledScriptBundle {
    const ids = Array.from({ length: n }, (_, i) => `d${i}`);
    return Object.freeze({
        primary: primaryConsumer(ids),
        dependencies: ids.map((id) => ({ localId: id, compiled: depIndicator(id) })),
        siblings: [],
    });
}

async function runBundle(n: number): Promise<void> {
    const runner = createScriptRunner({
        compiled: bundleWithNDeps(n),
        capabilities: makeCapabilities(),
    });
    for (let i = 0; i < ITERATIONS; i += 1) {
        await runner.onBarClose(makeBar(i));
    }
    await runner.dispose();
}

describe("dep bundle threshold", () => {
    it(`runs ${ITERATIONS} bars of a 1-dep bundle under ${THRESHOLD_MS_1_DEP}ms`, async () => {
        const start = performance.now();
        await runBundle(1);
        const elapsed = performance.now() - start;
        expect(elapsed).toBeLessThan(THRESHOLD_MS_1_DEP);
    });

    it(`runs ${ITERATIONS} bars of a 5-dep bundle under ${THRESHOLD_MS_5_DEP}ms`, async () => {
        const start = performance.now();
        await runBundle(5);
        const elapsed = performance.now() - start;
        expect(elapsed).toBeLessThan(THRESHOLD_MS_5_DEP);
    });

    it(`runs ${ITERATIONS} bars of a 10-dep bundle under ${THRESHOLD_MS_10_DEP}ms`, async () => {
        const start = performance.now();
        await runBundle(10);
        const elapsed = performance.now() - start;
        expect(elapsed).toBeLessThan(THRESHOLD_MS_10_DEP);
    });
});
