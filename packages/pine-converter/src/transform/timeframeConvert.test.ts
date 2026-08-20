// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { intervalToPineTimeframe, pineTimeframeToInterval } from "./timeframeConvert.js";

describe("pineTimeframeToInterval", () => {
    const table: ReadonlyArray<readonly [string, string]> = [
        ["1S", "1s"],
        ["15S", "15s"],
        ["1", "1m"],
        ["5", "5m"],
        ["60", "1h"],
        ["240", "4h"],
        ["D", "1D"],
        ["1D", "1D"],
        ["W", "1W"],
        ["1W", "1W"],
        ["M", "1M"],
        ["1M", "1M"],
    ];

    it.each(table)("maps Pine %s to chartlang %s", (pine, interval) => {
        expect(pineTimeframeToInterval(pine)).toBe(interval);
    });

    it("returns null for an unknown timeframe", () => {
        expect(pineTimeframeToInterval("999")).toBeNull();
    });
});

describe("intervalToPineTimeframe", () => {
    const table: ReadonlyArray<readonly [string, string]> = [
        ["1s", "1S"],
        ["15s", "15S"],
        ["1m", "1"],
        ["5m", "5"],
        ["1h", "60"],
        ["4h", "240"],
        ["1D", "D"],
        ["1W", "W"],
        ["1M", "M"],
    ];

    it.each(table)("maps chartlang %s to canonical Pine %s", (interval, pine) => {
        expect(intervalToPineTimeframe(interval)).toBe(pine);
    });

    it("round-trips every canonical interval back to itself", () => {
        for (const [interval] of table) {
            const pine = intervalToPineTimeframe(interval);
            expect(pine).not.toBeNull();
            expect(pineTimeframeToInterval(pine as string)).toBe(interval);
        }
    });

    it("returns null for an unknown interval", () => {
        expect(intervalToPineTimeframe("3y")).toBeNull();
    });

    // The pre-0.9.2 spellings. They are not chartlang intervals — core's
    // `intervalToSeconds` grammar has no lowercase day / week suffix — so the
    // reverse table must not accept them back either, or a round trip through
    // an old emitted value would silently look healthy.
    it("rejects the retired lowercase day / week spellings", () => {
        expect(intervalToPineTimeframe("1d")).toBeNull();

        expect(intervalToPineTimeframe("1w")).toBeNull();
    });
});
