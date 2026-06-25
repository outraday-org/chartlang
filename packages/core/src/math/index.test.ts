// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { avg, clamp, fixnan, math, na, nz, roundTo, roundToMintick, sign, sum } from "./index.js";

describe("math namespace", () => {
    it("exposes exactly the nine documented members", () => {
        expect(Object.keys(math).sort()).toEqual(
            [
                "avg",
                "clamp",
                "fixnan",
                "na",
                "nz",
                "roundTo",
                "roundToMintick",
                "sign",
                "sum",
            ].sort(),
        );
        expect(Object.isFrozen(math)).toBe(true);
    });

    it("routes members to the underlying helpers", () => {
        expect(math.roundTo(7.34, 0.25)).toBe(roundTo(7.34, 0.25));
        expect(math.clamp(12, 0, 10)).toBe(clamp(12, 0, 10));
    });
});

describe("roundTo / roundToMintick", () => {
    it("snaps to the nearest multiple of a positive step", () => {
        expect(roundTo(7.34, 0.25)).toBe(7.25);
        expect(roundToMintick(101.237, 0.01)).toBeCloseTo(101.24, 10);
    });

    it("returns the value unchanged for a non-positive or non-finite step", () => {
        expect(roundTo(5.5, 0)).toBe(5.5);
        expect(roundTo(5.5, -1)).toBe(5.5);
        expect(roundTo(5.5, Number.NaN)).toBe(5.5);
        expect(roundToMintick(5.5, 0)).toBe(5.5);
        expect(roundToMintick(5.5, Number.NaN)).toBe(5.5);
    });
});

describe("na", () => {
    it("treats NaN and ±Infinity as not-available, finite as available", () => {
        expect(na(Number.NaN)).toBe(true);
        expect(na(Number.POSITIVE_INFINITY)).toBe(true);
        expect(na(Number.NEGATIVE_INFINITY)).toBe(true);
        expect(na(1)).toBe(false);
        expect(na(0)).toBe(false);
    });
});

describe("nz", () => {
    it("coalesces non-finite to the replacement (default 0)", () => {
        expect(nz(Number.NaN)).toBe(0);
        expect(nz(Number.NaN, -1)).toBe(-1);
        expect(nz(Number.POSITIVE_INFINITY)).toBe(0);
        expect(nz(3.5)).toBe(3.5);
    });
});

describe("fixnan", () => {
    it("returns lastGood for a non-available value, else the value", () => {
        expect(fixnan(Number.NaN, 5)).toBe(5);
        expect(fixnan(Number.POSITIVE_INFINITY, 5)).toBe(5);
        expect(fixnan(2, 5)).toBe(2);
    });
});

describe("sign", () => {
    it("propagates NaN and preserves -0", () => {
        expect(sign(Number.NaN)).toBeNaN();
        expect(Object.is(sign(-0), -0)).toBe(true);
        expect(Object.is(sign(0), 0)).toBe(true);
        expect(sign(-3)).toBe(-1);
        expect(sign(3)).toBe(1);
    });
});

describe("clamp", () => {
    it("clamps below, within, and above the range", () => {
        expect(clamp(-5, 0, 10)).toBe(0);
        expect(clamp(4, 0, 10)).toBe(4);
        expect(clamp(12, 0, 10)).toBe(10);
    });
});

describe("avg", () => {
    it("averages finite values, skips non-finite, NaN on empty/all-non-finite", () => {
        expect(avg(2, 4, 6)).toBe(4);
        expect(avg(2, Number.NaN, 4)).toBe(3);
        expect(avg(Number.POSITIVE_INFINITY, 4)).toBe(4);
        expect(avg()).toBeNaN();
        expect(avg(Number.NaN, Number.POSITIVE_INFINITY)).toBeNaN();
    });

    it("coerces number-like views via Number() so a bar-field reduces by its current value", () => {
        // A `number & Series<number>` bar field is an object with `valueOf`,
        // not a primitive — `Number.isFinite` alone would skip it. The
        // Number() coercion is what makes math.avg(bar.high, …) work.
        const view = { valueOf: () => 5 } as unknown as number;
        expect(avg(view, 7)).toBe(6);
    });
});

describe("sum", () => {
    it("sums finite values, skips non-finite, NaN on empty/all-non-finite", () => {
        expect(sum(2, 4, 6)).toBe(12);
        expect(sum(2, Number.NaN, 4)).toBe(6);
        expect(sum(Number.POSITIVE_INFINITY, 4)).toBe(4);
        expect(sum()).toBeNaN();
        expect(sum(Number.NaN, Number.NEGATIVE_INFINITY)).toBeNaN();
    });

    it("coerces number-like views via Number() so a bar-field reduces by its current value", () => {
        const view = { valueOf: () => 5 } as unknown as number;
        expect(sum(view, 7)).toBe(12);
    });
});
