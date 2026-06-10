// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { PlotEmission } from "@invinite-org/chartlang-adapter-kit";
import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import {
    harness,
    harnessWithCtx,
    tick,
    withPrefilledContext,
} from "./__fixtures__/runPrimitive.js";
import { visibleRangeVolumeProfile } from "./visibleRangeVolumeProfile.js";

function bars(prices: ReadonlyArray<number>, volumes: ReadonlyArray<number>): Bar[] {
    const t0 = 1_700_000_000_000;
    return prices.map((price, index) => ({
        close: price,
        high: price,
        interval: "1m",
        low: price,
        open: price,
        symbol: "T",
        time: t0 + index * 60_000,
        volume: volumes[index],
    }));
}

function rangedBars(prices: ReadonlyArray<number>, volumes: ReadonlyArray<number>): Bar[] {
    const t0 = 1_700_000_000_000;
    return prices.map((price, index) => ({
        close: price,
        high: price + 0.5,
        interval: "1m",
        low: price - 0.5,
        open: price,
        symbol: "T",
        time: t0 + index * 60_000,
        volume: volumes[index],
    }));
}

function lastPlot(plots: ReadonlyArray<PlotEmission>): PlotEmission {
    const plot = plots[plots.length - 1];
    if (plot === undefined) throw new Error("missing plot emission");
    return plot;
}

describe("ta.visibleRangeVolumeProfile", () => {
    it("single-bar input puts all positive volume in one bucket", () => {
        const input = bars([100], [250]);
        const out = harness(input, 10, (_bar, ctx) => {
            const result = visibleRangeVolumeProfile("slot", { bucketColor: "#90caf9" });
            const plot = lastPlot(ctx.emissions.plots);
            return { poc: result.poc.current, plot };
        });
        expect(out[0].poc).toBe(100);
        expect(out[0].plot.style).toEqual({
            kind: "horizontal-histogram",
            buckets: [{ price: 100, volume: 250, color: "#90caf9" }],
        });
    });

    it("constant-price input collapses to one bucket at that price", () => {
        const input = bars([42, 42, 42], [10, 20, 30]);
        const out = harness(input, 10, () => visibleRangeVolumeProfile("slot").poc.current);
        expect(out[2]).toBe(42);
    });

    it("skips non-finite closes while building a degenerate profile", () => {
        const input = bars([42, Number.NaN, 42], [10, 20, 30]);
        const out = harness(input, 10, () => visibleRangeVolumeProfile("slot").poc.current);
        expect(out[2]).toBe(42);
    });

    it("zero-volume bars emit empty buckets and NaN POC", () => {
        const input = rangedBars([100, 101, 102], [0, 0, 0]);
        const out = harness(input, 10, (_bar, ctx) => {
            const result = visibleRangeVolumeProfile("slot");
            const plot = lastPlot(ctx.emissions.plots);
            return {
                buckets: plot.style.kind === "horizontal-histogram" ? plot.style.buckets : [],
                poc: result.poc.current,
            };
        });
        expect(out[2].buckets).toEqual([]);
        expect(Number.isNaN(out[2].poc)).toBe(true);
    });

    it("empty streams emit empty buckets and NaN POC", () => {
        const result = withPrefilledContext([], 4, (_ctx) => visibleRangeVolumeProfile("slot"));

        expect(result.poc.current).toBeNaN();
    });

    it("rowSize: 0 falls back to automatic row sizing", () => {
        const input = rangedBars([100, 101, 102, 103], [10, 20, 30, 40]);
        const out = harness(input, 10, (_bar, ctx) => {
            visibleRangeVolumeProfile("slot", { rowSize: 0 });
            const plot = lastPlot(ctx.emissions.plots);
            return plot.style.kind === "horizontal-histogram" ? plot.style.buckets.length : 0;
        });
        expect(out[3]).toBeGreaterThan(0);
    });

    it("applies bucket color and accepts value-area percentage inputs above one", () => {
        const input = rangedBars([100, 101, 102, 103], [10, 20, 30, 40]);
        const out = harness(input, 10, (_bar, ctx) => {
            visibleRangeVolumeProfile("slot", {
                bucketColor: "#90caf9",
                valueAreaPct: 70,
            });
            const plot = lastPlot(ctx.emissions.plots);
            return plot.style.kind === "horizontal-histogram"
                ? plot.style.buckets[0]?.color
                : undefined;
        });
        expect(out[3]).toBe("#90caf9");
    });

    it("diagnoses when horizontal histogram plots are not supported", () => {
        const input = rangedBars([100, 101, 102], [10, 20, 30]);
        const out = harness(input, 10, (_bar, ctx) => {
            ctx.capabilities.plots.delete("horizontal-histogram");
            visibleRangeVolumeProfile("slot");
            return ctx.emissions.diagnostics.filter(
                (diagnostic) => diagnostic.code === "unsupported-plot-kind",
            ).length;
        });
        // Deduped per slot: one diagnostic across the run, not one per bar.
        expect(out[out.length - 1]).toBe(1);
    });

    it("returns the same result identity and honors offset views", () => {
        const input = rangedBars([100, 101, 102, 103], [10, 20, 30, 40]);
        const refs = new Set<unknown>();
        let unshiftedBuckets = 0;
        const unshifted = harness(input, 10, () => {
            const result = visibleRangeVolumeProfile("slot");
            refs.add(result);
            unshiftedBuckets = result.buckets.length;
            return result.poc.current;
        });
        let shiftedBuckets = 0;
        const shifted = harness(input, 10, () => {
            const result = visibleRangeVolumeProfile("slot", { offset: 1 });
            shiftedBuckets = result.buckets.length;
            return result.poc.current;
        });
        expect(refs.size).toBe(1);
        expect(shifted[3]).toBe(unshifted[2]);
        expect(unshiftedBuckets).toBeGreaterThan(0);
        // Shifted result exposes the same live bucket set as the unshifted view.
        expect(shiftedBuckets).toBe(unshiftedBuckets);
    });

    it("throws outside an active script step", () => {
        expect(() => visibleRangeVolumeProfile("oops")).toThrowError(
            /ta.visibleRangeVolumeProfile called outside an active script step/,
        );
    });
});

describe("ta.visibleRangeVolumeProfile tick-mode", () => {
    it("replaces the head without advancing the output buffers", () => {
        const input = rangedBars([100, 101, 102], [10, 20, 30]);
        const { ctxRef } = harnessWithCtx(input, 10, () => visibleRangeVolumeProfile("slot"));
        const tickBar = { ...input[2], close: 110, high: 110.5, low: 109.5, volume: 50 };
        const tickResult = tick(ctxRef, tickBar, () => {
            const result = visibleRangeVolumeProfile("slot");
            return { head: result.poc.current, length: result.poc.length };
        });
        expect(tickResult.length).toBe(input.length);
        expect(Number.isFinite(tickResult.head)).toBe(true);
    });
});
