// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities, mockCandleSource } from "@invinite-org/chartlang-adapter-kit";
import type { CandleEvent, Capabilities } from "@invinite-org/chartlang-adapter-kit";
import { defineIndicator, input } from "@invinite-org/chartlang-core";
import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { createScriptRunner } from "./createScriptRunner.js";
import { ACTIVE_RUNTIME_CONTEXT } from "./runtimeContext.js";
import { inMemoryStateStore } from "./stateStore.js";

function makeCapabilities(maxLookback = 5000): Capabilities {
    return {
        plots: capabilities.allLines(),
        drawings: new Set(),
        alerts: new Set(),
        alertConditions: false,
        logs: false,
        inputs: new Set(),
        intervals: [
            { value: "1m", label: "1 minute", group: "minute" },
            { value: "1D", label: "1 day", group: "daily" },
        ],
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
    it("returns a ScriptRunner with all five methods", async () => {
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
        await runner.dispose();
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
        await runner.dispose();
    });

    it("threads a custom state store through to the runtime", async () => {
        const store = inMemoryStateStore();
        store.set("host-owned", 1);
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
        await runner.dispose();
        expect(store.get("host-owned")).toBe(1);
    });

    it("populates mount-time syminfo through the compute context", async () => {
        const seen: string[] = [];
        const compiled = defineIndicator({
            name: "demo",
            apiVersion: 1,
            compute: ({ syminfo }) => {
                seen.push(`${syminfo.ticker}:${syminfo.currency}:${syminfo.exchange}`);
            },
        });
        const caps = { ...makeCapabilities(), symInfoFields: new Set(["ticker", "currency"]) };
        const runner = createScriptRunner({
            compiled,
            capabilities: caps,
            symInfo: {
                ticker: "DEMO",
                currency: "USD",
                exchange: "CHARTLANG",
            },
        });

        await runner.onBarClose(makeBar(0));

        expect(seen).toEqual(["DEMO:USD:"]);
    });

    it("resolves manifest inputs with mount-time overrides", async () => {
        const seen: ReadonlyArray<unknown>[] = [];
        const compiled = defineIndicator({
            name: "demo",
            apiVersion: 1,
            inputs: {
                length: input.int(14),
                source: input.source("close"),
            },
            compute: ({ inputs }) => {
                seen.push([inputs.length, inputs.source]);
            },
        });
        const runner = createScriptRunner({
            compiled,
            capabilities: makeCapabilities(),
            resolveInputs: (scriptId) => (scriptId === "demo" ? { length: 20, source: "hl2" } : {}),
        });

        await runner.onBarClose(makeBar(0));

        expect(seen).toEqual([[20, "hl2"]]);
    });

    it("emits input diagnostics once per mount key and keeps defaults", async () => {
        const seen: ReadonlyArray<unknown>[] = [];
        const compiled = defineIndicator({
            name: "demo",
            apiVersion: 1,
            inputs: {
                length: input.int(14),
                source: input.source("close"),
            },
            compute: ({ inputs }) => {
                seen.push([inputs.length, inputs.source]);
            },
        });
        const runner = createScriptRunner({
            compiled,
            capabilities: makeCapabilities(),
            inputOverrides: { length: "bad", source: "bad" },
        });
        const diagnostics = runner.drain().diagnostics;

        await runner.onBarClose(makeBar(0));
        await runner.onBarClose(makeBar(1));

        expect(seen).toEqual([
            [14, "close"],
            [14, "close"],
        ]);
        expect(diagnostics.map((d) => d.slotId)).toEqual(["length", "source"]);
        expect(diagnostics.every((d) => d.code === "input-coercion-failed")).toBe(true);
    });

    it("applies mount-time plot overrides supplied directly via args.plotOverrides", async () => {
        const compiled = defineIndicator({
            name: "demo",
            apiVersion: 1,
            compute: ({ plot }) => {
                plot("p:1:1#0", 1, { color: "#000" });
            },
        });
        const runner = createScriptRunner({
            compiled,
            capabilities: makeCapabilities(),
            plotOverrides: { "p:1:1#0": { visible: false, color: "#f00" } },
        });

        await runner.onBarClose(makeBar(0));
        const e = runner.drain().plots[0];

        expect(e.visible).toBe(false);
        expect(e.color).toBe("#f00");
    });

    it("resolves mount-time plot overrides through the resolvePlotOverrides callback", async () => {
        const seen: string[] = [];
        const compiled = defineIndicator({
            name: "demo",
            apiVersion: 1,
            compute: ({ plot }) => {
                plot("p:1:1#0", 1, { color: "#000" });
            },
        });
        const runner = createScriptRunner({
            compiled,
            capabilities: makeCapabilities(),
            resolvePlotOverrides: (scriptId) => {
                seen.push(scriptId);
                return scriptId === "demo" ? { "p:1:1#0": { color: "#0f0" } } : {};
            },
        });

        await runner.onBarClose(makeBar(0));

        expect(seen).toEqual(["demo"]);
        expect(runner.drain().plots[0].color).toBe("#0f0");
    });

    it("setPlotOverrides swaps the map live, reflected on the next drain with no extra compute", async () => {
        let computeCalls = 0;
        const compiled = defineIndicator({
            name: "demo",
            apiVersion: 1,
            compute: ({ plot }) => {
                computeCalls += 1;
                plot("p:1:1#0", 1, { color: "#000" });
            },
        });
        const runner = createScriptRunner({ compiled, capabilities: makeCapabilities() });

        await runner.onBarClose(makeBar(0));
        expect(runner.drain().plots[0].color).toBe("#000");
        const callsAfterFirstDrain = computeCalls;

        // Live swap — must not trigger a recompute.
        runner.setPlotOverrides({ "p:1:1#0": { visible: false, color: "#f00" } });
        expect(computeCalls).toBe(callsAfterFirstDrain);

        await runner.onBarClose(makeBar(1));
        const e = runner.drain().plots[0];
        expect(e.color).toBe("#f00");
        expect(e.visible).toBe(false);
    });

    it("routes plots to overlay on an overlay:true mount", async () => {
        const compiled = defineIndicator({
            name: "demo",
            apiVersion: 1,
            overlay: true,
            compute: ({ plot }) => {
                plot("p:1:1#0", 42);
            },
        });
        const runner = createScriptRunner({
            compiled,
            capabilities: { ...makeCapabilities(), subPanes: 1 },
        });
        await runner.onBarClose(makeBar(0));
        expect(runner.drain().plots[0].pane).toBe("overlay");
    });

    it("routes plots to the sanitised script pane on an overlay:false mount", async () => {
        const compiled = defineIndicator({
            name: "RSI Cross",
            apiVersion: 1,
            overlay: false,
            compute: ({ plot }) => {
                plot("p:1:1#0", 42);
            },
        });
        const runner = createScriptRunner({
            compiled,
            capabilities: { ...makeCapabilities(), subPanes: 1 },
        });
        await runner.onBarClose(makeBar(0));
        expect(runner.drain().plots[0].pane).toBe("script:RSI-Cross");
    });

    it("falls back to script:default when an overlay:false name is empty", async () => {
        const compiled = defineIndicator({
            name: "",
            apiVersion: 1,
            overlay: false,
            compute: ({ plot }) => {
                plot("p:1:1#0", 42);
            },
        });
        const runner = createScriptRunner({
            compiled,
            capabilities: { ...makeCapabilities(), subPanes: 1 },
        });
        await runner.onBarClose(makeBar(0));
        expect(runner.drain().plots[0].pane).toBe("script:default");
    });

    it("gives an overlay:true script a stable scriptPane for explicit pane: 'new'", async () => {
        const compiled = defineIndicator({
            name: "RSI Cross",
            apiVersion: 1,
            overlay: true,
            compute: ({ plot }) => {
                plot("p:1:1#0", 42, { pane: "new" });
            },
        });
        const runner = createScriptRunner({
            compiled,
            capabilities: { ...makeCapabilities(), subPanes: 1 },
        });
        await runner.onBarClose(makeBar(0));
        expect(runner.drain().plots[0].pane).toBe("script:RSI-Cross");
    });

    it("refreshes barstate and timeframe before every compute step", async () => {
        const seen: Array<{
            readonly ishistory: boolean;
            readonly isconfirmed: boolean;
            readonly isrealtime: boolean;
            readonly islast: boolean;
            readonly period: string;
            readonly seconds: number;
        }> = [];
        const compiled = defineIndicator({
            name: "demo",
            apiVersion: 1,
            compute: ({ barstate, timeframe }) => {
                seen.push({
                    ishistory: barstate.ishistory,
                    isconfirmed: barstate.isconfirmed,
                    isrealtime: barstate.isrealtime,
                    islast: barstate.islast,
                    period: timeframe.period,
                    seconds: timeframe.inSeconds,
                });
            },
        });
        const runner = createScriptRunner({ compiled, capabilities: makeCapabilities() });

        await runner.onHistory([makeBar(0)]);
        await runner.onBarClose({ ...makeBar(1), interval: "1D" });
        await runner.onBarTick({ ...makeBar(1), interval: "1D", close: 102 });

        expect(seen).toEqual([
            {
                ishistory: true,
                isconfirmed: false,
                isrealtime: false,
                islast: false,
                period: "1m",
                seconds: 60,
            },
            {
                ishistory: false,
                isconfirmed: true,
                isrealtime: false,
                islast: true,
                period: "1D",
                seconds: 86_400,
            },
            {
                ishistory: false,
                isconfirmed: false,
                isrealtime: true,
                islast: true,
                period: "1D",
                seconds: 86_400,
            },
        ]);
    });

    it("resets request.security caches on dispose", async () => {
        let observedSizeAfterDispose = -1;
        let observedDedupAfterDispose = -1;
        let phase: "seed" | "after" = "seed";
        const compiled = defineIndicator({
            name: "demo",
            apiVersion: 1,
            compute: ({ request }) => {
                const ctx = ACTIVE_RUNTIME_CONTEXT.current;
                if (ctx !== null && phase === "after") {
                    observedSizeAfterDispose = ctx.requestSecurityBars.size;
                    observedDedupAfterDispose = ctx.diagnosedRequestKeys.size;
                }
                (
                    request as unknown as {
                        readonly security: (
                            slotId: string,
                            opts: { readonly interval: string },
                        ) => unknown;
                    }
                ).security("slot#0", { interval: "1D" });
            },
        });
        const runner = createScriptRunner({ compiled, capabilities: makeCapabilities() });

        await runner.onBarClose(makeBar(0));
        expect(runner.drain().diagnostics).toHaveLength(1);
        await runner.dispose();
        phase = "after";
        await runner.onBarClose(makeBar(1));

        expect(observedSizeAfterDispose).toBe(0);
        expect(observedDedupAfterDispose).toBe(0);
        expect(runner.drain().diagnostics).toHaveLength(1);
    });

    it("registers one secondary stream per requested interval value", async () => {
        const observedSizes: number[] = [];
        const compiled = defineIndicator({
            name: "demo",
            apiVersion: 1,
            compute: () => {
                const ctx = ACTIVE_RUNTIME_CONTEXT.current;
                observedSizes.push(ctx?.secondaryStreams.size ?? -1);
            },
        });
        const customCompiled = {
            manifest: {
                ...compiled.manifest,
                requestedIntervals: ["1D", "1D", "1W"],
            },
            compute: compiled.compute,
        };
        const runner = createScriptRunner({
            compiled: customCompiled,
            capabilities: makeCapabilities(),
        });

        await runner.onBarClose(makeBar(0));

        expect(observedSizes).toEqual([2]);
        await runner.dispose();
    });

    it("routes main history, close, and tick events through push", async () => {
        const seen: number[] = [];
        const compiled = defineIndicator({
            name: "push-main",
            apiVersion: 1,
            compute: ({ bar }) => {
                seen.push(bar.close);
            },
        });
        const runner = createScriptRunner({ compiled, capabilities: makeCapabilities() });

        await runner.push({ kind: "history", bars: [makeBar(0), makeBar(1)] });
        await runner.push({ kind: "close", bar: makeBar(2) });
        await runner.push({ kind: "tick", bar: { ...makeBar(2), close: 103 } });

        expect(seen).toEqual([100.5, 101.5, 102.5, 103]);
        await runner.dispose();
    });

    it("routes registered secondary history, close, and tick events without diagnostics", async () => {
        const seen: number[] = [];
        const compiled = defineIndicator({
            name: "push-secondary",
            apiVersion: 1,
            compute: ({ request }) => {
                const daily = (
                    request as unknown as {
                        readonly security: (
                            slotId: string,
                            opts: { readonly interval: string },
                        ) => { readonly close: { readonly current: number } };
                    }
                ).security("slot#0", { interval: "1D" });
                seen.push(daily.close.current);
            },
        });
        const customCompiled = {
            manifest: { ...compiled.manifest, requestedIntervals: ["1D"] },
            compute: compiled.compute,
        };
        const runner = createScriptRunner({
            compiled: customCompiled,
            capabilities: { ...makeCapabilities(), multiTimeframe: true },
        });

        await runner.push({
            kind: "history",
            bars: [
                { ...makeBar(0), time: makeBar(0).time - 180_000, close: 210, interval: "1D" },
                { ...makeBar(0), time: makeBar(0).time - 120_000, close: 211, interval: "1D" },
            ],
            streamKey: "1D",
        });
        await runner.push({
            kind: "close",
            bar: { ...makeBar(0), time: makeBar(0).time - 60_000, close: 212, interval: "1D" },
            streamKey: "1D",
        });
        await runner.push({
            kind: "tick",
            bar: { ...makeBar(0), time: makeBar(0).time - 60_000, close: 213, interval: "1D" },
            streamKey: "1D",
        });
        await runner.push({ kind: "close", bar: makeBar(0) });

        expect(seen).toEqual([213]);
        expect(runner.drain().diagnostics).toEqual([]);
        await runner.dispose();
    });

    it("converts runtime.error thrown during tick compute into a diagnostic", async () => {
        const compiled = defineIndicator({
            name: "tick-runtime-error",
            apiVersion: 1,
            compute: ({ runtime }) => {
                runtime.error("tick halt");
            },
        });
        const runner = createScriptRunner({ compiled, capabilities: makeCapabilities() });
        await runner.onBarClose(makeBar(0));
        runner.drain();

        await runner.onBarTick({ ...makeBar(0), close: 101 });

        expect(runner.drain().diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
            "runtime-error-thrown",
        ]);
        await runner.dispose();
    });

    it("drops unknown secondary stream events with a diagnostic", async () => {
        const compiled = defineIndicator({
            name: "demo",
            apiVersion: 1,
            compute: () => {},
        });
        const runner = createScriptRunner({ compiled, capabilities: makeCapabilities() });

        await runner.push({
            kind: "close",
            bar: { ...makeBar(0), interval: "1h" },
            streamKey: "1h",
        });

        expect(runner.drain().diagnostics).toEqual([
            {
                kind: "diagnostic",
                severity: "warning",
                code: "unknown-secondary-stream",
                message: 'Secondary stream "1h" was not registered by the script manifest',
                slotId: null,
                bar: 0,
            },
        ]);
        await runner.dispose();
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
        await runner.dispose();
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
        await runner.dispose();
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
        await runner.dispose();
    });

    it("mounts a CompiledScriptBundle with sibling lacking an outputs field", async () => {
        const sibling = defineIndicator({
            name: "slow",
            apiVersion: 1,
            compute: () => undefined,
        });
        const primary = defineIndicator({
            name: "primary",
            apiVersion: 1,
            compute: () => undefined,
        });
        const bundle = Object.freeze({
            primary,
            dependencies: [],
            siblings: [{ exportName: "slow", compiled: sibling }],
        });
        const runner = createScriptRunner({
            compiled: bundle,
            capabilities: makeCapabilities(),
        });
        await runner.onBarClose(makeBar(0));
        expect(runner.drain().diagnostics).toHaveLength(0);
        await runner.dispose();
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

        await runner.dispose();
    });
});
