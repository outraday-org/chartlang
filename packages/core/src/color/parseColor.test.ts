// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { COLOR_PALETTE, parseColor } from "./parseColor";

describe("parseColor", () => {
    it("parses short and long hex colors", () => {
        expect(parseColor("#0f8")).toEqual({ r: 0, g: 255, b: 136, a: 1 });
        expect(parseColor("#336699")).toEqual({ r: 51, g: 102, b: 153, a: 1 });
    });

    it("parses rgb and rgba colors with clamped channels", () => {
        expect(parseColor("rgb(255, 0, 128)")).toEqual({ r: 255, g: 0, b: 128, a: 1 });
        expect(parseColor("rgba(300, -2, 10.9, 0.5)")).toEqual({
            r: 255,
            g: 0,
            b: 10,
            a: 0.5,
        });
        expect(parseColor("rgba(1, 2, 3, 2)")).toEqual({ r: 1, g: 2, b: 3, a: 1 });
    });

    it("parses hsl and hsla colors", () => {
        expect(parseColor("hsl(0, 100%, 50%)")).toEqual({ r: 255, g: 0, b: 0, a: 1 });
        expect(parseColor("hsl(120, 0%, 50%)")).toEqual({
            r: 128,
            g: 128,
            b: 128,
            a: 1,
        });
        expect(parseColor("hsla(300, 100%, 50%, 0.25)")).toEqual({
            r: 255,
            g: 0,
            b: 255,
            a: 0.25,
        });
        expect(parseColor("hsla(60, 100%, 50%, -1)")).toEqual({
            r: 255,
            g: 255,
            b: 0,
            a: 0,
        });
        expect(parseColor("hsl(240, 100%, 25%)")).toEqual({
            r: 0,
            g: 0,
            b: 128,
            a: 1,
        });
    });

    it("short-circuits the named palette", () => {
        expect(COLOR_PALETTE.red).toBe("#ff0000");
        expect(parseColor("red")).toEqual({ r: 255, g: 0, b: 0, a: 1 });
    });

    it("returns null for unparseable input", () => {
        expect(parseColor("nope")).toBeNull();
        expect(parseColor("rgb(nope, 0, 0)")).toBeNull();
        expect(parseColor("rgba(0, 0, 0, nope)")).toBeNull();
        expect(parseColor("hsl(nope, 0%, 0%)")).toBeNull();
        expect(parseColor("hsla(0, 0%, 0%, nope)")).toBeNull();
    });
});
