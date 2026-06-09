// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator } from "@invinite-org/chartlang-core";
import type { Bar, MutableSlot, StateStoreKey } from "@invinite-org/chartlang-core";
import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities, RunnerEmissions } from "@invinite-org/chartlang-adapter-kit";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { createScriptRunner } from "./createScriptRunner";
import { plot } from "./emit";
import { inMemoryPersistentStateStore } from "./persistentStateStore";
import type { RuntimeTaNamespace } from "./ta";

type RuntimeStateNamespace = {
    readonly int: (slotId: string, init: number) => MutableSlot<number>;
    readonly tick: {
        readonly int: (slotId: string, init: number) => MutableSlot<number>;
    };
};

type RuntimeTaSubset = Pick<RuntimeTaNamespace, "sma" | "ema" | "rsi">;

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

function key(): StateStoreKey {
    return {
        scriptHash: "script",
        compilerVersion: "0.5.0",
        apiVersion: 1,
        capabilitiesHash: "caps",
        symbol: "AAPL",
        mainInterval: "1m",
        requestedIntervals: [],
    };
}

function makeBar(i: number, close: number): Bar {
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

function compiled() {
    const indicator = defineIndicator({
        name: "persistent-determinism",
        apiVersion: 1,
        compute: ({ bar, state, ta }) => {
            const runtimeState = state as unknown as RuntimeStateNamespace;
            const runtimeTa = ta as unknown as RuntimeTaSubset;
            const crossBar = runtimeState.int("cross", 0);
            const tickBar = runtimeState.tick.int("tick", 0);
            const sma = runtimeTa.sma("sma", bar.close, 8);
            const ema = runtimeTa.ema("ema", bar.close, 13);
            const rsi = runtimeTa.rsi("rsi", bar.close, 14);
            crossBar.value += 1;
            tickBar.value += 1;
            plot("close", bar.close);
            plot("sma", sma.current);
            plot("ema", ema.current);
            plot("rsi", rsi.current);
            plot("cross", crossBar.value);
            plot("tick", tickBar.value);
        },
    });
    return { ...indicator, manifest: { ...indicator.manifest, maxLookback: 250 } };
}

async function run(
    bars: ReadonlyArray<Bar>,
    opts: Readonly<{
        splitSave?: boolean;
        warmStore?: ReturnType<typeof inMemoryPersistentStateStore>;
    }>,
): Promise<RunnerEmissions[]> {
    const runner = createScriptRunner({
        compiled: compiled(),
        capabilities: makeCapabilities(),
        ...(opts.warmStore === undefined ? {} : { persistentStateStore: opts.warmStore }),
    });
    if (opts.warmStore !== undefined) {
        const first = bars[0];
        if (first !== undefined) {
            await runner.warmStart(first.time);
        }
    }
    const emissions: RunnerEmissions[] = [];
    for (const bar of bars) {
        await runner.onBarClose(bar);
        emissions.push(runner.drain());
    }
    if (opts.splitSave === true) {
        await runner.dispose();
    }
    return emissions;
}

describe("persistent warm-start determinism", () => {
    it("matches cold emissions after restoring stream + state slots", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(fc.double({ min: 1, max: 1_000, noNaN: true }), {
                    minLength: 200,
                    maxLength: 200,
                }),
                async (closes) => {
                    const bars = closes.map((close, i) => makeBar(i, close));
                    const store = inMemoryPersistentStateStore({ key: key() });
                    await run(bars.slice(0, 100), { splitSave: true, warmStore: store });
                    const warmSuffix = await run(bars.slice(100), { warmStore: store });
                    const cold = await run(bars, {});
                    const coldSuffix = cold.slice(100);
                    expect(warmSuffix.map((e) => JSON.stringify(e.plots))).toEqual(
                        coldSuffix.map((e) => JSON.stringify(e.plots)),
                    );
                    expect(warmSuffix.map((e) => JSON.stringify(e.alerts))).toEqual(
                        coldSuffix.map((e) => JSON.stringify(e.alerts)),
                    );
                    expect(warmSuffix.map((e) => JSON.stringify(e.drawings))).toEqual(
                        coldSuffix.map((e) => JSON.stringify(e.drawings)),
                    );
                },
            ),
        );
    });
});
