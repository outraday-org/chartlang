// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { arbBar } from "./__fixtures__/propertyHelpers.js";
import { harness } from "./__fixtures__/runPrimitive.js";
import { falling } from "./falling.js";
import { rising } from "./rising.js";

// Brute-force oracle over the closed close series: falling[t] iff each of the
// trailing `length` deltas is strictly negative and every windowed value is
// finite; false during warmup (t < length).
function referenceFalling(closes: ReadonlyArray<number>, length: number): boolean[] {
    return closes.map((_c, t) => {
        if (t < length) return false;
        for (let k = 1; k <= length; k += 1) {
            const newer = closes[t - k + 1];
            const older = closes[t - k];
            if (!Number.isFinite(newer) || !Number.isFinite(older)) return false;
            if (!(newer < older)) return false;
        }
        return true;
    });
}

describe("ta.falling — property invariants", () => {
    it("output length equals input length and every value is a boolean", () => {
        fc.assert(
            fc.property(
                fc.array(arbBar, { minLength: 5, maxLength: 60 }),
                fc.integer({ min: 1, max: 6 }),
                (bars, length) => {
                    const out = harness(
                        bars,
                        bars.length + 1,
                        (bar) => falling("slot", bar.close, length).current,
                    );
                    expect(out.length).toBe(bars.length);
                    for (const v of out) expect(typeof v).toBe("boolean");
                },
            ),
            { numRuns: 30 },
        );
    });

    it("the first `length` bars are always false (warmup)", () => {
        fc.assert(
            fc.property(
                fc.array(arbBar, { minLength: 10, maxLength: 50 }),
                fc.integer({ min: 1, max: 6 }),
                (bars, length) => {
                    const out = harness(
                        bars,
                        bars.length + 1,
                        (bar) => falling("slot", bar.close, length).current,
                    );
                    for (let i = 0; i < length && i < out.length; i += 1) {
                        expect(out[i]).toBe(false);
                    }
                },
            ),
            { numRuns: 30 },
        );
    });

    it("falling and rising are never both true on the same bar", () => {
        fc.assert(
            fc.property(
                fc.array(arbBar, { minLength: 10, maxLength: 50 }),
                fc.integer({ min: 1, max: 6 }),
                (bars, length) => {
                    const out = harness(bars, bars.length + 1, (bar) => ({
                        up: rising("up", bar.close, length).current,
                        down: falling("down", bar.close, length).current,
                    }));
                    for (const { up, down } of out) expect(up && down).toBe(false);
                },
            ),
            { numRuns: 30 },
        );
    });

    it("equals the brute-force monotonic reference", () => {
        fc.assert(
            fc.property(
                fc.array(arbBar, { minLength: 10, maxLength: 50 }),
                fc.integer({ min: 1, max: 6 }),
                (bars, length) => {
                    const out = harness(
                        bars,
                        bars.length + 1,
                        (bar) => falling("slot", bar.close, length).current,
                    );
                    const expected = referenceFalling(
                        bars.map((b: Bar) => b.close),
                        length,
                    );
                    expect(out).toEqual(expected);
                },
            ),
            { numRuns: 30 },
        );
    });
});
