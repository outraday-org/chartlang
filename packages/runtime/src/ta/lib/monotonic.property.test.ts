// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { monotonic } from "./monotonic.js";

const arbFinite = fc.double({ min: 1, max: 1000, noNaN: true });
const arbLength = fc.integer({ min: 1, max: 8 });

// Brute-force oracle: every one of the trailing `length` consecutive
// deltas has the required strict sign, all slots finite, enough history.
function reference(window: ReadonlyArray<number>, length: number, dir: 1 | -1): boolean {
    if (length < 1 || window.length < length + 1) return false;
    for (let i = window.length - length - 1; i < window.length - 1; i += 1) {
        const a = window[i];
        const b = window[i + 1];
        if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
        if (dir === 1 ? !(b - a > 0) : !(b - a < 0)) return false;
    }
    return true;
}

describe("monotonic — property invariants", () => {
    it("matches the brute-force reference for both directions", () => {
        fc.assert(
            fc.property(
                fc.array(arbFinite, { minLength: 1, maxLength: 30 }),
                arbLength,
                fc.constantFrom<1 | -1>(1, -1),
                (values, length, dir) => {
                    const window = new Float64Array(values);
                    expect(monotonic(window, length, dir)).toBe(reference(values, length, dir));
                },
            ),
            { numRuns: 30 },
        );
    });

    it("rising and falling are never both true on the same window", () => {
        fc.assert(
            fc.property(
                fc.array(arbFinite, { minLength: 2, maxLength: 30 }),
                arbLength,
                (values, length) => {
                    const window = new Float64Array(values);
                    const up = monotonic(window, length, 1);
                    const down = monotonic(window, length, -1);
                    expect(up && down).toBe(false);
                },
            ),
            { numRuns: 30 },
        );
    });

    it("a strictly increasing ramp is rising and not falling", () => {
        fc.assert(
            fc.property(arbLength, fc.integer({ min: 0, max: 500 }), (length, offset) => {
                const window = new Float64Array(length + 1);
                for (let i = 0; i < window.length; i += 1) window[i] = offset + i;
                expect(monotonic(window, length, 1)).toBe(true);
                expect(monotonic(window, length, -1)).toBe(false);
            }),
            { numRuns: 20 },
        );
    });
});
