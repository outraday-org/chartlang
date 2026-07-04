// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import { defineIndicator, input } from "@invinite-org/chartlang-core";
import type { Bar, Series } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import {
    type RunnerState,
    createScriptRunner,
    resetStateForHistoryReseed,
} from "../createScriptRunner.js";
import { ACTIVE_RUNTIME_CONTEXT } from "../runtimeContext.js";

function externalSeriesInput(value: unknown): Series<number> {
    return value as Series<number>;
}

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

    it("forward continuation: history strictly after a close APPENDS and preserves the undrained emission", async () => {
        // Re-seed semantics (@since 1.10) are OVERLAP-gated: a `history` push
        // whose first bar lands strictly AFTER the last closed bar is a
        // forward continuation (the chunked-history shape hosts emit, e.g.
        // canvas2d's stream pump weaving secondary closes between main
        // chunks) — it appends at 1..2 and the undrained bar-0 close emission
        // survives, byte-identical to the pre-reseed behavior.
        const compiled = defineIndicator({
            name: "continuation",
            apiVersion: 1,
            compute: () => {
                const ctx = ACTIVE_RUNTIME_CONTEXT.current;
                if (!ctx) return;
                ctx.emissions.plots.push({
                    kind: "plot",
                    slotId: "continuation.ts:1:1#0",
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
        // Forward continuation (bars 1..2 are strictly newer): append, no re-seed.
        await runner.onHistory([makeBar(1), makeBar(2)]);
        const out = runner.drain();
        expect(out.plots).toHaveLength(3);
        expect(out.plots.map((p) => p.bar)).toEqual([0, 1, 2]);
    });

    it("re-seed: an OVERLAPPING history push after a close drops the undrained emission and replays from bar 0", async () => {
        // The overlap gate: the pushed batch starts AT the last closed bar's
        // time (not strictly after), so it is a re-seed — the undrained bar-0
        // close emission is DROPPED and the two bars replay at 0..1.
        const compiled = defineIndicator({
            name: "reseed",
            apiVersion: 1,
            compute: () => {
                const ctx = ACTIVE_RUNTIME_CONTEXT.current;
                if (!ctx) return;
                ctx.emissions.plots.push({
                    kind: "plot",
                    slotId: "reseed.ts:1:1#0",
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
        // Overlapping push (starts at bar 0's time): re-seed → emission dropped.
        await runner.onHistory([makeBar(0), makeBar(1)]);
        const out = runner.drain();
        expect(out.plots).toHaveLength(2);
        expect(out.plots.map((p) => p.bar)).toEqual([0, 1]);
        expect(out.fromBar).toBe(0);
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
        // Use a TICK (which does not advance `barIndex`) so the subsequent
        // `onHistory` stays on the fresh-runner append path (no re-seed, which
        // would replace the emissions): the compute leaks `undefined` into the
        // queue, so the initial-capture `?? []` at the top of `onHistory` sees
        // `undefined`.
        await runner.onBarTick(makeBar(0));
        await runner.onHistory([makeBar(1), makeBar(2)]);
        const out = runner.drain();
        // No throws and the accumulator landed at the runner-canonical `[]`.
        expect(out.alertConditions).toEqual([]);
    });

    it("re-seed: re-pushing the same history replays plots from bar 0 (not appended)", async () => {
        const compiled = defineIndicator({
            name: "reseed-zero",
            apiVersion: 1,
            compute: ({ plot, bar }) => {
                plot("p:1:1#0", bar.close.current);
            },
        });
        const runner = createScriptRunner({
            compiled: { ...compiled, manifest: { ...compiled.manifest, maxLookback: 10 } },
            capabilities: makeCapabilities(),
        });
        const bars = [makeBar(0), makeBar(1), makeBar(2), makeBar(3), makeBar(4)];

        await runner.onHistory(bars);
        const first = runner.drain();
        expect(first.plots.map((p) => p.bar)).toEqual([0, 1, 2, 3, 4]);

        // Second identical history → re-seed → replay at 0..4, NOT 5..9.
        await runner.onHistory(bars);
        const second = runner.drain();
        expect(second.plots.map((p) => p.bar)).toEqual([0, 1, 2, 3, 4]);
        expect(second.fromBar).toBe(0);
        expect(second.plots.map((p) => p.value)).toEqual(bars.map((b) => b.close));
    });

    it("re-seed: external feeds are re-read from bar 0 (the invinite consumer scenario)", async () => {
        const compiled = defineIndicator({
            name: "feed-reseed",
            apiVersion: 1,
            inputs: {
                feed: input.externalSeries({
                    name: "feed",
                    schema: { kind: "external-series-schema" },
                }),
            },
            compute: ({ plot, inputs }) => {
                plot("p:1:1#0", externalSeriesInput(inputs.feed).current);
            },
        });
        const bars = [makeBar(0), makeBar(1), makeBar(2)];
        const runner = createScriptRunner({
            compiled: { ...compiled, manifest: { ...compiled.manifest, maxLookback: 10 } },
            capabilities: makeCapabilities(),
            // First seed reads an all-NaN feed → plots are NaN gaps.
            externalSeriesFeeds: { feed: { values: [Number.NaN, Number.NaN, Number.NaN] } },
        });

        await runner.onHistory(bars);
        expect(runner.drain().plots.map((p) => p.value)).toEqual([null, null, null]);

        // Live feed now has real values; re-seed re-reads it from bar 0.
        runner.setExternalSeries({ feed: { values: [10, 20, 30] } });
        await runner.onHistory(bars);
        expect(runner.drain().plots.map((p) => p.value)).toEqual([10, 20, 30]);
    });

    it("re-seed: plot overrides set live survive the re-seed", async () => {
        const compiled = defineIndicator({
            name: "override-reseed",
            apiVersion: 1,
            compute: ({ plot }) => {
                plot("p:1:1#0", 1, { color: "#000" });
            },
        });
        const runner = createScriptRunner({
            compiled: { ...compiled, manifest: { ...compiled.manifest, maxLookback: 10 } },
            capabilities: makeCapabilities(),
        });

        await runner.onHistory([makeBar(0), makeBar(1)]);
        runner.drain();

        // Live override, then re-push history → the replayed emissions carry it.
        runner.setPlotOverrides({ "p:1:1#0": { visible: false, color: "#f00" } });
        await runner.onHistory([makeBar(0), makeBar(1)]);
        const out = runner.drain();
        expect(out.plots).toHaveLength(2);
        expect(out.plots.every((p) => p.color === "#f00" && p.visible === false)).toBe(true);
    });

    it("re-seed: state.* slots reset — accumulation matches the first seed exactly", async () => {
        const compiled = defineIndicator({
            name: "state-reseed",
            apiVersion: 1,
            compute: ({ plot, state }) => {
                const acc = state.float("s:1:1#0", 0);
                acc.value = acc.value + 1;
                plot("p:1:1#0", acc.value);
            },
        });
        const runner = createScriptRunner({
            compiled: { ...compiled, manifest: { ...compiled.manifest, maxLookback: 10 } },
            capabilities: makeCapabilities(),
        });
        const bars = [makeBar(0), makeBar(1), makeBar(2)];

        await runner.onHistory(bars);
        const first = runner.drain().plots.map((p) => p.value);

        await runner.onHistory(bars);
        const second = runner.drain().plots.map((p) => p.value);

        // No carry-over: the accumulator restarts at 0 on the re-seed.
        expect(first).toEqual([1, 2, 3]);
        expect(second).toEqual(first);
    });

    it("fresh runner: first-ever history is byte-identical across two fresh runners", async () => {
        const define = () =>
            defineIndicator({
                name: "fresh",
                apiVersion: 1,
                compute: ({ plot, bar }) => {
                    plot("p:1:1#0", bar.close.current);
                },
            });
        const bars = [makeBar(0), makeBar(1), makeBar(2), makeBar(3), makeBar(4)];

        const a = createScriptRunner({
            compiled: { ...define(), manifest: { ...define().manifest, maxLookback: 10 } },
            capabilities: makeCapabilities(),
        });
        await a.onHistory(bars);
        const outA = a.drain();

        const b = createScriptRunner({
            compiled: { ...define(), manifest: { ...define().manifest, maxLookback: 10 } },
            capabilities: makeCapabilities(),
        });
        await b.onHistory(bars);
        const outB = b.drain();

        expect(outA.plots).toEqual(outB.plots);
        expect(outA.fromBar).toBe(0);
        expect(outA.toBar).toBe(bars.length - 1);
    });

    it("re-seed: undrained pre-reseed emissions are dropped (only the second walk survives)", async () => {
        const compiled = defineIndicator({
            name: "drop-undrained",
            apiVersion: 1,
            compute: ({ plot, bar }) => {
                plot("p:1:1#0", bar.close.current);
            },
        });
        const runner = createScriptRunner({
            compiled: { ...compiled, manifest: { ...compiled.manifest, maxLookback: 10 } },
            capabilities: makeCapabilities(),
        });

        // Push history but do NOT drain, then push history again.
        await runner.onHistory([makeBar(0), makeBar(1)]);
        await runner.onHistory([makeBar(0), makeBar(1)]);
        const out = runner.drain();

        expect(out.plots).toHaveLength(2);
        expect(out.plots.map((p) => p.bar)).toEqual([0, 1]);
    });

    it("re-seed: secondary streams reset empty — request.security replays as NaN until re-pushed", async () => {
        const intervals = [{ value: "1D", label: "1 day", group: "daily" }];
        const base = defineIndicator({
            name: "sec-reseed",
            apiVersion: 1,
            compute: () => {},
        });
        const compiled = {
            manifest: { ...base.manifest, maxLookback: 10, requestedIntervals: ["1D"] },
            compute: (({
                plot,
                request,
            }: { readonly plot: unknown; readonly request: unknown }) => {
                const daily = (
                    request as {
                        readonly security: (
                            slotId: string,
                            opts: { readonly interval: string },
                        ) => { readonly close: { readonly current: number } };
                    }
                ).security("sec.chart.ts:1:1#0", { interval: "1D" });
                (plot as (slotId: string, value: number) => void)("p:1:1#0", daily.close.current);
            }) as never,
        };
        const runner = createScriptRunner({
            compiled,
            capabilities: { ...makeCapabilities(), intervals, multiTimeframe: true },
        });

        // Seed: a daily bar before the main bar, then main history.
        await runner.push({
            kind: "history",
            bars: [{ ...makeBar(0), time: makeBar(0).time - 60_000, close: 210, interval: "1D" }],
            streamKey: "1D",
        });
        await runner.onHistory([makeBar(0)]);
        expect(runner.drain().plots[0].value).toBe(210);

        // Re-seed the main stream WITHOUT re-pushing the daily → secondary
        // stream is empty again → the aligned security bar is NaN.
        await runner.onHistory([makeBar(0)]);
        expect(runner.drain().plots[0].value).toBeNull();
    });

    it("re-seed: fires identically via runner.onHistory and runner.push({ kind: 'history' })", async () => {
        const bars = [makeBar(0), makeBar(1), makeBar(2), makeBar(3), makeBar(4)];
        const define = () =>
            defineIndicator({
                name: "both-entrypoints",
                apiVersion: 1,
                compute: ({ plot, bar }) => {
                    plot("p:1:1#0", bar.close.current);
                },
            });

        // Second history via runner.onHistory(...)
        const viaOnHistory = createScriptRunner({
            compiled: { ...define(), manifest: { ...define().manifest, maxLookback: 10 } },
            capabilities: makeCapabilities(),
        });
        await viaOnHistory.onHistory(bars);
        viaOnHistory.drain();
        await viaOnHistory.onHistory(bars);
        const a = viaOnHistory.drain();

        // Second history via runner.push({ kind: "history", bars })
        const viaPush = createScriptRunner({
            compiled: { ...define(), manifest: { ...define().manifest, maxLookback: 10 } },
            capabilities: makeCapabilities(),
        });
        await viaPush.push({ kind: "history", bars });
        viaPush.drain();
        await viaPush.push({ kind: "history", bars });
        const b = viaPush.drain();

        expect(a.plots.map((p) => p.bar)).toEqual([0, 1, 2, 3, 4]);
        expect(b.plots.map((p) => p.bar)).toEqual([0, 1, 2, 3, 4]);
        expect(a.fromBar).toBe(0);
        expect(b.fromBar).toBe(0);
    });

    it("re-seed: rebuilds a bundle's sibling runner and replays it from bar 0", async () => {
        const sibling = defineIndicator({
            name: "slow",
            apiVersion: 1,
            compute: ({ plot, bar }) => {
                plot("s:1:1#0", bar.close.current);
            },
        });
        const primary = defineIndicator({
            name: "primary",
            apiVersion: 1,
            compute: ({ plot, bar }) => {
                plot("p:1:1#0", bar.close.current);
            },
        });
        const bundle = Object.freeze({
            primary,
            dependencies: [],
            siblings: [{ exportName: "slow", compiled: sibling }],
        });
        const runner = createScriptRunner({ compiled: bundle, capabilities: makeCapabilities() });
        const bars = [makeBar(0), makeBar(1), makeBar(2)];

        await runner.onHistory(bars);
        const first = runner.drain();
        // Per bar: sibling then primary → both scripts emit at each bar.
        expect(first.plots).toHaveLength(bars.length * 2);
        expect(first.plots.map((p) => p.bar)).toEqual([0, 0, 1, 1, 2, 2]);

        // Re-seed drives the `isCompiledScriptBundle` rebuild: the sibling
        // runner is rebuilt fresh and replays from bar 0, not appended.
        await runner.onHistory(bars);
        const second = runner.drain();
        expect(second.plots.map((p) => p.bar)).toEqual(first.plots.map((p) => p.bar));
        expect(second.fromBar).toBe(0);
        await runner.dispose();
    });

    it("resetStateForHistoryReseed is a no-op on a sub-runner state missing rebuild inputs", () => {
        // Dep / sibling states carry no `args` / `primary` (they never take a
        // `history` re-push). Calling the helper on such a state must safely
        // no-op — this guards the early-return branch both ways.
        const noArgs = { barIndex: 3 } as unknown as RunnerState;
        expect(() => resetStateForHistoryReseed(noArgs)).not.toThrow();
        const argsNoPrimary = { barIndex: 3, args: {} } as unknown as RunnerState;
        expect(() => resetStateForHistoryReseed(argsNoPrimary)).not.toThrow();
    });
});
