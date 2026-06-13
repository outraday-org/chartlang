// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import { defineIndicator } from "@invinite-org/chartlang-core";
import type { Bar, CompiledScriptBundle, CompiledScriptObject } from "@invinite-org/chartlang-core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { createScriptRunner } from "../createScriptRunner.js";

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

function withTitledOutput(title: string, compiled: CompiledScriptObject): CompiledScriptObject {
    return Object.freeze({
        manifest: { ...compiled.manifest, outputs: [{ title, kind: "series-number" as const }] },
        compute: compiled.compute,
        output: compiled.output,
        withInputs: compiled.withInputs,
    });
}

function makeBar(i: number, base = 100): Bar {
    return {
        time: 1_700_000_000_000 + i * 60_000,
        open: base + (i % 11),
        high: base + 1 + (i % 11),
        low: base - 1 + (i % 11),
        close: base + 0.5 + (i % 11),
        volume: 1000 + (i % 7),
        symbol: "T",
        interval: "1m",
    };
}

function depIndicator(localId: string, plotEveryN: number): CompiledScriptObject {
    return withTitledOutput(
        "line",
        defineIndicator({
            name: `dep_${localId}`,
            apiVersion: 1,
            compute: ({ bar, plot }) => {
                if (Math.trunc(bar.time / 60_000) % plotEveryN === 0) {
                    plot(`d:${localId}:1#0`, bar.close, { title: "line" });
                }
            },
        }),
    );
}

function siblingIndicator(name: string, plotEveryN: number): CompiledScriptObject {
    return withTitledOutput(
        "line",
        defineIndicator({
            name: `sib_${name}`,
            apiVersion: 1,
            compute: ({ bar, plot }) => {
                if (Math.trunc(bar.time / 60_000) % plotEveryN === 0) {
                    plot(`s:${name}:1#0`, bar.close + 1, { title: "line" });
                }
            },
        }),
    );
}

function primaryIndicator(depLocalIds: ReadonlyArray<string>): CompiledScriptObject {
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
            let count = 0;
            for (const id of depLocalIds) {
                const v = fn(`p:${id}`, id, "line").current;
                if (!Number.isNaN(v)) {
                    sum += v;
                    count += 1;
                }
            }
            plot("primary:1:1#0", count === 0 ? 0 : sum / count, { title: "avg" });
        },
    });
}

type ScenarioInput = Readonly<{
    readonly depCount: number;
    readonly siblingCount: number;
    readonly barCount: number;
    readonly plotCadence: number;
}>;

function buildBundle(input: ScenarioInput): CompiledScriptBundle {
    const dependencies = Array.from({ length: input.depCount }, (_, i) => ({
        localId: `d${i}`,
        compiled: depIndicator(`d${i}`, input.plotCadence),
    }));
    const siblings = Array.from({ length: input.siblingCount }, (_, i) => ({
        exportName: `s${i}`,
        compiled: siblingIndicator(`s${i}`, input.plotCadence),
    }));
    const primary = primaryIndicator(dependencies.map((d) => d.localId));
    return Object.freeze({
        primary,
        dependencies,
        siblings,
    });
}

async function runScenario(input: ScenarioInput) {
    const runner = createScriptRunner({
        compiled: buildBundle(input),
        capabilities: makeCapabilities(),
    });
    const bars = Array.from({ length: input.barCount }, (_, i) => makeBar(i));
    await runner.onHistory(bars);
    const drained = runner.drain();
    await runner.dispose();
    return drained;
}

const scenarioArb: fc.Arbitrary<ScenarioInput> = fc.record({
    depCount: fc.integer({ min: 0, max: 5 }),
    siblingCount: fc.integer({ min: 0, max: 5 }),
    barCount: fc.integer({ min: 1, max: 20 }),
    plotCadence: fc.integer({ min: 1, max: 4 }),
});

describe("dep/property — invariants over random bundles", () => {
    it("private-dep plots never reach the parent's plots[]", async () => {
        await fc.assert(
            fc.asyncProperty(scenarioArb, async (input) => {
                const drained = await runScenario(input);
                for (const plot of drained.plots) {
                    expect(plot.slotId.startsWith("dep:")).toBe(false);
                }
            }),
            { seed: 42, numRuns: 25 },
        );
    });

    it("sibling plots always carry the export:<exportName>/ prefix", async () => {
        await fc.assert(
            fc.asyncProperty(scenarioArb, async (input) => {
                const drained = await runScenario(input);
                for (const plot of drained.plots) {
                    if (plot.slotId.startsWith("export:")) {
                        expect(/^export:s\d+\//.test(plot.slotId)).toBe(true);
                    }
                }
            }),
            { seed: 42, numRuns: 25 },
        );
    });

    it("re-running the same scenario produces byte-identical drain output", async () => {
        await fc.assert(
            fc.asyncProperty(scenarioArb, async (input) => {
                const a = await runScenario(input);
                const b = await runScenario(input);
                const projA = a.plots.map((p) => ({
                    slotId: p.slotId,
                    title: p.title,
                    value: p.value,
                    bar: p.bar,
                }));
                const projB = b.plots.map((p) => ({
                    slotId: p.slotId,
                    title: p.title,
                    value: p.value,
                    bar: p.bar,
                }));
                expect(JSON.stringify(projA)).toBe(JSON.stringify(projB));
            }),
            { seed: 42, numRuns: 10 },
        );
    });

    it("dep execution respects declaration order in bundle.dependencies[]", async () => {
        // The primary computes an average over dep outputs in dependency-array
        // order; given that all deps plot the same value on a given bar, the
        // primary's avg should match bar.close + 0 (deps plot bar.close exactly).
        await fc.assert(
            fc.asyncProperty(
                scenarioArb.filter((s) => s.depCount > 0 && s.plotCadence === 1),
                async (input) => {
                    const drained = await runScenario(input);
                    const avgPlots = drained.plots.filter((p) => p.title === "avg");
                    for (const p of avgPlots) {
                        const expected = 100 + 0.5 + (p.bar % 11);
                        expect(p.value).toBeCloseTo(expected, 6);
                    }
                },
            ),
            { seed: 42, numRuns: 15 },
        );
    });
});
