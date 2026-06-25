// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { applyFormat, formatNumber } from "./strHelpers.js";

const finite = fc.double({ noNaN: true, noDefaultInfinity: true, min: -1e6, max: 1e6 });

describe("str helper property invariants", () => {
    it("formatNumber(x, '0.0000') round-trips through Number(...) within 5e-5", () => {
        fc.assert(
            fc.property(finite, (value) => {
                const text = formatNumber(value, "0.0000");
                expect(Math.abs(Number(text) - value)).toBeLessThanOrEqual(5e-5);
            }),
            { numRuns: 100, seed: 13 },
        );
    });

    it("applyFormat with all-distinct args never drops a provided arg", () => {
        fc.assert(
            fc.property(
                fc.uniqueArray(fc.string({ minLength: 3, maxLength: 8 }), {
                    minLength: 1,
                    maxLength: 8,
                }),
                (args) => {
                    const template = args.map((_, index) => `{${index}}`).join("|");
                    const out = applyFormat(template, args);
                    for (const arg of args) {
                        expect(out).toContain(arg);
                    }
                },
            ),
            { numRuns: 100, seed: 13 },
        );
    });
});
