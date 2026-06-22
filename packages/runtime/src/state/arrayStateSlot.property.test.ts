// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { ArrayStateSlot } from "./arrayStateSlot.js";

describe("ArrayStateSlot property", () => {
    it("after each close, get(0..size-1) equals the last min(total, capacity) committed values newest-first", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 16 }),
                fc.array(fc.array(fc.double({ noNaN: true }), { maxLength: 6 }), { maxLength: 30 }),
                (capacity, perBarPushes) => {
                    const slot = new ArrayStateSlot(capacity);
                    const reference: number[] = [];
                    for (const bar of perBarPushes) {
                        for (const value of bar) {
                            slot.handle.push(value);
                            reference.push(value);
                        }
                        slot.onBarClose();

                        const expectedWindow = reference.slice(-capacity);
                        expect(slot.handle.size).toBe(expectedWindow.length);
                        expect(slot.handle.size).toBeLessThanOrEqual(capacity);
                        // Newest-first: get(0) is the last reference value.
                        for (let n = 0; n < slot.handle.size; n += 1) {
                            expect(slot.handle.get(n)).toBe(
                                expectedWindow[expectedWindow.length - 1 - n],
                            );
                        }
                    }
                },
            ),
        );
    });

    it("a head-replacing tick always discards in-progress pushes", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 8 }),
                fc.array(fc.double({ noNaN: true }), { maxLength: 8 }),
                fc.array(fc.double({ noNaN: true }), { maxLength: 8 }),
                (capacity, committedPushes, tickPushes) => {
                    const slot = new ArrayStateSlot(capacity);
                    for (const v of committedPushes) slot.handle.push(v);
                    slot.onBarClose();
                    const committedSize = slot.handle.size;

                    for (const v of tickPushes) slot.handle.push(v);
                    slot.onBarTick();
                    expect(slot.handle.size).toBe(committedSize);
                },
            ),
        );
    });
});
