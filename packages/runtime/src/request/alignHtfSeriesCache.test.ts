// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getOrAlign } from "./alignHtfSeriesCache.js";
import * as kernel from "./alignHtfSeriesToLtf.js";

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

function makeBars(times: ReadonlyArray<number>): Array<Bar> {
    return times.map((time) => makeBar(time));
}

describe("getOrAlign", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("returns a cached array for identical bar arrays, source, and lengths", () => {
        const spy = vi.spyOn(kernel, "alignHtfSeriesToLtf");
        const htf = makeBars([0, 60]);
        const ltf = makeBars([0, 30, 60]);
        const series = [10, 20];

        const first = getOrAlign(htf, series, ltf);
        const second = getOrAlign(htf, series, ltf);

        expect(second).toBe(first);
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it("misses for a distinct source series with the same bar arrays", () => {
        const spy = vi.spyOn(kernel, "alignHtfSeriesToLtf");
        const htf = makeBars([0, 60]);
        const ltf = makeBars([0, 30, 60]);

        const close = getOrAlign(htf, [10, 20], ltf);
        const high = getOrAlign(htf, [30, 40], ltf);

        expect(high).not.toBe(close);
        expect(spy).toHaveBeenCalledTimes(2);
    });

    it("misses after HTF length changes", () => {
        const spy = vi.spyOn(kernel, "alignHtfSeriesToLtf");
        const htf = makeBars([0, 60]);
        const ltf = makeBars([0, 30, 60, 90]);

        const first = getOrAlign(htf, [10, 20], ltf);
        htf.push(makeBar(120));
        const second = getOrAlign(htf, [10, 20, 30], ltf);

        expect(second).not.toBe(first);
        expect(spy).toHaveBeenCalledTimes(2);
    });

    it("misses for reference-distinct HTF arrays with equal contents", () => {
        const spy = vi.spyOn(kernel, "alignHtfSeriesToLtf");
        const left = makeBars([0, 60]);
        const right = makeBars([0, 60]);
        const ltf = makeBars([0, 30, 60]);

        const first = getOrAlign(left, [10, 20], ltf);
        const second = getOrAlign(right, [10, 20], ltf);

        expect(second).not.toBe(first);
        expect(spy).toHaveBeenCalledTimes(2);
    });

    it("misses when LTF bars are replaced", () => {
        const spy = vi.spyOn(kernel, "alignHtfSeriesToLtf");
        const htf = makeBars([0, 60]);
        const leftLtf = makeBars([0, 30, 60]);
        const rightLtf = makeBars([0, 30, 60]);

        const first = getOrAlign(htf, [10, 20], leftLtf);
        const second = getOrAlign(htf, [10, 20], rightLtf);

        expect(second).not.toBe(first);
        expect(spy).toHaveBeenCalledTimes(2);
    });
});
