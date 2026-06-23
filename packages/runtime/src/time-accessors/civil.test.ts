// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { civilFromDays, daysFromCivil, floorDiv, mod, splitEpoch } from "./civil.js";

const DAY_MS = 86_400_000;

describe("floorDiv / mod (toward −∞)", () => {
    it("floors toward negative infinity", () => {
        expect(floorDiv(7, 2)).toBe(3);
        expect(floorDiv(-1, DAY_MS)).toBe(-1);
        expect(floorDiv(-DAY_MS, DAY_MS)).toBe(-1);
    });

    it("returns a non-negative modulo for negatives", () => {
        expect(mod(8, 7)).toBe(1);
        expect(mod(-1, 7)).toBe(6);
        expect(mod(-DAY_MS + 1, DAY_MS)).toBe(1);
    });
});

describe("civilFromDays", () => {
    it("maps day 0 to 1970-01-01", () => {
        expect(civilFromDays(0)).toEqual({ y: 1970, m: 1, d: 1 });
    });

    it("maps the day before the epoch to 1969-12-31", () => {
        expect(civilFromDays(-1)).toEqual({ y: 1969, m: 12, d: 31 });
    });

    it("resolves a leap day (2024-02-29)", () => {
        const z = daysFromCivil(2024, 2, 29);
        expect(civilFromDays(z)).toEqual({ y: 2024, m: 2, d: 29 });
    });

    it("resolves a far-future date past an era boundary", () => {
        expect(civilFromDays(daysFromCivil(2400, 3, 1))).toEqual({ y: 2400, m: 3, d: 1 });
    });
});

describe("daysFromCivil", () => {
    it("is the inverse of civilFromDays at the epoch", () => {
        expect(daysFromCivil(1970, 1, 1)).toBe(0);
    });

    it("round-trips a pre-epoch date", () => {
        expect(daysFromCivil(1969, 12, 31)).toBe(-1);
    });

    it("round-trips January (the m<=2 era shift branch)", () => {
        const z = daysFromCivil(2024, 1, 15);
        expect(civilFromDays(z)).toEqual({ y: 2024, m: 1, d: 15 });
    });
});

describe("splitEpoch", () => {
    it("splits 2024-01-02T13:45:30Z with no offset", () => {
        const ms = daysFromCivil(2024, 1, 2) * DAY_MS + (13 * 3600 + 45 * 60 + 30) * 1000;
        expect(splitEpoch(ms, 0)).toEqual({
            y: 2024,
            m: 1,
            d: 2,
            hh: 13,
            mm: 45,
            ss: 30,
            dow: 2, // Tuesday
        });
    });

    it("reports 1970-01-01 as Thursday (dow 4)", () => {
        expect(splitEpoch(0, 0).dow).toBe(4);
    });

    it("floors sub-second ms before splitting", () => {
        expect(splitEpoch(999, 0).ss).toBe(0);
    });

    it("applies a positive offset that crosses into the next day", () => {
        // 2024-01-02T23:30Z + 60min → 2024-01-03T00:30 local.
        const ms = daysFromCivil(2024, 1, 2) * DAY_MS + (23 * 3600 + 30 * 60) * 1000;
        const out = splitEpoch(ms, 60);
        expect(out.d).toBe(3);
        expect(out.hh).toBe(0);
        expect(out.dow).toBe(3); // Wednesday
    });

    it("applies a negative offset that wraps the date backwards", () => {
        // 2024-01-02T00:30Z − 60min → 2024-01-01T23:30 local.
        const ms = daysFromCivil(2024, 1, 2) * DAY_MS + 30 * 60 * 1000;
        const out = splitEpoch(ms, -60);
        expect(out.d).toBe(1);
        expect(out.hh).toBe(23);
        expect(out.dow).toBe(1); // Monday
    });

    it("splits a pre-epoch timestamp correctly", () => {
        const out = splitEpoch(-DAY_MS, 0);
        expect(out).toMatchObject({ y: 1969, m: 12, d: 31, hh: 0, mm: 0, ss: 0 });
    });
});
