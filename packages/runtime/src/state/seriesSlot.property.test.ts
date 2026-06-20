// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { Float64RingBuffer } from "../ringBuffer.js";
import { advanceSeriesSlot, commitSeriesSlot, createSeriesSlot } from "./seriesSlot.js";

type Step = {
    /** `null` means "this bar's compute does not write" → a NaN gap. */
    readonly write: number | null;
};

describe("series slot lifecycle (property)", () => {
    it("s[k] after each close equals the value written k committed bars ago", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 2, max: 12 }), // capacity
                fc.array(
                    fc.record({
                        write: fc.option(fc.double({ min: -1e6, max: 1e6, noNaN: true }), {
                            nil: null,
                        }),
                    }),
                    { minLength: 1, maxLength: 40 },
                ),
                (capacity, steps: ReadonlyArray<Step>) => {
                    const slot = createSeriesSlot(new Float64RingBuffer(capacity), 0);
                    // Reference: the committed head value of every closed bar, in
                    // close order. `null` models a NaN gap (skipped write).
                    const committed: Array<number | null> = [];

                    // Bar 0 = the allocation bar: it is seeded, then the first
                    // step's compute runs (it does NOT advance — only later
                    // closes advance pre-existing slots).
                    for (let i = 0; i < steps.length; i += 1) {
                        if (i > 0) advanceSeriesSlot(slot);
                        const step = steps[i];
                        if (step.write !== null) slot.view.value = step.write;
                        commitSeriesSlot(slot);
                        // Allocation bar seeds 0 when not written; later gaps are NaN.
                        committed.push(step.write === null ? (i === 0 ? 0 : null) : step.write);

                        // After this close, s[k] must equal the value committed k
                        // bars ago, within retained capacity.
                        for (let k = 0; k < committed.length; k += 1) {
                            const expected = committed[committed.length - 1 - k];
                            const actual = slot.view[k];
                            if (k >= capacity) {
                                // Past retained history → NaN (ring `at` contract).
                                expect(Number.isNaN(actual)).toBe(true);
                            } else if (expected === null) {
                                expect(Number.isNaN(actual)).toBe(true);
                            } else {
                                expect(actual).toBe(expected);
                            }
                        }
                    }
                    return true;
                },
            ),
        );
    });
});
