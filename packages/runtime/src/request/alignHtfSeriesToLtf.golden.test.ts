// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

// Golden capture procedure: run the invinite
// `src/components/trading-chart/indicators/lib/align-htf-series-to-ltf.ts`
// two-pointer kernel at commit 3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4
// against each fixture's `htf`, `ltf`, and `series` arrays, then persist the
// output in `expected`. JSON stores `NaN` as `null`; this test decodes it.

import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import finer1dMain1h from "./__fixtures__/align-secondary-finer-1d-main-1h.json";
import volume1d from "./__fixtures__/align-htf-series-1m-ltf-1d-htf-volume.json";
import close1h from "./__fixtures__/align-htf-series-1m-ltf-1h-htf-close.json";
import close4hNan from "./__fixtures__/align-htf-series-5m-ltf-4h-htf-close-nan.json";
import { alignHtfSeriesToLtf } from "./alignHtfSeriesToLtf.js";

type JsonNumber = number | null;

type Fixture = {
    readonly source: string;
    readonly htf: ReadonlyArray<number>;
    readonly ltf: ReadonlyArray<number>;
    readonly series: ReadonlyArray<JsonNumber>;
    readonly expected: ReadonlyArray<JsonNumber>;
};

function decode(value: JsonNumber): number {
    return value === null ? Number.NaN : value;
}

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

function expectSeries(actual: ReadonlyArray<number>, expected: ReadonlyArray<number>): void {
    expect(actual).toHaveLength(expected.length);
    for (let i = 0; i < expected.length; i += 1) {
        if (Number.isNaN(expected[i])) expect(Number.isNaN(actual[i])).toBe(true);
        else expect(actual[i]).toBe(expected[i]);
    }
}

const fixtures: ReadonlyArray<[string, Fixture]> = [
    ["1m LTF / 1h HTF / close", close1h],
    ["1m LTF / 1D HTF / volume", volume1d],
    ["5m LTF / 4h HTF / close with NaN middle bar", close4hNan],
];

describe("alignHtfSeriesToLtf — invinite goldens", () => {
    for (const [name, fixture] of fixtures) {
        it(`matches ${name}`, () => {
            expect(fixture.source).toContain("3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4");
            const htf = fixture.htf.map((time) => makeBar(time));
            const ltf = fixture.ltf.map((time) => makeBar(time));
            const series = fixture.series.map(decode);
            const expected = fixture.expected.map(decode);

            const actual = alignHtfSeriesToLtf(htf, series, ltf);

            expectSeries(actual, expected);
        });
    }
});

describe("alignHtfSeriesToLtf — finer-secondary golden", () => {
    it("matches 1D main / 1h secondary (last closed sub-bar per main close)", () => {
        const fixture = finer1dMain1h as Fixture;
        const secondary = fixture.htf.map((time) => makeBar(time));
        const main = fixture.ltf.map((time) => makeBar(time));
        const series = fixture.series.map(decode);
        const expected = fixture.expected.map(decode);

        const actual = alignHtfSeriesToLtf(secondary, series, main, true);

        expectSeries(actual, expected);
    });
});
