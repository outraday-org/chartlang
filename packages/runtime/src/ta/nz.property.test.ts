// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { nz } from "./nz.js";

describe("ta.nz — property invariants", () => {
    it("returns the value unchanged for any finite double", () => {
        fc.assert(
            fc.property(fc.double({ noNaN: true }), (v) => {
                expect(nz(v)).toBe(v);
            }),
        );
    });

    it("returns the replacement for NaN regardless of replacement value", () => {
        fc.assert(
            fc.property(fc.double({ noNaN: true }), (replacement) => {
                expect(nz(Number.NaN, replacement)).toBe(replacement);
            }),
        );
    });

    it("is idempotent — nz(nz(v, r), r) === nz(v, r)", () => {
        fc.assert(
            fc.property(fc.double(), fc.double({ noNaN: true }), (v, r) => {
                expect(nz(nz(v, r), r)).toBe(nz(v, r));
            }),
        );
    });

    it("is deterministic — same inputs yield the same output", () => {
        fc.assert(
            fc.property(fc.double(), fc.double({ noNaN: true }), (v, r) => {
                expect(nz(v, r)).toBe(nz(v, r));
            }),
        );
    });
});
