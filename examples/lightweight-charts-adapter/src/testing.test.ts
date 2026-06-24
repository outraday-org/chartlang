// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { hashCallLog } from "@invinite-org/chartlang-adapter-kit/canvas";
import { describe, expect, it } from "vitest";

import { MockLwcApi, createMockChart, hashLwcCallLog } from "./testing.js";

describe("MockLwcApi", () => {
    it("records addSeries with a deterministic series id, pane index, and creation options", () => {
        const chart = new MockLwcApi();
        chart.addSeries("Line", { color: "#fff" }, 0);
        chart.addSeries("Area", {}, 2);
        expect(chart.calls).toEqual([
            {
                kind: "addSeries",
                seriesId: "s0",
                seriesType: "Line",
                paneIndex: 0,
                options: { color: "#fff" },
            },
            { kind: "addSeries", seriesId: "s1", seriesType: "Area", paneIndex: 2, options: {} },
        ]);
    });

    it("defaults the pane index to 0 when omitted", () => {
        const chart = new MockLwcApi();
        chart.addSeries("Histogram", {});
        expect(chart.calls[0]).toMatchObject({ kind: "addSeries", paneIndex: 0 });
    });

    it("records every series method into the shared log", () => {
        const chart = new MockLwcApi();
        const series = chart.addSeries("Line", {}, 0);
        series.setData([
            { time: 1, value: 10 },
            { time: 2, value: 20 },
        ]);
        series.update({ time: 3, value: 30 });
        series.update({ time: 4 });
        series.applyOptions({ visible: false });
        const priceLine = series.createPriceLine({ price: 42 });
        priceLine.applyOptions({ price: 43 });
        series.removePriceLine(priceLine);
        series.setMarkers([{ time: 5 }, { time: 6 }]);
        series.attachPrimitive({ paneViews: () => [] });
        expect(chart.calls.slice(1)).toEqual([
            { kind: "setData", seriesId: "s0", points: 2 },
            { kind: "update", seriesId: "s0", time: 3, value: 30 },
            { kind: "update", seriesId: "s0", time: 4, value: null },
            { kind: "applyOptions", seriesId: "s0", options: { visible: false } },
            { kind: "createPriceLine", seriesId: "s0", priceLineId: "pl0", price: 42 },
            { kind: "applyPriceLineOptions", priceLineId: "pl0", price: 43 },
            { kind: "removePriceLine", seriesId: "s0", priceLineId: "pl0" },
            { kind: "setMarkers", seriesId: "s0", markers: 2 },
            { kind: "attachPrimitive", seriesId: "s0" },
        ]);
    });

    it("records OHLC fields on a candlestick update point", () => {
        const chart = new MockLwcApi();
        const series = chart.addSeries("Candlestick", {}, 0);
        // setData records only the point count; OHLC is not per-point in the log.
        series.setData([{ time: 1, open: 10, high: 12, low: 9, close: 11 }]);
        series.update({ time: 2, open: 11, high: 13, low: 10, close: 12 });
        expect(chart.calls.slice(1)).toEqual([
            { kind: "setData", seriesId: "s0", points: 1 },
            {
                kind: "update",
                seriesId: "s0",
                time: 2,
                value: null,
                open: 11,
                high: 13,
                low: 10,
                close: 12,
            },
        ]);
    });

    it("records per-bar candle colour fields on a candlestick update point", () => {
        const chart = new MockLwcApi();
        const series = chart.addSeries("Candlestick", {}, 0);
        series.update({
            time: 2,
            open: 11,
            high: 13,
            low: 10,
            close: 12,
            color: "#2962ff",
            borderColor: "#2962ff",
            wickColor: "#2962ff",
        });
        expect(chart.calls.slice(1)).toEqual([
            {
                kind: "update",
                seriesId: "s0",
                time: 2,
                value: null,
                open: 11,
                high: 13,
                low: 10,
                close: 12,
                color: "#2962ff",
                borderColor: "#2962ff",
                wickColor: "#2962ff",
            },
        ]);
    });

    it("records addPane with an incrementing pane index", () => {
        const chart = new MockLwcApi();
        expect(chart.addPane()).toEqual({ paneIndex: 1 });
        expect(chart.addPane()).toEqual({ paneIndex: 2 });
        expect(chart.calls).toEqual([
            { kind: "addPane", paneIndex: 1 },
            { kind: "addPane", paneIndex: 2 },
        ]);
    });

    it("records setVisibleLogicalRange with its from / to bounds", () => {
        const chart = new MockLwcApi();
        chart.setVisibleLogicalRange({ from: 90, to: 99 });
        expect(chart.calls).toEqual([{ kind: "setVisibleLogicalRange", from: 90, to: 99 }]);
    });

    it("records remove", () => {
        const chart = new MockLwcApi();
        chart.remove();
        expect(chart.calls).toEqual([{ kind: "remove" }]);
    });
});

describe("createMockChart", () => {
    it("hands back the chart and its shared call array", () => {
        const { chart, calls } = createMockChart();
        chart.addPane();
        expect(calls).toBe(chart.calls);
        expect(calls).toEqual([{ kind: "addPane", paneIndex: 1 }]);
    });
});

describe("hashLwcCallLog", () => {
    it("is stable across two identical logs", () => {
        const a = new MockLwcApi();
        const b = new MockLwcApi();
        for (const chart of [a, b]) {
            const s = chart.addSeries("Line", {}, 0);
            s.setData([{ time: 1, value: 1 }]);
            s.update({ time: 2, value: 2.123456789 });
            s.update({ time: 3 });
            s.applyOptions({ visible: true });
            const pl = s.createPriceLine({ price: 9.87654321 });
            pl.applyOptions({ price: 8.12345678 });
            s.removePriceLine(pl);
            s.setMarkers([{ time: 4 }]);
            s.attachPrimitive({ paneViews: () => [] });
            chart.addPane();
            chart.setVisibleLogicalRange({ from: 5.123456789, to: 14.987654321 });
            chart.remove();
        }
        expect(hashLwcCallLog(a.calls)).toBe(hashLwcCallLog(b.calls));
        expect(hashLwcCallLog(a.calls)).toMatch(/^[0-9a-f]{64}$/);
    });

    it("canonicalises non-finite update / price-line floats to strings", () => {
        const chart = new MockLwcApi();
        const s = chart.addSeries("Line", {}, 0);
        s.update({ time: Number.NaN, value: Number.POSITIVE_INFINITY });
        s.createPriceLine({ price: Number.NEGATIVE_INFINITY });
        // No throw and a stable 64-char digest proves both non-finite arms
        // round-trip through `String(...)` rather than `toFixed`.
        expect(hashLwcCallLog(chart.calls)).toMatch(/^[0-9a-f]{64}$/);
    });

    it("differs when a float changes beyond 4 dp and matches within it", () => {
        const base = new MockLwcApi();
        base.addSeries("Line", {}, 0).update({ time: 1, value: 1.0 });
        const within = new MockLwcApi();
        within.addSeries("Line", {}, 0).update({ time: 1, value: 1.000004 });
        const beyond = new MockLwcApi();
        beyond.addSeries("Line", {}, 0).update({ time: 1, value: 1.5 });
        expect(hashLwcCallLog(within.calls)).toBe(hashLwcCallLog(base.calls));
        expect(hashLwcCallLog(beyond.calls)).not.toBe(hashLwcCallLog(base.calls));
    });

    it("canonicalises OHLC fields on a candlestick update", () => {
        const a = new MockLwcApi();
        const b = new MockLwcApi();
        for (const chart of [a, b]) {
            chart.addSeries("Candlestick", {}, 0).update({
                time: 1,
                open: 10.12345678,
                high: 12.12345678,
                low: 9.12345678,
                close: 11.12345678,
            });
        }
        // Both produce the same hash (OHLC fields rounded to 4 dp).
        expect(hashLwcCallLog(a.calls)).toBe(hashLwcCallLog(b.calls));
        expect(hashLwcCallLog(a.calls)).toMatch(/^[0-9a-f]{64}$/);
        // A log with a different OHLC close produces a different hash.
        const c = new MockLwcApi();
        c.addSeries("Candlestick", {}, 0).update({
            time: 1,
            open: 10.12345678,
            high: 12.12345678,
            low: 9.12345678,
            close: 99,
        });
        expect(hashLwcCallLog(c.calls)).not.toBe(hashLwcCallLog(a.calls));
    });

    it("canonicalises setVisibleLogicalRange bounds to 4 dp", () => {
        const within = new MockLwcApi();
        within.setVisibleLogicalRange({ from: 0, to: 9.000004 });
        const base = new MockLwcApi();
        base.setVisibleLogicalRange({ from: 0, to: 9 });
        const beyond = new MockLwcApi();
        beyond.setVisibleLogicalRange({ from: 0, to: 9.5 });
        expect(hashLwcCallLog(within.calls)).toBe(hashLwcCallLog(base.calls));
        expect(hashLwcCallLog(beyond.calls)).not.toBe(hashLwcCallLog(base.calls));
    });

    it("canonicalises per-bar candle colour fields on a candlestick update", () => {
        const base = new MockLwcApi();
        base.addSeries("Candlestick", {}, 0).update({
            time: 1,
            open: 10,
            high: 12,
            low: 9,
            close: 11,
            color: "#2962ff",
            borderColor: "#2962ff",
            wickColor: "#2962ff",
        });
        // A different per-bar colour re-hashes the log.
        const other = new MockLwcApi();
        other.addSeries("Candlestick", {}, 0).update({
            time: 1,
            open: 10,
            high: 12,
            low: 9,
            close: 11,
            color: "#ff6d00",
            borderColor: "#ff6d00",
            wickColor: "#ff6d00",
        });
        expect(hashLwcCallLog(base.calls)).toMatch(/^[0-9a-f]{64}$/);
        expect(hashLwcCallLog(other.calls)).not.toBe(hashLwcCallLog(base.calls));
    });
});

describe("adapter-kit canvas boundary", () => {
    it("consumes the shared hashCallLog over the public sub-path", () => {
        // The lightweight-charts adapter is part of the canvas family; this
        // proves the shared canvas sink is reachable through the public
        // package boundary (the LWC mock specialises the same approach).
        expect(hashCallLog([])).toMatch(/^[0-9a-f]{64}$/);
    });
});
