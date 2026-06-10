// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { fromGradient, hsl, rgb, withAlpha } from "./colorHelpers.js";
import { parseColor } from "./parseColor.js";

const parseableColor = fc
    .tuple(
        fc.integer({ min: 0, max: 255 }),
        fc.integer({ min: 0, max: 255 }),
        fc.integer({ min: 0, max: 255 }),
    )
    .map(([r, g, b]) => rgb(r, g, b));

describe("color helper property invariants", () => {
    it("fromGradient always returns a parseable color for parseable stops", () => {
        fc.assert(
            fc.property(fc.double({ noNaN: false }), parseableColor, parseableColor, (t, a, b) => {
                const out = fromGradient(t, [
                    { at: 0, color: a },
                    { at: 1, color: b },
                ]);
                expect(parseColor(out)).not.toBeNull();
            }),
            { numRuns: 100, seed: 13 },
        );
    });

    it("withAlpha is idempotent for parseable colors", () => {
        fc.assert(
            fc.property(parseableColor, fc.double({ noNaN: false }), (c, alpha) => {
                const once = withAlpha(c, alpha);
                const twice = withAlpha(once, alpha);
                expect(twice).toBe(once);
            }),
            { numRuns: 100, seed: 13 },
        );
    });

    it("rgb round-trips through parseColor", () => {
        fc.assert(
            fc.property(
                fc.double({ noNaN: false }),
                fc.double({ noNaN: false }),
                fc.double({ noNaN: false }),
                (r, g, b) => {
                    const parsed = parseColor(rgb(r, g, b));
                    expect(parsed).not.toBeNull();
                    if (parsed === null) return;
                    expect(parsed.r).toBeGreaterThanOrEqual(0);
                    expect(parsed.r).toBeLessThanOrEqual(255);
                    expect(parsed.g).toBeGreaterThanOrEqual(0);
                    expect(parsed.g).toBeLessThanOrEqual(255);
                    expect(parsed.b).toBeGreaterThanOrEqual(0);
                    expect(parsed.b).toBeLessThanOrEqual(255);
                },
            ),
            { numRuns: 100, seed: 13 },
        );
    });

    it("hsl round-trips through parseColor within byte ranges", () => {
        fc.assert(
            fc.property(
                fc.double({ noNaN: false }),
                fc.double({ noNaN: false }),
                fc.double({ noNaN: false }),
                (h, s, l) => {
                    const parsed = parseColor(hsl(h, s, l));
                    expect(parsed).not.toBeNull();
                    if (parsed === null) return;
                    expect(parsed.r).toBeGreaterThanOrEqual(0);
                    expect(parsed.r).toBeLessThanOrEqual(255);
                    expect(parsed.g).toBeGreaterThanOrEqual(0);
                    expect(parsed.g).toBeLessThanOrEqual(255);
                    expect(parsed.b).toBeGreaterThanOrEqual(0);
                    expect(parsed.b).toBeLessThanOrEqual(255);
                },
            ),
            { numRuns: 100, seed: 13 },
        );
    });
});
