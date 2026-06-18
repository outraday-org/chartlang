// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { inputBarPoint } from "./inputBarPoint.js";

const TIME = 1_700_000_000_000;

describe("inputBarPoint", () => {
    it("resolves the current bar (offset 0) to the bar's own time", () => {
        expect(inputBarPoint(TIME)(0, 42)).toEqual({ time: TIME, price: 42 });
    });

    it("yields a NaN time for any non-zero offset", () => {
        const point = inputBarPoint(TIME);
        expect(Number.isNaN(point(-1, 5).time)).toBe(true);
        expect(Number.isNaN(point(3, 5).time)).toBe(true);
    });

    it("passes the price through unchanged including NaN", () => {
        const point = inputBarPoint(TIME);
        expect(point(0, 7).price).toBe(7);
        expect(point(-2, Number.NaN).price).toBeNaN();
    });
});
