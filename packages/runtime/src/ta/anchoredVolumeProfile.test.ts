// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { PlotEmission } from "@invinite-org/chartlang-adapter-kit";
import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive";
import { anchoredVolumeProfile } from "./anchoredVolumeProfile";
import { visibleRangeVolumeProfile } from "./visibleRangeVolumeProfile";

function bars(count: number): Bar[] {
    const out: Bar[] = [];
    const t0 = 1_700_000_000_000;
    for (let i = 0; i < count; i += 1) {
        const close = 100 + i * 0.25;
        out.push({
            close,
            high: close + 0.5,
            interval: "1m",
            low: close - 0.5,
            open: close - 0.1,
            symbol: "T",
            time: t0 + i * 60_000,
            volume: 1_000 + i * 10,
        });
    }
    return out;
}

function constantBars(count: number): Bar[] {
    return bars(count).map((bar) => ({
        ...bar,
        close: 42,
        high: 42,
        low: 42,
        open: 42,
    }));
}

function lastPlot(plots: ReadonlyArray<PlotEmission>): PlotEmission {
    const plot = plots[plots.length - 1];
    if (plot === undefined) throw new Error("missing plot emission");
    return plot;
}

describe("ta.anchoredVolumeProfile", () => {
    it("anchor at first bar matches visible-range profile at the final bar", () => {
        const input = bars(100);
        const anchor = input[0].time;
        const anchored = harness(
            input,
            128,
            () => anchoredVolumeProfile("slot", { anchor, rowSize: 24 }).poc.current,
        );
        const visible = harness(
            input,
            128,
            () => visibleRangeVolumeProfile("slot", { rowSize: 24 }).poc.current,
        );
        expect(anchored[99]).toBeCloseTo(visible[99], 10);
    });

    it("keeps bars before and at the anchor empty, then emits after the anchor", () => {
        const input = bars(100);
        const anchor = input[50].time;
        const out = harness(input, 128, (_bar, ctx) => {
            const result = anchoredVolumeProfile("slot", { anchor, rowSize: 24 });
            const plot = lastPlot(ctx.emissions.plots);
            return {
                bucketCount:
                    plot.style.kind === "horizontal-histogram" ? plot.style.buckets.length : 0,
                poc: result.poc.current,
            };
        });
        for (let i = 0; i <= 50; i += 1) {
            expect(Number.isNaN(out[i].poc)).toBe(true);
            expect(out[i].bucketCount).toBe(0);
        }
        for (let i = 51; i < out.length; i += 1) {
            expect(Number.isFinite(out[i].poc)).toBe(true);
        }
    });

    it("future anchor produces all NaN values", () => {
        const input = bars(8);
        const anchor = input[input.length - 1].time + 60_000;
        const out = harness(input, 16, () => anchoredVolumeProfile("slot", { anchor }).poc.current);
        expect(out.every((value) => Number.isNaN(value))).toBe(true);
    });

    it("anchor at exactly the current bar emits empty buckets", () => {
        const input = bars(1);
        const out = harness(input, 4, (_bar, ctx) => {
            const result = anchoredVolumeProfile("slot", { anchor: input[0].time });
            const plot = lastPlot(ctx.emissions.plots);
            return {
                bucketCount:
                    plot.style.kind === "horizontal-histogram" ? plot.style.buckets.length : 0,
                poc: result.poc.current,
            };
        });
        expect(out[0].bucketCount).toBe(0);
        expect(Number.isNaN(out[0].poc)).toBe(true);
    });

    it("rowSize: 0 falls back to automatic row sizing", () => {
        const input = bars(6);
        const out = harness(input, 10, (_bar, ctx) => {
            const result = anchoredVolumeProfile("slot", { anchor: input[0].time, rowSize: 0 });
            const plot = lastPlot(ctx.emissions.plots);
            return {
                buckets: result.buckets.length,
                plotBuckets:
                    plot.style.kind === "horizontal-histogram" ? plot.style.buckets.length : 0,
            };
        });
        expect(out[5].buckets).toBeGreaterThan(0);
        expect(out[5].plotBuckets).toBe(out[5].buckets);
    });

    it("constant-price input collapses to one bucket after the anchor", () => {
        const input = constantBars(3);
        const out = harness(input, 8, () => {
            const result = anchoredVolumeProfile("slot", {
                anchor: input[0].time,
                bucketColor: "#90caf9",
            });
            return { color: result.buckets[0]?.color, poc: result.poc.current };
        });
        expect(out[2]).toEqual({ color: "#90caf9", poc: 42 });
    });

    it("constant-price input can emit an uncolored degenerate bucket", () => {
        const input = constantBars(3);
        const out = harness(input, 8, () => {
            const result = anchoredVolumeProfile("slot", { anchor: input[0].time });
            return result.buckets[0];
        });
        expect(out[2]).toEqual({ price: 42, volume: 3030 });
    });

    it("skips non-finite closes while building a degenerate profile", () => {
        const input = constantBars(3).map((bar, index) => ({
            ...bar,
            close: index === 1 ? Number.NaN : bar.close,
        }));
        const out = harness(input, 8, () => anchoredVolumeProfile("slot", { anchor: input[0].time }));
        expect(out[2].poc.current).toBe(42);
    });

    it("accepts value-area percentage inputs above one", () => {
        const input = bars(4);
        const out = harness(input, 8, () =>
            anchoredVolumeProfile("slot", {
                anchor: input[0].time,
                valueAreaPct: 70,
            }).poc.current,
        );
        expect(Number.isFinite(out[3])).toBe(true);
    });

    it("applies bucket color to non-degenerate computed profile buckets", () => {
        const input = bars(8);
        const out = harness(input, 16, () => {
            const result = anchoredVolumeProfile("slot", {
                anchor: input[0].time,
                bucketColor: "#90caf9",
            });
            return result.buckets[0]?.color;
        });
        expect(out[7]).toBe("#90caf9");
    });

    it("exposes live buckets through shifted results", () => {
        const input = bars(4);
        const out = harness(input, 8, () => {
            const result = anchoredVolumeProfile("slot", { anchor: input[0].time, offset: 1 });
            return result.buckets.length;
        });
        expect(out[3]).toBeGreaterThan(0);
    });

    it("diagnoses when horizontal histogram plots are not supported", () => {
        const input = bars(3);
        const out = harness(input, 8, (_bar, ctx) => {
            ctx.capabilities.plots.delete("horizontal-histogram");
            anchoredVolumeProfile("slot", { anchor: input[0].time });
            return ctx.emissions.diagnostics.filter(
                (diagnostic) => diagnostic.code === "unsupported-plot-kind",
            ).length;
        });
        // Deduped per slot: one diagnostic across the run, not one per bar.
        expect(out[out.length - 1]).toBe(1);
    });

    it("returns the same result identity and honors offset views", () => {
        const input = bars(6);
        const anchor = input[0].time;
        const refs = new Set<unknown>();
        const unshifted = harness(input, 10, () => {
            const result = anchoredVolumeProfile("slot", { anchor });
            refs.add(result);
            return result.poc.current;
        });
        const shifted = harness(
            input,
            10,
            () => anchoredVolumeProfile("slot", { anchor, offset: 1 }).poc.current,
        );
        expect(refs.size).toBe(1);
        expect(shifted[5]).toBe(unshifted[4]);
    });

    it("throws outside an active script step", () => {
        expect(() => anchoredVolumeProfile("oops", { anchor: 1_700_000_000_000 })).toThrowError(
            /ta.anchoredVolumeProfile called outside an active script step/,
        );
    });
});

describe("ta.anchoredVolumeProfile tick-mode", () => {
    it("replaces the head without advancing the output buffers", () => {
        const input = bars(4);
        const { ctxRef } = harnessWithCtx(input, 10, () =>
            anchoredVolumeProfile("slot", { anchor: input[0].time }),
        );
        const tickBar = { ...input[3], close: 110, high: 110.5, low: 109.5, volume: 50 };
        const tickResult = tick(ctxRef, tickBar, () => {
            const result = anchoredVolumeProfile("slot", { anchor: input[0].time });
            return { head: result.poc.current, length: result.poc.length };
        });
        expect(tickResult.length).toBe(input.length);
        expect(Number.isFinite(tickResult.head)).toBe(true);
    });
});
