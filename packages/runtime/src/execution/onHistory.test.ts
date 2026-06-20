// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import { defineIndicator } from "@invinite-org/chartlang-core";
import type { Bar } from "@invinite-org/chartlang-core";
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

describe("onHistory", () => {
    it("empty array: no compute calls, barIndex stays 0", async () => {
        const seen: number[] = [];
        const compiled = defineIndicator({
            name: "demo",
            apiVersion: 1,
            compute: ({ bar }) => {
                seen.push(bar.close.current);
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
                seen.push(bar.close.current);
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
                seen.push(bar.close.current);
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

    it("accumulates plot emissions across every history bar (PLAN §6.1)", async () => {
        const compiled = defineIndicator({
            name: "accum",
            apiVersion: 1,
            compute: () => {
                const ctx = ACTIVE_RUNTIME_CONTEXT.current;
                if (!ctx) return;
                ctx.emissions.plots.push({
                    kind: "plot",
                    slotId: "accum.ts:1:1#0",
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
        const runner = createScriptRunner({
            compiled: { ...compiled, manifest: { ...compiled.manifest, maxLookback: 10 } },
            capabilities: makeCapabilities(),
        });
        const bars = [makeBar(0), makeBar(1), makeBar(2), makeBar(3), makeBar(4)];
        await runner.onHistory(bars);
        const out = runner.drain();
        expect(out.plots).toHaveLength(bars.length);
        expect(out.plots.map((p) => p.bar)).toEqual([0, 1, 2, 3, 4]);
        expect(out.fromBar).toBe(0);
        expect(out.toBar).toBe(bars.length - 1);
    });

    it("accumulates alert emissions across every history bar (PLAN §6.1)", async () => {
        const compiled = defineIndicator({
            name: "accum-alerts",
            apiVersion: 1,
            compute: () => {
                const ctx = ACTIVE_RUNTIME_CONTEXT.current;
                if (!ctx) return;
                ctx.emissions.alerts.push({
                    kind: "alert",
                    slotId: "accum.ts:1:1#0",
                    severity: "info",
                    message: "tick",
                    bar: ctx.barIndex(),
                    time: 0,
                    meta: {},
                    channels: ["toast"],
                    dedupeKey: `accum.ts:1:1#0|${ctx.barIndex()}|deadbeef`,
                });
            },
        });
        const runner = createScriptRunner({
            compiled: { ...compiled, manifest: { ...compiled.manifest, maxLookback: 10 } },
            capabilities: makeCapabilities(),
        });
        const bars = [makeBar(0), makeBar(1), makeBar(2)];
        await runner.onHistory(bars);
        const out = runner.drain();
        expect(out.alerts).toHaveLength(bars.length);
        expect(out.alerts.map((a) => a.bar)).toEqual([0, 1, 2]);
    });

    it("preserves pre-history queue entries (no silent drop of an undrained prior emission)", async () => {
        const compiled = defineIndicator({
            name: "preserve",
            apiVersion: 1,
            compute: () => {
                const ctx = ACTIVE_RUNTIME_CONTEXT.current;
                if (!ctx) return;
                ctx.emissions.plots.push({
                    kind: "plot",
                    slotId: "preserve.ts:1:1#0",
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
        const runner = createScriptRunner({
            compiled: { ...compiled, manifest: { ...compiled.manifest, maxLookback: 10 } },
            capabilities: makeCapabilities(),
        });
        // Run one bar via close so an emission lands in the queue, then DO NOT drain.
        await runner.onBarClose(makeBar(0));
        // Now bulk-fill some history. Pre-existing emission must survive.
        await runner.onHistory([makeBar(1), makeBar(2)]);
        const out = runner.drain();
        expect(out.plots).toHaveLength(3);
        expect(out.plots.map((p) => p.bar)).toEqual([0, 1, 2]);
    });

    it("empty onHistory([]) leaves an undrained pre-history emission intact", async () => {
        const compiled = defineIndicator({
            name: "empty-noop",
            apiVersion: 1,
            compute: () => {
                const ctx = ACTIVE_RUNTIME_CONTEXT.current;
                if (!ctx) return;
                ctx.emissions.plots.push({
                    kind: "plot",
                    slotId: "noop.ts:1:1#0",
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
        await runner.onHistory([]);
        const out = runner.drain();
        expect(out.plots).toHaveLength(1);
    });

    it("tolerates an undefined alertConditions queue on entry and after each bar", async () => {
        // Mirrors the `?? []` defensive coalescing in `drain.ts` (covered by
        // `emissionsQueue.test.ts`): the optional
        // `MutableRunnerEmissions.alertConditions` field can be `undefined`,
        // and `onHistory` must not crash either when the runner state has it
        // unset at the start of the walk OR when a `compute` body unsets it
        // mid-walk.
        const compiled = defineIndicator({
            name: "undef-acs",
            apiVersion: 1,
            compute: () => {
                const ctx = ACTIVE_RUNTIME_CONTEXT.current;
                if (!ctx) return;
                // Forces the undefined side of the `?? []` on line 50: after
                // this compute returns, `onHistory` reads the per-bar queue
                // back. `onBarClose` at the top of the next bar resets to
                // `[]`, so the undefined escapes only between bars (and once
                // after the final bar, which is what line 50's last iteration
                // sees).
                (ctx.emissions as { alertConditions?: unknown }).alertConditions = undefined;
            },
        });
        const runner = createScriptRunner({
            compiled: { ...compiled, manifest: { ...compiled.manifest, maxLookback: 10 } },
            capabilities: makeCapabilities(),
        });
        // The compute above also leaks the undefined past the post-drain
        // reset on the bar-0 `onBarClose` we run here, so the line-42 capture
        // at the top of the subsequent `onHistory` sees `undefined` too.
        await runner.onBarClose(makeBar(0));
        await runner.onHistory([makeBar(1), makeBar(2)]);
        const out = runner.drain();
        // No throws and the accumulator landed at the runner-canonical `[]`.
        expect(out.alertConditions).toEqual([]);
    });
});
