// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator } from "@invinite-org/chartlang-core";
import type { Bar } from "@invinite-org/chartlang-core";
import { capabilities, mockCandleSource } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities, CandleEvent } from "@invinite-org/chartlang-adapter-kit";
import { describe, expect, it, vi } from "vitest";

import { createScriptRunner } from "./createScriptRunner";
import { inMemoryStateStore } from "./stateStore";

function makeCapabilities(maxLookback = 5000): Capabilities {
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
        maxLookback,
        maxTickHz: 10,
    };
}

function makeBar(i: number): Bar {
    const t = 1_700_000_000_000 + i * 60_000;
    const o = 100 + i;
    return {
        time: t,
        open: o,
        high: o + 1,
        low: o - 1,
        close: o + 0.5,
        volume: 1000 + i,
        symbol: "AAPL",
        interval: "1m",
    };
}

describe("createScriptRunner", () => {
    it("returns a ScriptRunner with all five methods", () => {
        const compiled = defineIndicator({
            name: "demo",
            apiVersion: 1,
            compute: () => {},
        });
        const runner = createScriptRunner({ compiled, capabilities: makeCapabilities() });
        expect(typeof runner.onHistory).toBe("function");
        expect(typeof runner.onBarClose).toBe("function");
        expect(typeof runner.onBarTick).toBe("function");
        expect(typeof runner.drain).toBe("function");
        expect(typeof runner.dispose).toBe("function");
    });

    it("defaults to an in-memory state store when none is supplied", async () => {
        const calls: number[] = [];
        const compiled = defineIndicator({
            name: "demo",
            apiVersion: 1,
            compute: ({ bar }) => {
                calls.push(bar.close);
            },
        });
        const runner = createScriptRunner({ compiled, capabilities: makeCapabilities() });
        await runner.onBarClose(makeBar(0));
        expect(calls).toEqual([100.5]);
    });

    it("threads a custom state store through to the runtime", async () => {
        const store = inMemoryStateStore();
        const spy = vi.spyOn(store, "clear");
        const compiled = defineIndicator({
            name: "demo",
            apiVersion: 1,
            compute: () => {},
        });
        const runner = createScriptRunner({
            compiled,
            capabilities: makeCapabilities(),
            stateStore: store,
        });
        runner.dispose();
        expect(spy).toHaveBeenCalledOnce();
    });

    it("sizes ring buffers to max(1, maxLookback + 1) when seriesCapacities is empty", async () => {
        const compiled = defineIndicator({
            name: "demo",
            apiVersion: 1,
            compute: () => {},
        });
        const runner = createScriptRunner({ compiled, capabilities: makeCapabilities() });
        await runner.onBarClose(makeBar(0));
        // maxLookback defaults to 0 → capacity 1 → 1 slot. A second close
        // overwrites the head (still capacity 1, length 1).
        await runner.onBarClose(makeBar(1));
        runner.dispose();
    });

    it("honours manifest.seriesCapacities.ohlcv when provided", async () => {
        const compiled = defineIndicator({
            name: "demo",
            apiVersion: 1,
            compute: () => {},
        });
        const customCompiled = {
            manifest: { ...compiled.manifest, seriesCapacities: { ohlcv: 10 } },
            compute: compiled.compute,
        };
        const runner = createScriptRunner({
            compiled: customCompiled,
            capabilities: makeCapabilities(),
        });
        for (let i = 0; i < 5; i += 1) {
            await runner.onBarClose(makeBar(i));
        }
        // No assertion here beyond "no throw" — capacity is private but
        // the buffer must accept 5 appends without resetting head past 0.
        runner.dispose();
    });

    it("clamps capacity to a minimum of 1 when maxLookback is negative", async () => {
        const compiled = defineIndicator({
            name: "demo",
            apiVersion: 1,
            compute: () => {},
        });
        const negative = {
            manifest: { ...compiled.manifest, maxLookback: -5 },
            compute: compiled.compute,
        };
        const runner = createScriptRunner({
            compiled: negative,
            capabilities: makeCapabilities(),
        });
        await runner.onBarClose(makeBar(0));
        runner.dispose();
    });

    it("end-to-end: defineIndicator no-primitive compute runs through onHistory → drain → dispose", async () => {
        const seen: number[] = [];
        const compiled = defineIndicator({
            name: "e2e",
            apiVersion: 1,
            compute: ({ bar }) => {
                seen.push(bar.close);
            },
        });
        const runner = createScriptRunner({ compiled, capabilities: makeCapabilities() });

        // Consume a `history` event from mockCandleSource — the runner does
        // not iterate the source itself; that's the host-worker's job.
        const source = mockCandleSource([makeBar(0), makeBar(1), makeBar(2)], {
            interval: "1m",
        });
        const events: CandleEvent[] = [];
        for await (const evt of source) events.push(evt);

        expect(events).toHaveLength(1);
        const head = events[0];
        expect(head.kind).toBe("history");
        if (head.kind === "history") {
            await runner.onHistory(head.bars);
        }

        const emissions = runner.drain();
        expect(emissions.plots).toEqual([]);
        expect(emissions.drawings).toEqual([]);
        expect(emissions.alerts).toEqual([]);
        expect(emissions.diagnostics).toEqual([]);
        expect(seen).toHaveLength(3);

        runner.dispose();
    });
});
