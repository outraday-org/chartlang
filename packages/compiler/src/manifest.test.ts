// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { compile } from "./api.js";
import { buildManifest } from "./manifest.js";

describe("buildManifest", () => {
    it("returns a recursively-frozen manifest", () => {
        const manifest = buildManifest({
            name: "demo",
            kind: "indicator",
            capabilities: ["alerts", "indicators"],
            requestedIntervals: ["1D", "1H"],
            userPickableInterval: false,
            seriesCapacities: { dynamicFallback: 5000 },
            maxLookback: 30,
            inputs: { length: { kind: "int", defaultValue: 14 } },
        });
        expect(Object.isFrozen(manifest)).toBe(true);
        expect(Object.isFrozen(manifest.capabilities)).toBe(true);
        expect(Object.isFrozen(manifest.requestedIntervals)).toBe(true);
        expect(Object.isFrozen(manifest.seriesCapacities)).toBe(true);
        expect(Object.isFrozen(manifest.inputs)).toBe(true);
        expect(Object.isFrozen(manifest.inputs.length)).toBe(true);
    });

    it("carries through every field", () => {
        const manifest = buildManifest({
            name: "demo",
            kind: "alert",
            capabilities: ["alerts"],
            requestedIntervals: [],
            userPickableInterval: true,
            seriesCapacities: {},
            maxLookback: 0,
            inputs: {},
            maxBarsBack: 100,
            format: "percent",
            precision: 2,
            scale: "right",
            requiresIntervals: ["1D", "1W"],
            shortName: "DEMO",
        });
        expect(manifest.name).toBe("demo");
        expect(manifest.kind).toBe("alert");
        expect(manifest.capabilities).toEqual(["alerts"]);
        expect(manifest.userPickableInterval).toBe(true);
        expect(manifest.maxLookback).toBe(0);
        expect(manifest.apiVersion).toBe(1);
        expect(manifest.maxBarsBack).toBe(100);
        expect(manifest.format).toBe("percent");
        expect(manifest.precision).toBe(2);
        expect(manifest.scale).toBe("right");
        expect(manifest.requiresIntervals).toEqual(["1D", "1W"]);
        expect(Object.isFrozen(manifest.requiresIntervals)).toBe(true);
        expect(manifest.shortName).toBe("DEMO");
    });

    it("supports kind 'drawing' for defineDrawing scripts", () => {
        const manifest = buildManifest({
            name: "fib-tool",
            kind: "drawing",
            capabilities: ["drawings"],
            requestedIntervals: [],
            userPickableInterval: false,
            seriesCapacities: {},
            maxLookback: 0,
            inputs: {},
        });
        expect(manifest.kind).toBe("drawing");
        expect(manifest.capabilities).toEqual(["drawings"]);
    });

    it("freezes alert-condition descriptors", () => {
        const manifest = buildManifest({
            name: "conditions",
            kind: "alertCondition",
            capabilities: ["alertConditions"],
            requestedIntervals: [],
            userPickableInterval: false,
            seriesCapacities: {},
            maxLookback: 0,
            inputs: {},
            alertConditions: [
                {
                    id: "up",
                    title: "Up",
                    description: "Close > EMA",
                    defaultMessage: "{{ticker}} up",
                },
            ],
        });

        expect(manifest.kind).toBe("alertCondition");
        expect(manifest.alertConditions).toEqual([
            {
                id: "up",
                title: "Up",
                description: "Close > EMA",
                defaultMessage: "{{ticker}} up",
            },
        ]);
        expect(Object.isFrozen(manifest.alertConditions)).toBe(true);
        expect(Object.isFrozen(manifest.alertConditions?.[0])).toBe(true);
    });

    it("freezes the plots array and each entry; omits absent title", () => {
        const manifest = buildManifest({
            name: "p",
            kind: "indicator",
            capabilities: ["indicators"],
            requestedIntervals: [],
            userPickableInterval: false,
            seriesCapacities: {},
            maxLookback: 0,
            inputs: {},
            plots: [
                { slotId: "p.chart.ts:1:1#0", kind: "line" },
                { slotId: "p.chart.ts:2:1#0", kind: "histogram", title: "Vol" },
            ],
        });
        expect(manifest.plots).toEqual([
            { slotId: "p.chart.ts:1:1#0", kind: "line" },
            { slotId: "p.chart.ts:2:1#0", kind: "histogram", title: "Vol" },
        ]);
        expect(Object.isFrozen(manifest.plots)).toBe(true);
        expect(Object.isFrozen(manifest.plots?.[0])).toBe(true);
        expect(Object.isFrozen(manifest.plots?.[1])).toBe(true);
    });

    it("omits plots when the slot list is empty or absent", () => {
        const empty = buildManifest({
            name: "p",
            kind: "indicator",
            capabilities: ["indicators"],
            requestedIntervals: [],
            userPickableInterval: false,
            seriesCapacities: {},
            maxLookback: 0,
            inputs: {},
            plots: [],
        });
        const absent = buildManifest({
            name: "p",
            kind: "indicator",
            capabilities: ["indicators"],
            requestedIntervals: [],
            userPickableInterval: false,
            seriesCapacities: {},
            maxLookback: 0,
            inputs: {},
        });
        expect(empty.plots).toBeUndefined();
        expect(absent.plots).toBeUndefined();
        expect("plots" in empty).toBe(false);
        expect("plots" in absent).toBe(false);
    });
});

const PLOTS_SOURCE = `
import { defineIndicator, plot, hline } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "Plots",
    apiVersion: 1,
    compute: ({ bar }) => {
        plot(bar.close);
        plot(bar.volume, { title: "Vol", style: { kind: "histogram" } });
        hline(70);
    },
});
`;

const NO_PLOTS_SOURCE = `
import { defineIndicator, ta } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "NoPlots",
    apiVersion: 1,
    compute: ({ bar }) => { void ta.ema(bar.close, 14); },
});
`;

const DYNAMIC_STYLE_SOURCE = `
import { defineIndicator, plot } from "@invinite-org/chartlang-core";
import type { PlotOptsStyle } from "@invinite-org/chartlang-core";
declare const dynamicStyle: PlotOptsStyle;
export default defineIndicator({
    name: "Dyn",
    apiVersion: 1,
    compute: ({ bar }) => { plot(bar.close, { style: dynamicStyle }); },
});
`;

describe("manifest.plots (compiled)", () => {
    it("lists one entry per plot/hline callsite in source order with kind + literal title", async () => {
        const { manifest, moduleSource } = await compile(PLOTS_SOURCE, {
            apiVersion: 1,
            sourcePath: "plots.chart.ts",
        });
        expect(manifest.plots).toHaveLength(3);
        expect(manifest.plots?.[0].kind).toBe("line");
        expect(manifest.plots?.[0].title).toBeUndefined();
        expect(manifest.plots?.[1].kind).toBe("histogram");
        expect(manifest.plots?.[1].title).toBe("Vol");
        expect(manifest.plots?.[2].kind).toBe("horizontal-line");
        expect(manifest.plots?.[2].title).toBeUndefined();

        // The slotIds equal the literals the runtime echoes as
        // PlotEmission.slotId — they are injected verbatim into the bundle.
        for (const slot of manifest.plots ?? []) {
            expect(slot.slotId).toMatch(/^plots\.chart\.ts:\d+:\d+#0$/);
            expect(moduleSource).toContain(JSON.stringify(slot.slotId));
        }
        // Source order: ascending by line number.
        const lines = (manifest.plots ?? []).map((s) => Number(s.slotId.split(":")[1]));
        expect(lines).toEqual([...lines].sort((a, b) => a - b));
    });

    it("freezes the compiled plots array and each entry", async () => {
        const { manifest } = await compile(PLOTS_SOURCE, {
            apiVersion: 1,
            sourcePath: "plots.chart.ts",
        });
        expect(Object.isFrozen(manifest.plots)).toBe(true);
        for (const slot of manifest.plots ?? []) expect(Object.isFrozen(slot)).toBe(true);
    });

    it("omits plots entirely for a script with no plot/hline calls", async () => {
        const { manifest } = await compile(NO_PLOTS_SOURCE, {
            apiVersion: 1,
            sourcePath: "noplots.chart.ts",
        });
        expect(manifest.plots).toBeUndefined();
        expect("plots" in manifest).toBe(false);
    });

    it("records a best-effort line kind for a dynamic-style callsite", async () => {
        const { manifest } = await compile(DYNAMIC_STYLE_SOURCE, {
            apiVersion: 1,
            sourcePath: "dyn.chart.ts",
        });
        expect(manifest.plots).toHaveLength(1);
        expect(manifest.plots?.[0].kind).toBe("line");
        expect(manifest.plots?.[0].title).toBeUndefined();
    });

    it("survives a JSON round-trip unchanged", async () => {
        const { manifest } = await compile(PLOTS_SOURCE, {
            apiVersion: 1,
            sourcePath: "plots.chart.ts",
        });
        const roundTripped = JSON.parse(JSON.stringify(manifest.plots));
        expect(roundTripped).toEqual(manifest.plots);
    });

    it("orders plots by source position for any shuffle of the callsites", async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.shuffledSubarray(["a", "b", "c", "d"], { minLength: 4, maxLength: 4 }),
                async (order) => {
                    /* per-run compile is esbuild-bound (~1s); keep numRuns low */
                    const callByLabel: Record<string, string> = {
                        a: "plot(bar.close);",
                        b: 'plot(bar.open, { title: "O" });',
                        c: "hline(50);",
                        d: 'plot(bar.high, { style: { kind: "step-line" } });',
                    };
                    const body = order.map((label) => callByLabel[label]).join("\n        ");
                    const source = `
import { defineIndicator, plot, hline } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "Shuffle",
    apiVersion: 1,
    compute: ({ bar }) => {
        ${body}
    },
});
`;
                    const { manifest } = await compile(source, {
                        apiVersion: 1,
                        sourcePath: "shuffle.chart.ts",
                    });
                    expect(manifest.plots).toHaveLength(4);
                    const lines = (manifest.plots ?? []).map((s) => Number(s.slotId.split(":")[1]));
                    expect(lines).toEqual([...lines].sort((x, y) => x - y));
                },
            ),
            { numRuns: 6 },
        );
    }, 30000);
});
