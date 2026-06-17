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
        ["D", "1d"],
        ["1D", "1d"],
        ["W", "1w"],
        ["1W", "1w"],
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
        ["1d", "D"],
        ["1w", "W"],
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
});
