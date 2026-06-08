// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { nz } from "./nz";

describe("ta.nz", () => {
    it("returns the value unchanged when it is finite", () => {
        expect(nz(1.5)).toBe(1.5);
        expect(nz(-0.25)).toBe(-0.25);
    });

    it("returns 0 by default when value is NaN", () => {
        expect(nz(Number.NaN)).toBe(0);
    });

    it("returns the provided replacement when value is NaN", () => {
        expect(nz(Number.NaN, 42)).toBe(42);
        expect(nz(7, 42)).toBe(7);
        expect(nz(0, 42)).toBe(0);
    });

    it("does not coerce Infinity into the NaN branch", () => {
        expect(nz(Number.POSITIVE_INFINITY)).toBe(Number.POSITIVE_INFINITY);
        expect(nz(Number.NEGATIVE_INFINITY, 7)).toBe(Number.NEGATIVE_INFINITY);
    });

    it("uses 0 when replacement is explicitly undefined", () => {
        expect(nz(Number.NaN, undefined)).toBe(0);
    });

    it("does not need an active runtime context", () => {
        // Phase-1 primitives throw "called outside an active script step";
        // ta.nz is stateless and must not.
        expect(() => nz(Number.NaN, 0)).not.toThrow();
    });
});
