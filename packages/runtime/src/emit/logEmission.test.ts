// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities, type Capabilities } from "@invinite-org/chartlang-adapter-kit";
import { defineIndicator } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { createScriptRunner } from "../createScriptRunner.js";

function caps(logs: boolean): Capabilities {
    return {
        plots: capabilities.allLines(),
        drawings: new Set(),
        alerts: new Set(),
        alertConditions: false,
        logs,
        inputs: new Set(),
        intervals: [],
        multiTimeframe: false,
        subPanes: 0,
        symInfoFields: new Set(),
        maxDrawingsPerScript: { lines: 0, labels: 0, boxes: 0, polylines: 0, other: 0 },
        maxLookback: 5000,
        maxTickHz: 10,
    };
}

function bar(time: number, close = 10) {
    return {
        time,
        open: close - 1,
        high: close + 1,
        low: close - 2,
        close,
        volume: 100,
        symbol: "DEMO",
        interval: "1D",
        hl2: close - 0.5,
        hlc3: close,
        ohlc4: close - 0.25,
        hlcc4: close,
    };
}

describe("runtime.log.*", () => {
    it("emits log payloads when capabilities.logs is true", async () => {
        const compiled = defineIndicator({
            name: "logs",
            apiVersion: 1,
            compute: ({ bar, runtime }) => {
                runtime.log.info("close", { close: bar.close });
            },
        });
        const runner = createScriptRunner({ compiled, capabilities: caps(true) });
        await runner.onBarClose(bar(1, 12));
        const out = runner.drain();
        expect(out.logs).toEqual([
            {
                kind: "log",
                level: "info",
                message: "close",
                meta: { close: 12 },
                bar: 0,
                time: 1,
            },
        ]);
        expect(out.diagnostics).toEqual([]);
    });

    it("silently no-ops when capabilities.logs is false", async () => {
        const compiled = defineIndicator({
            name: "logs-off",
            apiVersion: 1,
            compute: ({ runtime }) => runtime.log.warn("hidden"),
        });
        const runner = createScriptRunner({ compiled, capabilities: caps(false) });
        await runner.onBarClose(bar(1));
        const out = runner.drain();
        expect(out.logs).toEqual([]);
        expect(out.diagnostics).toEqual([]);
    });

    it("caps logs at 1000 and diagnoses once per step", async () => {
        const compiled = defineIndicator({
            name: "budget",
            apiVersion: 1,
            compute: ({ runtime }) => {
                Array.from({ length: 1100 }, (_, i) => runtime.log.info("x", { i }));
            },
        });
        const runner = createScriptRunner({ compiled, capabilities: caps(true) });
        await runner.onBarClose(bar(1));
        const out = runner.drain();
        expect(out.logs).toHaveLength(1000);
        expect(out.diagnostics.map((d) => d.code)).toEqual(["runtime-log-budget-exceeded"]);
    });

    it("drops non-JSON meta with a malformed-log-meta diagnostic", async () => {
        const compiled = defineIndicator({
            name: "bad-meta",
            apiVersion: 1,
            compute: ({ runtime }) => {
                runtime.log.error("bad", { nope: Number.POSITIVE_INFINITY });
            },
        });
        const runner = createScriptRunner({ compiled, capabilities: caps(true) });
        await runner.onBarClose(bar(1));
        const out = runner.drain();
        expect(out.logs).toEqual([]);
        expect(out.diagnostics.map((d) => d.code)).toEqual(["malformed-log-meta"]);
    });

    it("drops meta with throwing getters", async () => {
        const meta = {};
        Object.defineProperty(meta, "bad", {
            enumerable: true,
            get() {
                throw new Error("boom");
            },
        });
        const compiled = defineIndicator({
            name: "throwing-meta",
            apiVersion: 1,
            compute: ({ runtime }) => {
                runtime.log.info("bad", meta);
            },
        });
        const runner = createScriptRunner({ compiled, capabilities: caps(true) });
        await runner.onBarClose(bar(1));
        const out = runner.drain();
        expect(out.logs).toEqual([]);
        expect(out.diagnostics.map((d) => d.code)).toEqual(["malformed-log-meta"]);
    });

    it("snapshots nested JSON arrays and objects", async () => {
        const nullProto = Object.create(null) as { ok: boolean };
        nullProto.ok = true;
        const meta = { nested: [{ ok: true }, nullProto, null, "x"] };
        const compiled = defineIndicator({
            name: "nested-meta",
            apiVersion: 1,
            compute: ({ runtime }) => {
                runtime.log.warn("nested", meta);
            },
        });
        const runner = createScriptRunner({ compiled, capabilities: caps(true) });
        await runner.onBarClose(bar(1));
        const logged = runner.drain().logs[0];
        expect(logged.meta).toEqual(meta);
        expect(Object.isFrozen(logged.meta)).toBe(true);
        expect(Object.isFrozen((logged.meta as typeof meta).nested)).toBe(true);
    });

    it("drops non-plain object meta", async () => {
        const compiled = defineIndicator({
            name: "date-meta",
            apiVersion: 1,
            compute: ({ runtime }) => {
                runtime.log.info("bad", { at: new Date(0) } as never);
            },
        });
        const runner = createScriptRunner({ compiled, capabilities: caps(true) });
        await runner.onBarClose(bar(1));
        expect(runner.drain().diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
            "malformed-log-meta",
        ]);
    });

    it("runtime.error drops partial emissions and next bars continue", async () => {
        let shouldThrow = true;
        const compiled = defineIndicator({
            name: "runtime-error",
            apiVersion: 1,
            compute: ({ bar, plot, runtime }) => {
                plot("runtime-error.test.ts:1:1#0", bar.close);
                runtime.log.info("before");
                if (shouldThrow) {
                    shouldThrow = false;
                    runtime.error("invariant");
                }
            },
        });
        const runner = createScriptRunner({ compiled, capabilities: caps(true) });
        await runner.onBarClose(bar(1, 10));
        const halted = runner.drain();
        expect(halted.plots).toEqual([]);
        expect(halted.logs).toEqual([]);
        expect(halted.diagnostics.map((d) => d.code)).toEqual(["runtime-error-thrown"]);

        await runner.onBarClose(bar(2, 11));
        const resumed = runner.drain();
        expect(resumed.plots).toHaveLength(1);
        expect(resumed.logs).toHaveLength(1);
        expect(resumed.diagnostics).toEqual([]);
    });
});
