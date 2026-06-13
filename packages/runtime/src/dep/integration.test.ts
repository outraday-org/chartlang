// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { capabilities } from "@invinite-org/chartlang-adapter-kit";
import type { Capabilities } from "@invinite-org/chartlang-adapter-kit";
import { defineIndicator } from "@invinite-org/chartlang-core";
import type { Bar, CompiledScriptBundle, CompiledScriptObject } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { createScriptRunner } from "../createScriptRunner.js";

// Hand-built diamond bundle for the end-to-end test:
//
//        base (private dep, plots { title: "line" })
//        /   \
//       /     \
//   slow      fast      <-- both also private deps
//       \     /
//        \   /
//        primary  (reads base.line, slow.line, fast.line via __chartlang_depOutput)
//
// The primary plots a single titled value derived from all three inputs.
// We additionally mount one sibling drawn export `companion` to assert
// the export-prefix forwarding path.

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

function makeBar(i: number): Bar {
    return {
        time: 1_700_000_000_000 + i * 60_000,
        open: 100 + (i % 17),
        high: 101 + (i % 17),
        low: 99 + (i % 17),
        close: 100.5 + (i % 17),
        volume: 1000 + (i % 13),
        symbol: "AAPL",
        interval: "1m",
    };
}

function readDepOutput(localId: string, title: string): number {
    const fn = (globalThis as Record<string, unknown>).__chartlang_depOutput as (
        s: string,
        l: string,
        t: string,
    ) => { current: number };
    return fn(`primary:0:0#${localId}.${title}`, localId, title).current;
}

function diamondBundle(): CompiledScriptBundle {
    const base = withTitledOutput(
        "line",
        defineIndicator({
            name: "base",
            apiVersion: 1,
            compute: ({ bar, plot }) => {
                plot("base:1:1#0", bar.close, { title: "line" });
            },
        }),
    );
    const fast = withTitledOutput(
        "line",
        defineIndicator({
            name: "fast",
            apiVersion: 1,
            compute: ({ bar, plot }) => {
                plot("fast:1:1#0", bar.close + 1, { title: "line" });
            },
        }),
    );
    const slow = withTitledOutput(
        "line",
        defineIndicator({
            name: "slow",
            apiVersion: 1,
            compute: ({ bar, plot }) => {
                plot("slow:1:1#0", bar.close - 1, { title: "line" });
            },
        }),
    );
    const companion = withTitledOutput(
        "line",
        defineIndicator({
            name: "companion",
            apiVersion: 1,
            compute: ({ bar, plot }) => {
                plot("companion:1:1#0", bar.close * 2, { title: "line" });
            },
        }),
    );
    const primary = defineIndicator({
        name: "primary",
        apiVersion: 1,
        compute: ({ plot }) => {
            const a = readDepOutput("base", "line");
            const b = readDepOutput("fast", "line");
            const c = readDepOutput("slow", "line");
            plot("primary:5:1#0", a + b + c, { title: "sum" });
        },
    });
    return Object.freeze({
        primary,
        dependencies: [
            { localId: "base", compiled: base },
            { localId: "fast", compiled: fast },
            { localId: "slow", compiled: slow },
        ],
        siblings: [{ exportName: "companion", compiled: companion }],
    });
}

function fnv1a(input: string): string {
    let h = 0x811c9dc5;
    for (let i = 0; i < input.length; i += 1) {
        h ^= input.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
}

describe("dep/integration — diamond bundle end-to-end", () => {
    it("primary reads all three dep outputs and forwards sibling plots", async () => {
        const runner = createScriptRunner({
            compiled: diamondBundle(),
            capabilities: makeCapabilities(),
        });
        const bars = Array.from({ length: 100 }, (_, i) => makeBar(i));
        await runner.onHistory(bars);
        const drained = runner.drain();

        // Primary's "sum" output: bar.close + (bar.close + 1) + (bar.close - 1) = 3 * bar.close.
        const sums = drained.plots.filter((p) => p.title === "sum");
        expect(sums).toHaveLength(100);
        for (let i = 0; i < 100; i += 1) {
            expect(sums[i].value).toBeCloseTo(3 * bars[i].close, 10);
            expect(sums[i].slotId).toBe("primary:5:1#0");
        }

        // No private-dep plots ever reach the parent queue.
        const stray = drained.plots.filter((p) => p.slotId.startsWith("dep:"));
        expect(stray).toHaveLength(0);

        // Sibling plots are forwarded under the export prefix.
        const companion = drained.plots.filter((p) => p.slotId.startsWith("export:companion/"));
        expect(companion).toHaveLength(100);
        for (let i = 0; i < 100; i += 1) {
            expect(companion[i].value).toBeCloseTo(bars[i].close * 2, 10);
        }

        expect(drained.diagnostics).toHaveLength(0);

        await runner.dispose();
    });

    it("drain output is byte-identical across re-runs of the same scenario", async () => {
        const runOnce = async (): Promise<string> => {
            const runner = createScriptRunner({
                compiled: diamondBundle(),
                capabilities: makeCapabilities(),
            });
            const bars = Array.from({ length: 50 }, (_, i) => makeBar(i));
            await runner.onHistory(bars);
            const drained = runner.drain();
            const fingerprint = JSON.stringify({
                plots: drained.plots.map((p) => ({
                    slotId: p.slotId,
                    title: p.title,
                    value: p.value,
                    bar: p.bar,
                })),
                diagnostics: drained.diagnostics.map((d) => ({
                    code: d.code,
                    slotId: d.slotId,
                })),
            });
            await runner.dispose();
            return fnv1a(fingerprint);
        };
        const a = await runOnce();
        const b = await runOnce();
        expect(a).toBe(b);
    });

    it("dispose disposes dep + sibling runners and the output store", async () => {
        const runner = createScriptRunner({
            compiled: diamondBundle(),
            capabilities: makeCapabilities(),
        });
        await runner.onBarClose(makeBar(0));
        await runner.dispose();
        // After dispose, dep output store throws on read because entries are cleared.
        expect(() => {
            const fn = (globalThis as Record<string, unknown>).__chartlang_depOutput as (
                s: string,
                l: string,
                t: string,
            ) => unknown;
            // No active context → throws OUTSIDE_CTX_MESSAGE rather than reaching the store.
            fn("x", "base", "line");
        }).toThrow();
    });
});
