// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { alignHtfSeriesToLtf } from "./alignHtfSeriesToLtf.js";

function makeBar(time: number, value = 0): Bar {
    return {
        time,
        open: value,
        high: value,
        low: value,
        close: value,
        volume: value,
        symbol: "TEST",
        interval: "1m",
        hl2: value,
        hlc3: value,
        ohlc4: value,
        hlcc4: value,
    };
}

function makeBars(times: ReadonlyArray<number>): ReadonlyArray<Bar> {
    return times.map((time) => makeBar(time));
}

function expectSeries(actual: ReadonlyArray<number>, expected: ReadonlyArray<number>): void {
    expect(actual).toHaveLength(expected.length);
    for (let i = 0; i < expected.length; i += 1) {
        if (Number.isNaN(expected[i])) expect(Number.isNaN(actual[i])).toBe(true);
        else expect(actual[i]).toBe(expected[i]);
    }
}

describe("alignHtfSeriesToLtf", () => {
    it("returns all-NaN when HTF is empty", () => {
        const out = alignHtfSeriesToLtf([], [], makeBars([0, 60, 120]));

        expect(out).toHaveLength(3);
        for (const value of out) {
            expect(Number.isNaN(value)).toBe(true);
        }
    });

    it("returns empty when LTF is empty", () => {
        const out = alignHtfSeriesToLtf(makeBars([0]), [42], []);

        expect(out).toEqual([]);
    });

    it("relies on ascending HTF and LTF time inputs", () => {
        const out = alignHtfSeriesToLtf(makeBars([100, 200]), [10, 20], makeBars([50, 100, 150]));

        expectSeries(out, [Number.NaN, 10, 10]);
    });

    it("uses inclusive boundary semantics for a single HTF bar", () => {
        const out = alignHtfSeriesToLtf(makeBars([100]), [100], makeBars([50, 100, 150]));

        expectSeries(out, [Number.NaN, 100, 100]);
    });

    it("propagates NaN HTF values while continuing the walk", () => {
        const out = alignHtfSeriesToLtf(
            makeBars([0, 100, 200]),
            [1, Number.NaN, 3],
            makeBars([0, 50, 100, 150, 200, 250]),
        );

        expectSeries(out, [1, 1, Number.NaN, Number.NaN, 3, 3]);
    });

    it("reads an HTF value when LTF time equals the HTF close time", () => {
        const out = alignHtfSeriesToLtf(
            makeBars([100, 200]),
            [10, 20],
            makeBars([99, 100, 199, 200]),
        );

        expectSeries(out, [Number.NaN, 10, 10, 20]);
    });
});

describe("alignHtfSeriesToLtf — finer secondary (secondaryIsFinerThanMain)", () => {
    it("aligns the worked 1D main / 1h secondary example to the last closed sub-bar", () => {
        // Main 1D opens at t0=0 and t0+86400. Secondary 1h: 24 sub-bars opening
        // 0, 3600, …, 82800 (the last closing at 86400); series[i] === i.
        const hourly = Array.from({ length: 24 }, (_, i) => i * 3600);
        const secondary = makeBars(hourly);
        const series = hourly.map((_, i) => i);
        const main = makeBars([0, 86_400]);

        const out = alignHtfSeriesToLtf(secondary, series, main, true);

        // Day 0 (closed) → last sub-bar opened before the next day = index 23
        // (the t0+82800 sub-bar), NOT index 0. The in-progress final day carries
        // the running head (still 23 — no later sub-bar yet).
        expectSeries(out, [23, 23]);
    });

    it("takes the last sub-bar within each closed main bar (many sub-bars)", () => {
        const secondary = makeBars([0, 25, 50, 75, 100, 125, 150, 175, 200, 225]);
        const series = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
        const main = makeBars([0, 100, 200]);

        const out = alignHtfSeriesToLtf(secondary, series, main, true);

        // bar0 close=100 → last sub <100 = idx3; bar1 close=200 → idx7;
        // bar2 (in-progress) → running head idx9.
        expectSeries(out, [3, 7, 9]);
    });

    it("handles exactly one sub-bar per main bar", () => {
        const out = alignHtfSeriesToLtf(
            makeBars([0, 100, 200]),
            [10, 20, 30],
            makeBars([0, 100, 200]),
            true,
        );

        expectSeries(out, [10, 20, 30]);
    });

    it("exposes the running head on the in-progress final main bar", () => {
        const secondary = makeBars([0, 25, 50, 75, 100, 125]);
        const series = [0, 1, 2, 3, 4, 5];
        const main = makeBars([0, 100]);

        const out = alignHtfSeriesToLtf(secondary, series, main, true);

        // bar0 close=100 → idx3; final in-progress bar absorbs 100,125 → idx5.
        expectSeries(out, [3, 5]);
    });

    it("emits leading NaN until the first sub-bar closes within a main bar", () => {
        const out = alignHtfSeriesToLtf(makeBars([150]), [9], makeBars([0, 100, 200]), true);

        // bar0 close=100 → no sub-bar yet → NaN; bar1 close=200 → sub @150 → 9;
        // final bar carries it forward.
        expectSeries(out, [Number.NaN, 9, 9]);
    });

    it("carries the last known sub-bar value forward across a gap main bar", () => {
        const out = alignHtfSeriesToLtf(
            makeBars([0, 250]),
            [5, 6],
            makeBars([0, 100, 200, 300]),
            true,
        );

        // bar1 (close=200) has no new sub-bar → holds 5; bar2 (close=300) sees @250 → 6.
        expectSeries(out, [5, 5, 6, 6]);
    });

    it("returns all-NaN for an empty secondary array (shared early-exit, finer flag set)", () => {
        const out = alignHtfSeriesToLtf([], [], makeBars([0, 100]), true);

        expectSeries(out, [Number.NaN, Number.NaN]);
    });
});
