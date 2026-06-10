// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { wilderStep } from "./wilderSmoothing.js";

describe("wilderStep", () => {
    it("returns prev when the sample equals prev", () => {
        expect(wilderStep(5, 5, 14)).toBe(5);
    });

    it("moves prev a 1/length fraction toward the sample", () => {
        const next = wilderStep(0, 14, 14);
        expect(next).toBe(1);
    });

    it("matches the Wilder recurrence form", () => {
        const prev = 12.5;
        const sample = 8;
        const length = 10;
        const expected = (prev * 9 + sample) / 10;
        expect(wilderStep(prev, sample, length)).toBeCloseTo(expected, 12);
    });
});
