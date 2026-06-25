// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { PlotEmission, RunnerEmissions } from "@invinite-org/chartlang-adapter-kit";
import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import type { AxisRenderInfo } from "./axes.js";
import { applyEmissions } from "./ingest.js";
import { resolveHorizontalHistogram, resolveOverridePaint } from "./overrides.js";
import { type AdapterState, createAdapterState } from "./state.js";

// A bar whose direction the candle-override resolver keys on. `close > open` is
// bullish, `close < open` bearish, `close === open` a doji.
function bar(time: number, open: number, close: number): Bar {
    return {
        time,
        open,
        high: Math.max(open, close) + 1,
        low: Math.min(open, close) - 1,
        close,
        volume: 10,
    } as Bar;
}

function plot(overrides: Partial<PlotEmission> & { slotId: string }): PlotEmission {
    return {
        kind: "plot",
        slotId: overrides.slotId,
        title: "",
        style: overrides.style ?? { kind: "line", lineWidth: 1, lineStyle: "solid" },
        bar: overrides.bar ?? 0,
        time: overrides.time ?? 1000,
        value: "value" in overrides ? (overrides.value as number | null) : null,
        color: overrides.color ?? null,
        meta: {},
        pane: overrides.pane ?? "overlay",
        ...("colorValue" in overrides ? { colorValue: overrides.colorValue } : {}),
    };
}

function ingest(state: AdapterState, plots: PlotEmission[]): void {
    const emissions: RunnerEmissions = {
        plots,
        drawings: [],
        alerts: [],
        alertConditions: [],
        logs: [],
        diagnostics: [],
        fromBar: 0,
        toBar: 0,
    };
    applyEmissions(state, emissions);
}

// The overlay-pane projection the resolvers anchor against. Window matches the
// bar times / prices used below so projection stays in-range.
const info: AxisRenderInfo = {
    paneKey: "overlay",
    cssRect: { x: 0, y: 0, width: 800, height: 400 },
    window: { xMin: 0, xMax: 100, yMin: 0, yMax: 200 },
    ticks: { priceTicks: [], timeTicks: [] },
};

describe("resolveOverridePaint — bg-color", () => {
    it("resolves a translucent full-height band with alpha = 1 - transp/100", () => {
        const state = createAdapterState();
        ingest(state, [
            plot({
                slotId: "bg",
                time: 50,
                style: { kind: "bg-color", color: "#1d4ed8", transp: 80 },
            }),
        ]);
        const { backgrounds } = resolveOverridePaint(state, info);
        expect(backgrounds).toHaveLength(1);
        expect(backgrounds[0].color).toBe("#1d4ed8");
        expect(backgrounds[0].alpha).toBeCloseTo(0.2, 6);
        expect(backgrounds[0].height).toBe(400);
    });

    it("prefers the per-bar colorValue over the static style.color", () => {
        const state = createAdapterState();
        ingest(state, [
            plot({
                slotId: "bg",
                time: 50,
                colorValue: "#abcdef",
                style: { kind: "bg-color", color: "#1d4ed8" },
            }),
        ]);
        const { backgrounds } = resolveOverridePaint(state, info);
        expect(backgrounds[0].color).toBe("#abcdef");
    });

    it("paints nothing for an explicit colorValue:null gap", () => {
        const state = createAdapterState();
        ingest(state, [
            plot({
                slotId: "bg",
                time: 50,
                colorValue: null,
                style: { kind: "bg-color", color: "#1d4ed8" },
            }),
        ]);
        expect(resolveOverridePaint(state, info).backgrounds).toHaveLength(0);
    });
});

describe("resolveOverridePaint — candle-override (bull/bear/doji by direction)", () => {
    function colorFor(open: number, close: number): string {
        const state = createAdapterState();
        state.bars.push(bar(50, open, close));
        ingest(state, [
            plot({
                slotId: "co",
                time: 50,
                style: { kind: "candle-override", bull: "#0f0", bear: "#f00", doji: "#888" },
            }),
        ]);
        const { bars } = resolveOverridePaint(state, info);
        expect(bars).toHaveLength(1);
        const item = bars[0];
        expect(item.kind).toBe("candle");
        return item.color;
    }

    it("uses bull when close > open", () => {
        expect(colorFor(100, 120)).toBe("#0f0");
    });

    it("uses bear when close < open", () => {
        expect(colorFor(120, 100)).toBe("#f00");
    });

    it("uses doji when close === open", () => {
        expect(colorFor(100, 100)).toBe("#888");
    });

    it("falls back to bull when a doji has no doji color", () => {
        const state = createAdapterState();
        state.bars.push(bar(50, 100, 100));
        ingest(state, [
            plot({
                slotId: "co",
                time: 50,
                style: { kind: "candle-override", bull: "#0f0", bear: "#f00" },
            }),
        ]);
        expect(resolveOverridePaint(state, info).bars[0].color).toBe("#0f0");
    });

    it("skips a candle-override whose bar is not in state.bars", () => {
        const state = createAdapterState();
        ingest(state, [
            plot({
                slotId: "co",
                time: 999,
                style: { kind: "candle-override", bull: "#0f0", bear: "#f00" },
            }),
        ]);
        expect(resolveOverridePaint(state, info).bars).toHaveLength(0);
    });
});

describe("resolveOverridePaint — bar-override / bar-color", () => {
    it("emits a stroked OHLC bar outline for bar-override", () => {
        const state = createAdapterState();
        state.bars.push(bar(50, 100, 120));
        ingest(state, [
            plot({ slotId: "bo", time: 50, style: { kind: "bar-override", color: "#f59e0b" } }),
        ]);
        const { bars } = resolveOverridePaint(state, info);
        expect(bars).toHaveLength(1);
        expect(bars[0].kind).toBe("bar");
        expect(bars[0].color).toBe("#f59e0b");
    });

    it("prefers colorValue over style.color for bar-color and skips a null gap", () => {
        const state = createAdapterState();
        state.bars.push(bar(50, 100, 120), bar(60, 100, 120));
        ingest(state, [
            plot({
                slotId: "bc",
                time: 50,
                colorValue: "#abc123",
                style: { kind: "bar-color", color: "#a855f7" },
            }),
            plot({
                slotId: "bc",
                time: 60,
                colorValue: null,
                style: { kind: "bar-color", color: "#a855f7" },
            }),
        ]);
        const { bars } = resolveOverridePaint(state, info);
        // Two slots keyed by `${slotId}@${time}` accumulate; the null gap is dropped.
        expect(bars).toHaveLength(1);
        expect(bars[0].color).toBe("#abc123");
    });
});

describe("resolveHorizontalHistogram", () => {
    it("scales each bucket width by volume / maxVolume and anchors at the right edge", () => {
        const state = createAdapterState();
        ingest(state, [
            plot({
                slotId: "vp",
                time: 50,
                style: {
                    kind: "horizontal-histogram",
                    buckets: [
                        { price: 100, volume: 100 },
                        { price: 150, volume: 50 },
                    ],
                },
            }),
        ]);
        const rows = resolveHorizontalHistogram(state, info);
        expect(rows).toHaveLength(2);
        const full = rows.find((r) => r.width === 96);
        const half = rows.find((r) => r.width === 48);
        expect(full).toBeDefined();
        expect(half).toBeDefined();
        // The full-width row grows leftward from the plot's right edge (800).
        expect(full?.x).toBe(800 - 96);
        expect(full?.height).toBe(6);
    });

    it("falls back to the palette plotDefault when a bucket has no color", () => {
        const state = createAdapterState();
        ingest(state, [
            plot({
                slotId: "vp",
                time: 50,
                style: { kind: "horizontal-histogram", buckets: [{ price: 100, volume: 10 }] },
            }),
        ]);
        const rows = resolveHorizontalHistogram(state, info);
        expect(rows[0].color).toBe(state.palette.plotDefault);
    });

    it("returns nothing when no bucket carries positive volume", () => {
        const state = createAdapterState();
        ingest(state, [
            plot({
                slotId: "vp",
                time: 50,
                style: { kind: "horizontal-histogram", buckets: [{ price: 100, volume: 0 }] },
            }),
        ]);
        expect(resolveHorizontalHistogram(state, info)).toHaveLength(0);
    });
});
