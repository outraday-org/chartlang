// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { intervalToSeconds } from "./intervalToSeconds.js";

const multipliers = [
    ["s", 1],
    ["", 60],
    ["m", 60],
    ["H", 3_600],
    ["h", 3_600],
    ["D", 86_400],
    ["W", 604_800],
    ["M", 2_592_000],
    ["Y", 31_536_000],
] as const;

describe("intervalToSeconds properties", () => {
    it("matches the multiplier table", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 1_000 }),
                fc.constantFrom(...multipliers),
                (n, [suffix, multiplier]) => {
                    expect(
                        intervalToSeconds({ value: `${n}${suffix}`, label: "x", group: "x" }),
                    ).toBe(n * multiplier);
                },
            ),
            { seed: 42 },
        );
    });

    it("uses intervalSeconds regardless of value", () => {
        fc.assert(
            fc.property(fc.integer({ min: 1, max: 1_000 }), (n) => {
                expect(
                    intervalToSeconds({
                        value: "not-grammar",
                        label: "x",
                        group: "x",
                        intervalSeconds: n,
                    }),
                ).toBe(n);
            }),
            { seed: 43 },
        );
    });
});
