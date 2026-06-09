// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { alignHtfSeriesToLtf } from "./alignHtfSeriesToLtf";

function makeBar(time: number): Bar {
    return {
        time,
        open: 1,
        high: 1,
        low: 1,
        close: 1,
        volume: 1,
        symbol: "TEST",
        interval: "1m",
        hl2: 1,
        hlc3: 1,
        ohlc4: 1,
        hlcc4: 1,
    };
}

function sortedUniqueTimes(
    minLength: number,
    maxLength: number,
): fc.Arbitrary<ReadonlyArray<number>> {
    return fc
        .uniqueArray(fc.integer({ min: 0, max: 20_000 }), {
            minLength,
            maxLength,
        })
        .map((times) => [...times].sort((a, b) => a - b));
}

function sameNumber(a: number, b: number): boolean {
    return Number.isNaN(a) && Number.isNaN(b) ? true : Object.is(a, b);
}

function expectedAt(
    htf: ReadonlyArray<Bar>,
    htfSeries: ReadonlyArray<number>,
    ltfTime: number,
): number {
    let idx = -1;
    for (let i = 0; i < htf.length; i += 1) {
        if (htf[i].time <= ltfTime) idx = i;
    }
    return idx >= 0 ? htfSeries[idx] : Number.NaN;
}

const finiteOrNan = fc.oneof(
    fc.constant(Number.NaN),
    fc.double({ min: -1_000_000, max: 1_000_000, noDefaultInfinity: true, noNaN: true }),
);

const alignCase = sortedUniqueTimes(0, 30).chain((htfTimes) =>
    fc
        .tuple(
            fc.constant(htfTimes),
            fc.array(finiteOrNan, { minLength: htfTimes.length, maxLength: htfTimes.length }),
            sortedUniqueTimes(0, 80),
        )
        .map(([times, series, ltfTimes]) => ({
            htf: times.map((time) => makeBar(time)),
            htfSeries: series,
            ltf: ltfTimes.map((time) => makeBar(time)),
        })),
);

describe("alignHtfSeriesToLtf — property invariants", () => {
    it("never looks ahead of the LTF bar time", () => {
        fc.assert(
            fc.property(alignCase, ({ htf, htfSeries, ltf }) => {
                const out = alignHtfSeriesToLtf(htf, htfSeries, ltf);
                for (let i = 0; i < ltf.length; i += 1) {
                    expect(sameNumber(out[i], expectedAt(htf, htfSeries, ltf[i].time))).toBe(true);
                }
            }),
        );
    });

    it("always matches LTF length", () => {
        fc.assert(
            fc.property(alignCase, ({ htf, htfSeries, ltf }) => {
                const out = alignHtfSeriesToLtf(htf, htfSeries, ltf);
                expect(out).toHaveLength(ltf.length);
            }),
        );
    });

    it("is deterministic for repeated calls with the same inputs", () => {
        fc.assert(
            fc.property(alignCase, ({ htf, htfSeries, ltf }) => {
                const a = alignHtfSeriesToLtf(htf, htfSeries, ltf);
                const b = alignHtfSeriesToLtf(htf, htfSeries, ltf);
                expect(a).toHaveLength(b.length);
                for (let i = 0; i < a.length; i += 1) {
                    expect(sameNumber(a[i], b[i])).toBe(true);
                }
            }),
        );
    });
});
