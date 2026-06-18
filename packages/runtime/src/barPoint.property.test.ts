// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { resolveBarPoint } from "./barPoint.js";
import { Float64RingBuffer } from "./ringBuffer.js";

function bufferFrom(times: readonly number[]): Float64RingBuffer {
    const buf = new Float64RingBuffer(Math.max(1, times.length));
    for (const t of times) buf.append(t);
    return buf;
}

// Ascending finite timestamps, 0..16 bars, spacing in [1, 1e6] ms.
const ascendingTimes = fc
    .tuple(
        fc.integer({ min: 1_000_000_000_000, max: 2_000_000_000_000 }),
        fc.array(fc.integer({ min: 1, max: 1_000_000 }), { minLength: 0, maxLength: 16 }),
    )
    .map(([start, deltas]) => {
        const times = [start];
        for (const d of deltas) times.push(times[times.length - 1] + d);
        return times;
    });

const finitePrice = fc.double({ min: -1e9, max: 1e9, noNaN: true });

describe("resolveBarPoint properties", () => {
    it("offset 0 always returns the current bar time", () => {
        fc.assert(
            fc.property(ascendingTimes, finitePrice, (times, price) => {
                const wp = resolveBarPoint(
                    bufferFrom(times),
                    "1m",
                    times[times.length - 1],
                    0,
                    price,
                );
                expect(wp.time).toBe(times[times.length - 1]);
            }),
        );
    });

    it("passes any price through unchanged regardless of offset", () => {
        fc.assert(
            fc.property(
                ascendingTimes,
                finitePrice,
                fc.integer({ min: -30, max: 30 }),
                (times, price, offset) => {
                    const wp = resolveBarPoint(
                        bufferFrom(times),
                        "1m",
                        times[times.length - 1],
                        offset,
                        price,
                    );
                    expect(wp.price).toBe(price);
                },
            ),
        );
    });

    it("is deterministic — same inputs yield the same point", () => {
        fc.assert(
            fc.property(
                ascendingTimes,
                finitePrice,
                fc.integer({ min: -30, max: 30 }),
                (times, price, offset) => {
                    const last = times[times.length - 1];
                    const a = resolveBarPoint(bufferFrom(times), "1m", last, offset, price);
                    const b = resolveBarPoint(bufferFrom(times), "1m", last, offset, price);
                    expect(a).toEqual(b);
                },
            ),
        );
    });

    it("a negative offset deeper than retained history yields NaN time", () => {
        fc.assert(
            fc.property(ascendingTimes, finitePrice, (times, price) => {
                const oob = times.length + 1; // strictly beyond the retained count
                const wp = resolveBarPoint(
                    bufferFrom(times),
                    "1m",
                    times[times.length - 1],
                    -oob,
                    price,
                );
                expect(Number.isNaN(wp.time)).toBe(true);
            }),
        );
    });

    it("a positive offset extrapolates a time strictly after the last bar", () => {
        fc.assert(
            fc.property(
                ascendingTimes,
                finitePrice,
                fc.integer({ min: 1, max: 30 }),
                (times, price, offset) => {
                    const last = times[times.length - 1];
                    const wp = resolveBarPoint(bufferFrom(times), "1m", last, offset, price);
                    // Spacing is positive (ascending times) or the positive parsed
                    // interval fallback, so the future time exceeds the last bar.
                    expect(wp.time).toBeGreaterThan(last);
                },
            ),
        );
    });
});
