// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { alignHtfSeriesToLtf } from "./alignHtfSeriesToLtf";

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
