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
    it("derives pxWidth/pxHeight from the sampled corner delta", () => {
        const vp = computeViewport(
            { value: [0, 100], pixel: [48, 408] },
            { value: [9, 110], pixel: [848, 8] },
            0,
            9,
        );
        expect(vp).toEqual({
            xMin: 0,
            xMax: 9,
            yMin: 100,
            yMax: 110,
            pxWidth: 800,
            pxHeight: 400,
        });
    });

    it("falls back to a nominal size when the sampled pixels are degenerate", () => {
        const vp = computeViewport(
            { value: [0, 100], pixel: [50, 50] },
            { value: [9, 100], pixel: [50, 50] },
            0,
            9,
        );
        expect(vp.pxWidth).toBe(800);
        expect(vp.pxHeight).toBe(400);
    });

    it("reproduces ECharts' convertToPixel under the linear projection", () => {
        // Project a known world price through `priceToY` against the derived
        // viewport and confirm it lands on the same pixel the sampler returned
        // — the verification the task asks for.
        const loValue: readonly [number, number] = [START_TIME, 100];
        const hiValue: readonly [number, number] = [START_TIME + MS_PER_DAY, 200];
        const lo = mockValueToPixel(loValue);
        const hi = mockValueToPixel(hiValue);
        const vp = computeViewport(
            { value: loValue, pixel: lo },
            { value: hiValue, pixel: hi },
            loValue[0],
            hiValue[0],
        );
        // priceToY returns a pane-relative y (0..pxHeight); the sampler's pixel
        // includes the grid `top` offset. Both edges agree once the offset is
        // accounted for: at yMax the relative y is 0 (sampler's smaller py), at
        // yMin it is pxHeight (sampler's larger py).
        const topPy = Math.min(lo[1], hi[1]);
        const botPy = Math.max(lo[1], hi[1]);
        expect(priceToY(vp.yMax, vp) + topPy).toBeCloseTo(topPy, 6);
        expect(priceToY(vp.yMin, vp) + topPy).toBeCloseTo(botPy, 6);
        // x is linear in bar time: the midpoint time lands at half the width.
        const midTime = (loValue[0] + hiValue[0]) / 2;
        expect(timeToX(midTime, vp)).toBeCloseTo(vp.pxWidth / 2, 6);
    });
});

describe("buildViewport", () => {
    it("samples the chart's convertToPixel when available", () => {
        const chart = new MockECharts();
        const bars = [bar(0, 100, 110), bar(1, 105, 120)];
        const vp = buildViewport(chart, bars);
        // Two corner samples were recorded.
        expect(chart.calls.filter((c) => c.kind === "convertToPixel")).toHaveLength(2);
        // The price extent comes from the bar window's low/high.
        expect(vp.yMin).toBe(100);
        expect(vp.yMax).toBe(120);
        expect(vp.xMin).toBe(bars[0].time);
        expect(vp.xMax).toBe(bars[1].time);
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
            convertToPixel() {
                return undefined;
            },
        };
        const bars = [bar(0, 100, 110)];
        const vp = buildViewport(undefConvert, bars);
        // Single bar → xMax is widened by 1; price extent from the lone bar.
        expect(vp.xMax).toBe(bars[0].time + 1);
        expect(vp.yMin).toBe(100);
        expect(vp.yMax).toBe(110);
    });

    it("returns a fallback when convertToPixel throws (chart not laid out)", () => {
        // A live ECharts chart sampled before its first layout throws from
        // inside `convertToPixel` rather than returning `undefined`.
        const throwingConvert: EChartsSurface = {
            setOption() {},
            resize() {},
            dispose() {},
            convertToPixel() {
                throw new Error("Cannot read properties of undefined (reading 'queryComponents')");
            },
        };
        const bars = [bar(0, 100, 110)];
        const vp = buildViewport(throwingConvert, bars);
        expect(vp.xMax).toBe(bars[0].time + 1);
        expect(vp.yMin).toBe(100);
        expect(vp.yMax).toBe(110);
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
});
