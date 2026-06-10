// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { PlotEmission } from "@invinite-org/chartlang-adapter-kit";
import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { harness, harnessWithCtx, tick } from "./__fixtures__/runPrimitive";
import { fixedRangeVolumeProfile } from "./fixedRangeVolumeProfile";
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

describe("ta.fixedRangeVolumeProfile", () => {
    it("full range matches visible-range volume profile at the final bar", () => {
        const input = bars(100);
        const fixed = harness(
            input,
            128,
            () =>
                fixedRangeVolumeProfile("slot", {
                    from: input[0].time,
                    to: input[input.length - 1].time,
                    rowSize: 24,
                }).poc.current,
        );
        const visible = harness(
            input,
            128,
            () => visibleRangeVolumeProfile("slot", { rowSize: 24 }).poc.current,
        );
        expect(fixed[99]).toBeCloseTo(visible[99], 10);
    });

    it("emits only inside the inclusive range and freezes after to", () => {
        const input = bars(100);
        const from = input[25].time;
        const to = input[75].time;
        const out = harness(input, 128, (_bar, ctx) => {
            const result = fixedRangeVolumeProfile("slot", { from, to, rowSize: 24 });
            const plot = lastPlot(ctx.emissions.plots);
            return {
                bucketHash:
                    plot.style.kind === "horizontal-histogram"
                        ? JSON.stringify(plot.style.buckets)
                        : "",
                poc: result.poc.current,
            };
        });
        for (let i = 0; i < 25; i += 1) {
            expect(Number.isNaN(out[i].poc)).toBe(true);
        }
        for (let i = 25; i <= 75; i += 1) {
            expect(Number.isFinite(out[i].poc)).toBe(true);
        }
        expect(out[76].poc).toBe(out[75].poc);
        expect(out[76].bucketHash).toBe(out[75].bucketHash);
    });

    it("diagnoses inverted ranges once and returns NaN", () => {
        const input = bars(4);
        const out = harness(input, 16, (_bar, ctx) => {
            const result = fixedRangeVolumeProfile("slot", {
                from: input[3].time,
                to: input[0].time,
            });
            return {
                diagnostics: ctx.emissions.diagnostics.filter(
                    (diagnostic) => diagnostic.code === "fixed-range-inverted",
                ).length,
                poc: result.poc.current,
            };
        });
        expect(out.every((value) => Number.isNaN(value.poc))).toBe(true);
        expect(out[out.length - 1].diagnostics).toBe(1);
    });

    it("future range produces all NaN values", () => {
        const input = bars(8);
        const from = input[input.length - 1].time + 60_000;
        const to = from + 60_000;
        const out = harness(
            input,
            16,
            () => fixedRangeVolumeProfile("slot", { from, to }).poc.current,
        );
        expect(out.every((value) => Number.isNaN(value))).toBe(true);
    });

    it("range before the first bar produces all NaN values", () => {
        const input = bars(8);
        const to = input[0].time - 60_000;
        const from = to - 60_000;
        const out = harness(
            input,
            16,
            () => fixedRangeVolumeProfile("slot", { from, to }).poc.current,
        );
        expect(out.every((value) => Number.isNaN(value))).toBe(true);
    });

    it("degenerate from/to range can emit a one-bucket profile", () => {
        const input = constantBars(3);
        const out = harness(input, 8, () => {
            const result = fixedRangeVolumeProfile("slot", {
                from: input[1].time,
                to: input[1].time,
                bucketColor: "#90caf9",
            });
            return {
                color: result.buckets[0]?.color,
                buckets: result.buckets.length,
                poc: result.poc.current,
            };
        });
        expect(out[0].poc).toBeNaN();
        expect(out[1].poc).toBe(42);
        expect(out[1].buckets).toBe(1);
        expect(out[1].color).toBe("#90caf9");
        expect(out[2].poc).toBe(42);
    });

    it("degenerate from/to range can emit an uncolored bucket", () => {
        const input = constantBars(2);
        const out = harness(input, 8, () =>
            fixedRangeVolumeProfile("slot", {
                from: input[1].time,
                to: input[1].time,
            }),
        );
        expect(out[1].buckets[0]).toEqual({ price: 42, volume: 1010 });
    });

    it("returns an empty snapshot when a degenerate range has no finite positive volume", () => {
        const input = constantBars(1).map((bar) => ({ ...bar, close: Number.NaN, volume: 0 }));
        const out = harness(input, 4, () =>
            fixedRangeVolumeProfile("slot", {
                from: input[0].time,
                to: input[0].time,
            }),
        );
        expect(out[0].buckets).toEqual([]);
        expect(out[0].poc.current).toBeNaN();
    });

    it("exposes live buckets through shifted results", () => {
        const input = bars(4);
        const out = harness(input, 8, () => {
            const result = fixedRangeVolumeProfile("slot", {
                from: input[0].time,
                to: input[3].time,
                offset: 1,
            });
            return result.buckets.length;
        });
        expect(out[3]).toBeGreaterThan(0);
    });

    it("applies bucket color and accepts value-area percentage inputs above one", () => {
        const input = bars(4);
        const out = harness(input, 8, () => {
            const result = fixedRangeVolumeProfile("slot", {
                from: input[0].time,
                to: input[3].time,
                bucketColor: "#90caf9",
                valueAreaPct: 70,
            });
            return result.buckets[0]?.color;
        });
        expect(out[3]).toBe("#90caf9");
    });

    it("diagnoses when horizontal histogram plots are not supported", () => {
        const input = bars(3);
        const out = harness(input, 8, (_bar, ctx) => {
            ctx.capabilities.plots.delete("horizontal-histogram");
            fixedRangeVolumeProfile("slot", { from: input[0].time, to: input[2].time });
            return ctx.emissions.diagnostics.filter(
                (diagnostic) => diagnostic.code === "unsupported-plot-kind",
            ).length;
        });
        // Deduped per slot: one diagnostic across the run, not one per bar.
        expect(out[out.length - 1]).toBe(1);
    });

    it("returns the same result identity and honors offset views", () => {
        const input = bars(6);
        const refs = new Set<unknown>();
        const unshifted = harness(input, 10, () => {
            const result = fixedRangeVolumeProfile("slot", {
                from: input[1].time,
                to: input[4].time,
            });
            refs.add(result);
            return result.poc.current;
        });
        const shifted = harness(
            input,
            10,
            () =>
                fixedRangeVolumeProfile("slot", {
                    from: input[1].time,
                    to: input[4].time,
                    offset: 1,
                }).poc.current,
        );
        expect(refs.size).toBe(1);
        expect(shifted[5]).toBe(unshifted[4]);
    });

    it("throws outside an active script step", () => {
        expect(() =>
            fixedRangeVolumeProfile("oops", { from: 1_700_000_000_000, to: 1_700_000_000_000 }),
        ).toThrowError(/ta.fixedRangeVolumeProfile called outside an active script step/);
    });
});

describe("ta.fixedRangeVolumeProfile tick-mode", () => {
    it("replaces the head without advancing the output buffers", () => {
        const input = bars(4);
        const { ctxRef } = harnessWithCtx(input, 10, () =>
            fixedRangeVolumeProfile("slot", { from: input[0].time, to: input[3].time }),
        );
        const tickBar = { ...input[3], close: 110, high: 110.5, low: 109.5, volume: 50 };
        const tickResult = tick(ctxRef, tickBar, () => {
            const result = fixedRangeVolumeProfile("slot", {
                from: input[0].time,
                to: input[3].time,
            });
            return { head: result.poc.current, length: result.poc.length };
        });
        expect(tickResult.length).toBe(input.length);
        expect(Number.isFinite(tickResult.head)).toBe(true);
    });
});
