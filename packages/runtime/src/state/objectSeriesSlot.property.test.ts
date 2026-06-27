// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { ObjectRingBuffer } from "../ringBuffer.js";
import {
    advanceObjectSeriesSlot,
    commitObjectSeriesSlot,
    createObjectSeriesSlot,
} from "./objectSeriesSlot.js";

type Step = {
    /** `null` means "this bar's compute does not write" → a default-filled gap. */
    readonly write: string | null;
};

describe("object series slot lifecycle (property)", () => {
    it("s[k] after each close equals the value written k committed bars ago, default otherwise", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 2, max: 12 }), // capacity
                fc.array(fc.record({ write: fc.option(fc.string(), { nil: null }) }), {
                    minLength: 1,
                    maxLength: 40,
                }),
                (capacity, steps: ReadonlyArray<Step>) => {
                    const slot = createObjectSeriesSlot(
                        new ObjectRingBuffer<string>(capacity, ""),
                        "",
                        "state.stringSeries",
                    );
                    // Reference: the committed head of every closed bar, in close
                    // order. A skipped write commits the default "" (the advance
                    // head on bar > 0, the seeded init on bar 0 — both "").
                    const committed: string[] = [];

                    for (let i = 0; i < steps.length; i += 1) {
                        if (i > 0) advanceObjectSeriesSlot(slot);
                        const step = steps[i];
                        if (step.write !== null) slot.view.value = step.write;
                        commitObjectSeriesSlot(slot);
                        committed.push(step.write ?? "");

                        for (let k = 0; k < committed.length; k += 1) {
                            const expected =
                                k >= capacity ? "" : committed[committed.length - 1 - k];
                            expect(slot.view[k]).toBe(expected);
                        }
                    }
                    return true;
                },
            ),
        );
    });
});
