// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities, RunnerEmissions } from "@invinite-org/chartlang-adapter-kit";
import {
    defineIndicator,
    type Bar,
    type CompiledScriptBundle,
    type MutableSlot,
    type StateStoreKey,
} from "@invinite-org/chartlang-core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { createScriptRunner } from "../createScriptRunner.js";
import { inMemoryPersistentStateStore } from "../persistentStateStore.js";

type RuntimeStateNamespace = {
    readonly int: (slotId: string, init: number) => MutableSlot<number>;
};

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
        maxLookback: 50,
        maxTickHz: 10,
    };
}

function key(scriptHash: string): StateStoreKey {
    return {
        scriptHash,
        compilerVersion: "0.5.0",
        apiVersion: 1,
        capabilitiesHash: "caps",
        symbol: "AAPL",
        mainInterval: "1m",
        requestedIntervals: [],
    };
}

function makeBar(i: number): Bar {
    const close = 100 + i;
    return {
        time: 1_700_000_000_000 + i * 60_000,
        open: close - 0.5,
        high: close + 1,
        low: close - 1,
        close,
        volume: 1_000 + i,
        symbol: "AAPL",
        interval: "1m",
    };
}

function withLookback<T extends ReturnType<typeof defineIndicator>>(c: T): T {
    return { ...c, manifest: { ...c.manifest, maxLookback: 50 } };
}

function counter(name: string): ReturnType<typeof defineIndicator> {
    return defineIndicator({
        name,
        apiVersion: 1,
        compute: ({ state }) => {
            const runtimeState = state as unknown as RuntimeStateNamespace;
            const slot = runtimeState.int("counter", 0);
            slot.value = slot.value + 1;
        },
    });
}

function bundleOf(
    depNames: ReadonlyArray<string>,
    siblingNames: ReadonlyArray<string>,
): CompiledScriptBundle {
    return {
        primary: withLookback(counter("primary")),
        siblings: siblingNames.map((exportName) => ({
            exportName,
            compiled: withLookback(counter(exportName)),
        })),
        dependencies: depNames.map((localId) => ({
            localId,
            compiled: withLookback(counter(localId)),
        })),
    };
}

function summariseDrain(emissions: ReadonlyArray<RunnerEmissions>): string {
    return JSON.stringify(
        emissions.map((e) => ({
            plots: e.plots.length,
            diagnostics: e.diagnostics.map((d) => d.code),
        })),
    );
}

describe("dep persistence — property test", () => {
    it("cold-replay equals warm-restart for randomly-generated bundles", async () => {
        const idArb = fc
            .tuple(
                fc.constantFrom("a", "b", "c", "d", "e", "f", "g"),
                fc.constantFrom("1", "2", "3", "4"),
            )
            .map(([letter, number]) => `${letter}${number}`);

        await fc.assert(
            fc.asyncProperty(
                fc.uniqueArray(idArb, { minLength: 0, maxLength: 3 }),
                fc.uniqueArray(idArb, { minLength: 0, maxLength: 2 }),
                fc.integer({ min: 4, max: 10 }),
                async (depNames, siblingNames, totalBars) => {
                    const split = Math.max(1, Math.floor(totalBars / 2));
                    const scriptHash = `${depNames.join("-")}|${siblingNames.join("-")}|${totalBars}`;
                    const store = inMemoryPersistentStateStore({ key: key(scriptHash) });

                    const coldRunner = createScriptRunner({
                        compiled: bundleOf(depNames, siblingNames),
                        capabilities: makeCapabilities(),
                    });
                    const coldEmissions: RunnerEmissions[] = [];
                    for (let i = 0; i < totalBars; i += 1) {
                        await coldRunner.onBarClose(makeBar(i));
                        coldEmissions.push(coldRunner.drain());
                    }

                    const seed = createScriptRunner({
                        compiled: bundleOf(depNames, siblingNames),
                        capabilities: makeCapabilities(),
                        persistentStateStore: store,
                        now: () => 1,
                    });
                    for (let i = 0; i < split; i += 1) {
                        await seed.onBarClose(makeBar(i));
                        seed.drain();
                    }
                    await seed.dispose();

                    const warm = createScriptRunner({
                        compiled: bundleOf(depNames, siblingNames),
                        capabilities: makeCapabilities(),
                        persistentStateStore: store,
                        now: () => 2,
                    });
                    await warm.warmStart(makeBar(split).time);
                    warm.drain();
                    const warmEmissions: RunnerEmissions[] = [];
                    for (let i = split; i < totalBars; i += 1) {
                        await warm.onBarClose(makeBar(i));
                        warmEmissions.push(warm.drain());
                    }

                    expect(summariseDrain(warmEmissions)).toBe(
                        summariseDrain(coldEmissions.slice(split)),
                    );
                },
            ),
            { numRuns: 50 },
        );
    });
});
