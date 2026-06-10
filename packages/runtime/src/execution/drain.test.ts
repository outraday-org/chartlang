// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineIndicator } from "@invinite-org/chartlang-core";
import type { Bar } from "@invinite-org/chartlang-core";
import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

import { createScriptRunner } from "../createScriptRunner.js";
import { ACTIVE_RUNTIME_CONTEXT } from "../runtimeContext.js";

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

describe("drain", () => {
    it("returns a frozen object", async () => {
        const compiled = defineIndicator({
            name: "demo",
            apiVersion: 1,
            compute: () => {},
        });
        const runner = createScriptRunner({ compiled, capabilities: makeCapabilities() });
        await runner.onBarClose(makeBar(0));
        const out = runner.drain();
        expect(Object.isFrozen(out)).toBe(true);
    });

    it("returns the accumulated emissions and clears the runner's queues", async () => {
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
                    bar: ctx.barIndex(),
                    time: 0,
                    value: 1,
                    color: null,
                    meta: {},
                    pane: "overlay",
                });
            },
        });
        const runner = createScriptRunner({ compiled, capabilities: makeCapabilities() });
        await runner.onBarClose(makeBar(0));
        const first = runner.drain();
        expect(first.plots).toHaveLength(1);
        const second = runner.drain();
        expect(second.plots).toEqual([]);
    });

    it("fromBar / toBar reflect the most recent step", async () => {
        const compiled = defineIndicator({
            name: "demo",
            apiVersion: 1,
            compute: () => {},
        });
        const runner = createScriptRunner({ compiled, capabilities: makeCapabilities() });
        await runner.onBarClose(makeBar(0));
        await runner.onBarClose(makeBar(1));
        await runner.onBarClose(makeBar(2));
        const out = runner.drain();
        expect(out.fromBar).toBe(2);
        expect(out.toBar).toBe(2);
    });

    it("captures arrays for drawings / alerts / diagnostics as well", async () => {
        const compiled = defineIndicator({
            name: "demo",
            apiVersion: 1,
            compute: () => {},
        });
        const runner = createScriptRunner({ compiled, capabilities: makeCapabilities() });
        await runner.onBarClose(makeBar(0));
        const out = runner.drain();
        expect(out.drawings).toEqual([]);
        expect(out.alerts).toEqual([]);
        expect(out.diagnostics).toEqual([]);
    });

    it("§6.7 invariant 4: a drain immediately after the first returns empty arrays", async () => {
        await fc.assert(
            fc.asyncProperty(fc.integer({ min: 1, max: 10 }), async (n) => {
                const compiled = defineIndicator({
                    name: "inv4",
                    apiVersion: 1,
                    compute: () => {},
                });
                const runner = createScriptRunner({
                    compiled: {
                        ...compiled,
                        manifest: { ...compiled.manifest, maxLookback: n + 1 },
                    },
                    capabilities: makeCapabilities(),
                });
                for (let i = 0; i < n; i += 1) await runner.onBarClose(makeBar(i));
                runner.drain();
                const second = runner.drain();
                runner.dispose();
                return (
                    second.plots.length === 0 &&
                    second.drawings.length === 0 &&
                    second.alerts.length === 0 &&
                    second.diagnostics.length === 0
                );
            }),
            { numRuns: 25 },
        );
    });
});
