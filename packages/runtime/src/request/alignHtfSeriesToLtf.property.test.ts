// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { alignHtfSeriesToLtf } from "./alignHtfSeriesToLtf.js";

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

/** Last secondary bar opened strictly before main bar `i`'s close. */
function expectedFinerAt(
    secondary: ReadonlyArray<Bar>,
    series: ReadonlyArray<number>,
    main: ReadonlyArray<Bar>,
    i: number,
): number {
    const bound = i + 1 < main.length ? main[i + 1].time : Number.POSITIVE_INFINITY;
    let idx = -1;
    for (let k = 0; k < secondary.length; k += 1) {
        if (secondary[k].time < bound) idx = k;
    }
    return idx >= 0 ? series[idx] : Number.NaN;
}

describe("alignHtfSeriesToLtf — finer-secondary property invariants", () => {
    it("aligns every main bar to the last sub-bar that closed at/before its close", () => {
        fc.assert(
            fc.property(alignCase, ({ htf, htfSeries, ltf }) => {
                const out = alignHtfSeriesToLtf(htf, htfSeries, ltf, true);
                for (let i = 0; i < ltf.length; i += 1) {
                    expect(sameNumber(out[i], expectedFinerAt(htf, htfSeries, ltf, i))).toBe(true);
                }
            }),
        );
    });

    it("never repaints a closed main bar as later sub-bars arrive", () => {
        fc.assert(
            fc.property(
                alignCase,
                fc.integer({ min: 0, max: 30 }),
                ({ htf, htfSeries, ltf }, p) => {
                    const cut = Math.min(p, htf.length);
                    const full = alignHtfSeriesToLtf(htf, htfSeries, ltf, true);
                    const prefix = alignHtfSeriesToLtf(
                        htf.slice(0, cut),
                        htfSeries.slice(0, cut),
                        ltf,
                        true,
                    );
                    // A closed main bar (i < last) is frozen once the prefix already
                    // holds every sub-bar opened before its close, i.e. the first
                    // omitted sub-bar (if any) opens at/after that close. Its value
                    // must then equal the full-stream value — no retroactive change.
                    for (let i = 0; i + 1 < ltf.length; i += 1) {
                        const bound = ltf[i + 1].time;
                        const prefixHasAll = cut === htf.length || htf[cut].time >= bound;
                        if (prefixHasAll) {
                            expect(sameNumber(prefix[i], full[i])).toBe(true);
                        }
                    }
                },
            ),
        );
    });
});
