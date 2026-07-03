// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { monotonic } from "./monotonic.js";

describe("monotonic", () => {
    it("rising (dir 1): every trailing step strictly positive → true", () => {
        expect(monotonic(new Float64Array([1, 2, 3]), 2, 1)).toBe(true);
        expect(monotonic(new Float64Array([10, 11, 12, 13]), 3, 1)).toBe(true);
    });

    it("falling (dir -1): every trailing step strictly negative → true", () => {
        expect(monotonic(new Float64Array([3, 2, 1]), 2, -1)).toBe(true);
        expect(monotonic(new Float64Array([13, 12, 11, 10]), 3, -1)).toBe(true);
    });

    it("equality breaks the run (non-strict is neither rising nor falling)", () => {
        expect(monotonic(new Float64Array([1, 2, 2]), 2, 1)).toBe(false);
        expect(monotonic(new Float64Array([2, 2, 1]), 2, -1)).toBe(false);
    });

    it("wrong direction → false", () => {
        expect(monotonic(new Float64Array([1, 2, 3]), 2, -1)).toBe(false);
        expect(monotonic(new Float64Array([3, 2, 1]), 2, 1)).toBe(false);
    });

    it("only the trailing `length` deltas are examined", () => {
        // Leading pair [5, 1] is descending, but the trailing 2 deltas
        // (1→2→3) are strictly rising.
        expect(monotonic(new Float64Array([5, 1, 2, 3]), 2, 1)).toBe(true);
    });

    it("a non-finite value inside the window → false", () => {
        expect(monotonic(new Float64Array([1, Number.NaN, 3]), 2, 1)).toBe(false);
        expect(monotonic(new Float64Array([1, 2, Number.POSITIVE_INFINITY]), 2, 1)).toBe(false);
    });

    it("insufficient history (window shorter than length + 1) → false", () => {
        expect(monotonic(new Float64Array([1, 2]), 3, 1)).toBe(false);
        expect(monotonic(new Float64Array([]), 1, -1)).toBe(false);
    });

    it("length < 1 → false", () => {
        expect(monotonic(new Float64Array([1, 2, 3]), 0, 1)).toBe(false);
    });
});
