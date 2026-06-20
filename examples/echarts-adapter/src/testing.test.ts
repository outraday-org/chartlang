// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { MockECharts, hashOptionLog, mockValueToPixel } from "./testing.js";

describe("MockECharts", () => {
    it("records setOption with and without opts", () => {
        const chart = new MockECharts();
        chart.setOption({ series: [] });
        chart.setOption({ series: [] }, { notMerge: true });
        expect(chart.calls[0]).toEqual({ kind: "setOption", option: { series: [] } });
        expect(chart.calls[1]).toEqual({
            kind: "setOption",
            option: { series: [] },
            opts: { notMerge: true },
        });
    });

    it("records resize and dispose", () => {
        const chart = new MockECharts();
        chart.resize();
        chart.dispose();
        expect(chart.calls).toEqual([{ kind: "resize" }, { kind: "dispose" }]);
    });

    it("converts a value to a deterministic pixel and records the call", () => {
        const chart = new MockECharts();
        const pixel = chart.convertToPixel({ gridIndex: 0 }, [0, 0]);
        expect(pixel).toEqual([48, 408]);
        expect(chart.calls[0]).toEqual({
            kind: "convertToPixel",
            value: [0, 0],
            pixel: [48, 408],
        });
    });

    it("lastOption returns the most recent option tree", () => {
        const chart = new MockECharts();
        expect(chart.lastOption()).toBeUndefined();
        chart.setOption({ backgroundColor: "#000" });
        chart.resize();
        chart.setOption({ backgroundColor: "#111" });
        expect(chart.lastOption()).toEqual({ backgroundColor: "#111" });
    });

    it("lastOption skips trailing non-setOption calls", () => {
        const chart = new MockECharts();
        chart.setOption({ backgroundColor: "#000" });
        chart.dispose();
        expect(chart.lastOption()).toEqual({ backgroundColor: "#000" });
    });
});

describe("hashOptionLog", () => {
    it("produces a stable 64-char hex digest", () => {
        const chart = new MockECharts();
        chart.setOption({ series: [{ type: "line", data: [1.123456789] }] });
        chart.dispose();
        expect(hashOptionLog(chart.calls)).toMatch(/^[0-9a-f]{64}$/);
    });

    it("is insensitive to sub-4dp float drift and key order", () => {
        const a = new MockECharts();
        a.setOption({ series: [{ type: "line", data: [1.123451] }], backgroundColor: "#000" });
        const b = new MockECharts();
        b.setOption({ backgroundColor: "#000", series: [{ type: "line", data: [1.123452] }] });
        expect(hashOptionLog(a.calls)).toBe(hashOptionLog(b.calls));
    });

    it("rounds non-finite numbers to their string form", () => {
        const a = new MockECharts();
        a.setOption({ series: [{ type: "line", data: [Number.NaN, Number.POSITIVE_INFINITY] }] });
        const b = new MockECharts();
        b.setOption({ series: [{ type: "line", data: [Number.NaN, Number.POSITIVE_INFINITY] }] });
        expect(hashOptionLog(a.calls)).toBe(hashOptionLog(b.calls));
    });

    it("distinguishes materially different option trees", () => {
        const a = new MockECharts();
        a.setOption({ series: [{ type: "line", data: [1] }] });
        const b = new MockECharts();
        b.setOption({ series: [{ type: "bar", data: [1] }] });
        expect(hashOptionLog(a.calls)).not.toBe(hashOptionLog(b.calls));
    });

    it("canonicalises resize and dispose calls in the log", () => {
        const a = new MockECharts();
        a.setOption({ series: [] });
        a.resize();
        a.dispose();
        const b = new MockECharts();
        b.setOption({ series: [] });
        b.resize();
        b.dispose();
        expect(hashOptionLog(a.calls)).toBe(hashOptionLog(b.calls));
        // A resize in the log changes the hash versus a log without one.
        const c = new MockECharts();
        c.setOption({ series: [] });
        c.dispose();
        expect(hashOptionLog(a.calls)).not.toBe(hashOptionLog(c.calls));
    });

    it("hashes the setOption opts when present", () => {
        const withOpts = new MockECharts();
        withOpts.setOption({ series: [] }, { notMerge: true });
        const withoutOpts = new MockECharts();
        withoutOpts.setOption({ series: [] });
        expect(hashOptionLog(withOpts.calls)).not.toBe(hashOptionLog(withoutOpts.calls));
    });

    it("canonicalises convertToPixel calls in the log", () => {
        const a = new MockECharts();
        a.convertToPixel({ gridIndex: 0 }, [1, 2]);
        const b = new MockECharts();
        b.convertToPixel({ gridIndex: 0 }, [1, 2]);
        expect(hashOptionLog(a.calls)).toBe(hashOptionLog(b.calls));
    });
});

describe("mockValueToPixel", () => {
    it("applies the documented affine map (price negated for downward y)", () => {
        expect(mockValueToPixel([0, 0])).toEqual([48, 408]);
        expect(mockValueToPixel([1000, 100])).toEqual([49, 8]);
    });
});
