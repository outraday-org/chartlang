// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { priceToY, timeToX } from "@invinite-org/chartlang-adapter-kit";
import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { MockECharts, mockValueToPixel } from "./testing.js";
import type { EChartsSurface } from "./types.js";
import { buildViewport, computeViewport } from "./viewport.js";

const MS_PER_DAY = 86_400_000;
const START_TIME = 1_700_000_000_000;

function bar(i: number, low: number, high: number): Bar {
    const close = (low + high) / 2;
    return {
        time: START_TIME + i * MS_PER_DAY,
        open: close,
        high,
        low,
        close,
        volume: 1_000,
        symbol: "T",
        interval: "1D",
        hl2: (high + low) / 2,
        hlc3: (high + low + close) / 3,
        ohlc4: (close + high + low + close) / 4,
        hlcc4: (high + low + close + close) / 4,
    };
}

describe("computeViewport", () => {
    it("reconstructs an ABSOLUTE-pixel viewport that reproduces the sampled corners", () => {
        // The two corners carry their world value + the pixel ECharts returned.
        // The reconstructed viewport's linear projection must reproduce those
        // exact pixels — the grid left/top OFFSET folded in (a drawing at the
        // first sampled value lands on its sampled pixel, not at container 0).
        const lo = { value: [START_TIME, 100] as const, pixel: [48, 408] as const };
        const hi = {
            value: [START_TIME + 9 * MS_PER_DAY, 110] as const,
            pixel: [848, 8] as const,
        };
        const vp = computeViewport(lo, hi, 900, 450);
        expect(vp.pxWidth).toBe(900);
        expect(vp.pxHeight).toBe(450);
        expect(timeToX(lo.value[0], vp)).toBeCloseTo(48, 6);
        expect(timeToX(hi.value[0], vp)).toBeCloseTo(848, 6);
        expect(priceToY(lo.value[1], vp)).toBeCloseTo(408, 6);
        expect(priceToY(hi.value[1], vp)).toBeCloseTo(8, 6);
    });

    it("places the world value at container pixel 0 at the viewport edge", () => {
        // The far-left corner sits at pixel 48 (a grid gutter); the world time at
        // container pixel 0 is extrapolated into `xMin`, so `timeToX(xMin) === 0`.
        const lo = { value: [START_TIME, 100] as const, pixel: [48, 408] as const };
        const hi = {
            value: [START_TIME + 9 * MS_PER_DAY, 110] as const,
            pixel: [848, 8] as const,
        };
        const vp = computeViewport(lo, hi, 900, 450);
        expect(timeToX(vp.xMin, vp)).toBeCloseTo(0, 6);
        expect(timeToX(vp.xMax, vp)).toBeCloseTo(900, 6);
    });
});

describe("buildViewport", () => {
    it("samples convertToPixel at the visible category INDICES and reproduces those pixels", () => {
        const chart = new MockECharts();
        const bars = [bar(0, 100, 110), bar(1, 105, 120)];
        const vp = buildViewport(chart, bars);
        const samples = chart.calls.filter((c) => c.kind === "convertToPixel");
        expect(samples).toHaveLength(2);
        // x is sampled at the category INDEX (0 / 1), NOT the ~1.7e12 bar time
        // (a category axis reads a raw timestamp as an out-of-range ordinal).
        expect(samples[0]?.kind === "convertToPixel" && samples[0].value[0]).toBe(0);
        expect(samples[1]?.kind === "convertToPixel" && samples[1].value[0]).toBe(1);
        // The reconstructed viewport reproduces the mock's pixels for the corner
        // world coords (time at index 0/1, price at the window low/high).
        expect(timeToX(bars[0].time, vp)).toBeCloseTo(mockValueToPixel([0, 100])[0], 6);
        expect(timeToX(bars[1].time, vp)).toBeCloseTo(mockValueToPixel([1, 120])[0], 6);
        expect(priceToY(100, vp)).toBeCloseTo(mockValueToPixel([0, 100])[1], 6);
        expect(priceToY(120, vp)).toBeCloseTo(mockValueToPixel([1, 120])[1], 6);
        expect(vp.pxWidth).toBe(chart.getWidth());
        expect(vp.pxHeight).toBe(chart.getHeight());
    });

    it("frames the sampled corners on the VISIBLE dataZoom window, not the full extent", () => {
        const chart = new MockECharts();
        // 11 bars (indices 0..10); a 60–100% window frames indices 6..10.
        const bars = Array.from({ length: 11 }, (_, i) => bar(i, 100 + i, 110 + i));
        buildViewport(chart, bars, 0, { start: 60, end: 100 });
        const samples = chart.calls.filter((c) => c.kind === "convertToPixel");
        // floor(0.6·10)=6, ceil(1.0·10)=10 — the on-screen slice, never index 0.
        expect(samples[0]?.kind === "convertToPixel" && samples[0].value[0]).toBe(6);
        expect(samples[1]?.kind === "convertToPixel" && samples[1].value[0]).toBe(10);
    });

    it("falls back without sampling when only one bar is visible", () => {
        const chart = new MockECharts();
        const vp = buildViewport(chart, [bar(0, 100, 110)]);
        // Single visible column → no horizontal basis; fall back before sampling.
        expect(chart.calls.filter((c) => c.kind === "convertToPixel")).toHaveLength(0);
        expect(vp.pxWidth).toBe(800);
        expect(vp.xMax).toBe(bar(0, 100, 110).time + 1);
    });

    it("falls back on a degenerate (zero-span) sampled basis", () => {
        // A surface whose convertToPixel collapses both corners to one pixel.
        const flatConvert: EChartsSurface = {
            setOption() {},
            resize() {},
            dispose() {},
            getWidth: () => 800,
            getHeight: () => 400,
            convertToPixel: () => [50, 50],
        };
        const bars = [bar(0, 100, 110), bar(1, 105, 120)];
        const vp = buildViewport(flatConvert, bars);
        // No basis → deterministic fallback (xMin/xMax = full bar-time extent).
        expect(vp.xMin).toBe(bars[0].time);
        expect(vp.xMax).toBe(bars[1].time);
        expect(vp.pxWidth).toBe(800);
    });

    it("returns a deterministic fallback when convertToPixel is absent", () => {
        const noConvert: EChartsSurface = {
            setOption() {},
            resize() {},
            dispose() {},
        };
        const bars = [bar(0, 100, 110), bar(1, 105, 120)];
        const vp = buildViewport(noConvert, bars);
        expect(vp).toEqual({
            xMin: bars[0].time,
            xMax: bars[1].time,
            yMin: 100,
            yMax: 120,
            pxWidth: 800,
            pxHeight: 400,
        });
    });

    it("returns a fallback when convertToPixel yields undefined", () => {
        const undefConvert: EChartsSurface = {
            setOption() {},
            resize() {},
            dispose() {},
            getWidth: () => 800,
            getHeight: () => 400,
            convertToPixel() {
                return undefined;
            },
        };
        const bars = [bar(0, 100, 110), bar(1, 105, 120)];
        const vp = buildViewport(undefConvert, bars);
        expect(vp.xMin).toBe(bars[0].time);
        expect(vp.xMax).toBe(bars[1].time);
        expect(vp.yMin).toBe(100);
        expect(vp.yMax).toBe(120);
    });

    it("returns a fallback when convertToPixel throws (chart not laid out)", () => {
        // A live ECharts chart sampled before its first layout throws from
        // inside `convertToPixel` rather than returning `undefined`.
        const throwingConvert: EChartsSurface = {
            setOption() {},
            resize() {},
            dispose() {},
            getWidth: () => 800,
            getHeight: () => 400,
            convertToPixel() {
                throw new Error("Cannot read properties of undefined (reading 'queryComponents')");
            },
        };
        const bars = [bar(0, 100, 110), bar(1, 105, 120)];
        const vp = buildViewport(throwingConvert, bars);
        expect(vp.xMin).toBe(bars[0].time);
        expect(vp.xMax).toBe(bars[1].time);
    });

    it("handles an empty bar window with a unit fallback extent", () => {
        const noConvert: EChartsSurface = {
            setOption() {},
            resize() {},
            dispose() {},
        };
        const vp = buildViewport(noConvert, []);
        expect(vp).toEqual({
            xMin: 0,
            xMax: 1,
            yMin: 0,
            yMax: 1,
            pxWidth: 800,
            pxHeight: 400,
        });
    });

    it("falls back on an empty bar window even when convertToPixel is present", () => {
        const chart = new MockECharts();
        const vp = buildViewport(chart, []);
        // No bars → no window to frame; fall back before sampling any corner.
        expect(chart.calls.filter((c) => c.kind === "convertToPixel")).toHaveLength(0);
        expect(vp).toEqual({
            xMin: 0,
            xMax: 1,
            yMin: 0,
            yMax: 1,
            pxWidth: 800,
            pxHeight: 400,
        });
    });

    it("pads a flat price window so the y span is non-degenerate", () => {
        const noConvert: EChartsSurface = {
            setOption() {},
            resize() {},
            dispose() {},
        };
        const flat = [bar(0, 100, 100), bar(1, 100, 100)];
        const vp = buildViewport(noConvert, flat);
        expect(vp.yMin).toBe(99);
        expect(vp.yMax).toBe(101);
    });

    it("pads a flat VISIBLE price window before sampling the corners", () => {
        // With `convertToPixel` present the price extent is sampled; a flat
        // window (low === high across the visible bars) is padded so the two y
        // corners stay distinct (otherwise the basis would collapse).
        const chart = new MockECharts();
        const flat = [bar(0, 100, 100), bar(1, 100, 100)];
        const vp = buildViewport(chart, flat);
        expect(chart.calls.filter((c) => c.kind === "convertToPixel")).toHaveLength(2);
        // priceExtent padded 100 → [99, 101]; the corners were sampled there.
        expect(priceToY(99, vp)).toBeCloseTo(mockValueToPixel([0, 99])[1], 6);
        expect(priceToY(101, vp)).toBeCloseTo(mockValueToPixel([1, 101])[1], 6);
    });
});
