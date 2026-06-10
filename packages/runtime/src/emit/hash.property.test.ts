// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { hashStringStable } from "./hash.js";

describe("hashStringStable — properties", () => {
    it("is deterministic: same input → same output across runs", () => {
        fc.assert(
            fc.property(fc.string(), (s) => {
                const a = hashStringStable(s);
                const b = hashStringStable(s);
                expect(a).toBe(b);
            }),
        );
    });

    it("always returns an 8-character lowercase hex string", () => {
        fc.assert(
            fc.property(fc.string(), (s) => {
                expect(hashStringStable(s)).toMatch(/^[0-9a-f]{8}$/);
            }),
        );
    });

    it("different concatenations produce different outputs in the common case", () => {
        // Not a strict injection — FNV-1a 32-bit has collisions — but for
        // distinct prefixes of equal length the hashes should differ
        // overwhelmingly often. Sample a small batch and require ≥ 80%
        // distinct.
        fc.assert(
            fc.property(
                fc.uniqueArray(fc.string({ minLength: 1, maxLength: 8 }), {
                    minLength: 10,
                    maxLength: 10,
                }),
                (xs) => {
                    const hashes = new Set(xs.map(hashStringStable));
                    expect(hashes.size).toBeGreaterThanOrEqual(8);
                },
            ),
        );
    });
});
