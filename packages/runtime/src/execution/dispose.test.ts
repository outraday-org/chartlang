// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator } from "@invinite-org/chartlang-core";
import type { Bar } from "@invinite-org/chartlang-core";
import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import { describe, expect, it } from "vitest";

import { createScriptRunner } from "../createScriptRunner";
import { ACTIVE_RUNTIME_CONTEXT } from "../runtimeContext";
import { inMemoryStateStore } from "../stateStore";

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

describe("dispose", () => {
    it("resets every OHLCV ring buffer to length 0", async () => {
        const observedLengths: number[] = [];
        const compiled = defineIndicator({
            name: "demo",
            apiVersion: 1,
            compute: () => {
                const ctx = ACTIVE_RUNTIME_CONTEXT.current;
                if (ctx) observedLengths.push(ctx.stream.ohlcv.close.length);
            },
        });
        const runner = createScriptRunner({
            compiled: { ...compiled, manifest: { ...compiled.manifest, maxLookback: 5 } },
            capabilities: makeCapabilities(),
        });
        await runner.onBarClose(makeBar(0));
        await runner.onBarClose(makeBar(1));
        await runner.onBarClose(makeBar(2));
        runner.dispose();
        await runner.onBarClose(makeBar(0));
        // After dispose, the next close on the SAME runner sees length 1
        // (one fresh append on a reset buffer).
        expect(observedLengths).toEqual([1, 2, 3, 1]);
    });

    it("clears taSlots", async () => {
        let observedSize = -1;
        let phase: "seed" | "after" = "seed";
        const compiled = defineIndicator({
            name: "demo",
            apiVersion: 1,
            compute: () => {
                const ctx = ACTIVE_RUNTIME_CONTEXT.current;
                if (!ctx) return;
                if (phase === "seed") {
                    ctx.stream.taSlots.set("slot#0", { running: 1 });
                } else {
                    observedSize = ctx.stream.taSlots.size;
                }
            },
        });
        const runner = createScriptRunner({ compiled, capabilities: makeCapabilities() });
        await runner.onBarClose(makeBar(0));
        runner.dispose();
        phase = "after";
        await runner.onBarClose(makeBar(1));
        expect(observedSize).toBe(0);
    });

    it("clears the state store passed in", async () => {
        const store = inMemoryStateStore();
        store.set("preserved-key", { value: 42 });
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
        await runner.onBarClose(makeBar(0));
        runner.dispose();
        expect(store.has("preserved-key")).toBe(false);
    });

    it("zeroes emission arrays", async () => {
        const compiled = defineIndicator({
            name: "demo",
            apiVersion: 1,
            compute: () => {
                const ctx = ACTIVE_RUNTIME_CONTEXT.current;
                if (!ctx) return;
                ctx.emissions.plots.push({
                    kind: "plot",
                    slotId: "demo.ts:1:1#0",
                    title: "x",
                    style: { kind: "line", lineWidth: 1, lineStyle: "solid" },
                    bar: 0,
                    time: 0,
                    value: 0,
                    color: null,
                    meta: {},
                    pane: "overlay",
                });
            },
        });
        const runner = createScriptRunner({ compiled, capabilities: makeCapabilities() });
        await runner.onBarClose(makeBar(0));
        runner.dispose();
        const out = runner.drain();
        expect(out.plots).toEqual([]);
        expect(out.drawings).toEqual([]);
        expect(out.alerts).toEqual([]);
        expect(out.diagnostics).toEqual([]);
    });
});
