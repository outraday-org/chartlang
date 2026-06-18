// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { resolveBarPoint } from "./barPoint.js";
import { Float64RingBuffer } from "./ringBuffer.js";

// Build a time buffer whose newest bar (at(0)) is `times[times.length - 1]`.
function timeBuffer(times: readonly number[], capacity = times.length || 1): Float64RingBuffer {
    const buf = new Float64RingBuffer(capacity);
    for (const t of times) buf.append(t);
    return buf;
}

const BASE = 1_700_000_000_000;
const MIN = 60_000;

describe("resolveBarPoint", () => {
    it("offset 0 returns the current bar time and the passed price", () => {
        const buf = timeBuffer([BASE]);
        expect(resolveBarPoint(buf, "1m", BASE, 0, 42.5)).toEqual({ time: BASE, price: 42.5 });
    });

    it("offset 0 ignores the buffer entirely (current time wins)", () => {
        const buf = timeBuffer([]);
        expect(resolveBarPoint(buf, "1m", BASE, 0, 7)).toEqual({ time: BASE, price: 7 });
    });

    it("negative offset reads the real historical timestamp N bars back", () => {
        const buf = timeBuffer([BASE, BASE + MIN, BASE + 2 * MIN]);
        // at(0) = newest = BASE + 2m; -1 ⇒ at(1) = BASE + 1m; -2 ⇒ at(2) = BASE.
        expect(resolveBarPoint(buf, "1m", BASE + 2 * MIN, -1, 1).time).toBe(BASE + MIN);
        expect(resolveBarPoint(buf, "1m", BASE + 2 * MIN, -2, 1).time).toBe(BASE);
    });

    it("negative offset past retained history yields NaN time, never throws", () => {
        const buf = timeBuffer([BASE, BASE + MIN]);
        const wp = resolveBarPoint(buf, "1m", BASE + MIN, -50, 9);
        expect(Number.isNaN(wp.time)).toBe(true);
        expect(wp.price).toBe(9);
    });

    it("positive offset extrapolates by the median retained spacing", () => {
        // Even spacing of 1 minute ⇒ median delta = 60_000.
        const buf = timeBuffer([BASE, BASE + MIN, BASE + 2 * MIN, BASE + 3 * MIN]);
        const last = BASE + 3 * MIN;
        const wp = resolveBarPoint(buf, "1m", last, 5, 11);
        expect(wp.time).toBe(last + 5 * MIN);
        expect(wp.price).toBe(11);
    });

    it("positive offset uses the median (robust to a single irregular gap)", () => {
        // Deltas (newest→oldest): 60_000, 60_000, 600_000 ⇒ median 60_000.
        const buf = timeBuffer([BASE, BASE + 10 * MIN, BASE + 11 * MIN, BASE + 12 * MIN]);
        const last = BASE + 12 * MIN;
        expect(resolveBarPoint(buf, "1m", last, 1, 0).time).toBe(last + MIN);
    });

    it("positive offset averages the two middle deltas for an even count", () => {
        // Three deltas would be odd; use four bars ⇒ three deltas → still odd.
        // Two deltas (even): 60_000 and 120_000 ⇒ median = 90_000.
        const buf = timeBuffer([BASE, BASE + 2 * MIN, BASE + 3 * MIN]);
        const last = BASE + 3 * MIN;
        expect(resolveBarPoint(buf, "1m", last, 1, 0).time).toBe(last + 90_000);
    });

    it("positive offset falls back to the parsed interval when <2 bars retained", () => {
        const buf = timeBuffer([BASE]);
        // Only one bar ⇒ no delta ⇒ parse "1m" = 60s = 60_000ms.
        expect(resolveBarPoint(buf, "1m", BASE, 3, 0).time).toBe(BASE + 3 * MIN);
    });

    it("positive offset on an empty buffer falls back to the parsed interval", () => {
        const buf = timeBuffer([]);
        expect(resolveBarPoint(buf, "5m", BASE, 2, 0).time).toBe(BASE + 2 * 5 * MIN);
    });

    it("positive offset with an unparseable interval and <2 bars yields NaN time", () => {
        const buf = timeBuffer([BASE]);
        const wp = resolveBarPoint(buf, "not-an-interval", BASE, 4, 0);
        expect(Number.isNaN(wp.time)).toBe(true);
    });

    it("positive offset ignores non-finite deltas and falls back when none remain", () => {
        // Both retained times NaN ⇒ delta NaN ⇒ filtered out ⇒ interval fallback.
        const buf = timeBuffer([Number.NaN, Number.NaN]);
        expect(resolveBarPoint(buf, "1m", BASE, 1, 0).time).toBe(BASE + MIN);
    });

    it("passes NaN price through unchanged on every arm", () => {
        const buf = timeBuffer([BASE, BASE + MIN]);
        expect(resolveBarPoint(buf, "1m", BASE + MIN, 0, Number.NaN).price).toBeNaN();
        expect(resolveBarPoint(buf, "1m", BASE + MIN, -1, Number.NaN).price).toBeNaN();
        expect(resolveBarPoint(buf, "1m", BASE + MIN, 1, Number.NaN).price).toBeNaN();
    });
});
