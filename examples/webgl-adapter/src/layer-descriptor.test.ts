// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

// Ported from invinite src/components/trading-chart/webgl/colors.test.ts @ cd883292.
// WebGL2 renderer adapted to the chartlang Adapter/emission contract.
// "Translate, not transcribe": React/bus coupling dropped; world window
// comes from the shared ViewController, not invinite's frame-state.

import type { Bar } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import {
    DEFAULT_PALETTE,
    cssColorToRgbaUnit,
    hexToRgbaUnit,
    isBullish,
    resolvePaintColor,
} from "./layer-descriptor.js";

function bar(open: number, close: number): Bar {
    return { time: 0, open, high: Math.max(open, close), low: Math.min(open, close), close };
}

describe("DEFAULT_PALETTE", () => {
    it("carries the canonical invinite bull / bear hex values", () => {
        expect(DEFAULT_PALETTE.candleBullBody).toBe("#26a69a");
        expect(DEFAULT_PALETTE.candleBearBody).toBe("#ef5350");
    });

    it("is frozen so a consumer cannot mutate the shared default", () => {
        expect(Object.isFrozen(DEFAULT_PALETTE)).toBe(true);
    });

    it("declares every mandatory slot (mirrors the canvas2d Palette shape)", () => {
        expect(Object.keys(DEFAULT_PALETTE).sort()).toEqual(
            [
                "alertCritical",
                "alertInfo",
                "alertWarning",
                "background",
                "candleBearBody",
                "candleBullBody",
                "candleWick",
                "gridLine",
                "paneBorder",
                "plotDefault",
            ].sort(),
        );
    });
});

describe("hexToRgbaUnit", () => {
    it("maps a 6-digit hex to [0, 1] components", () => {
        const [r, g, b, a] = hexToRgbaUnit("#26a69a", 1);
        expect(r).toBeCloseTo(38 / 255);
        expect(g).toBeCloseTo(166 / 255);
        expect(b).toBeCloseTo(154 / 255);
        expect(a).toBe(1);
    });

    it("defaults alpha to 1 and clamps an out-of-range alpha", () => {
        expect(hexToRgbaUnit("#ffffff")[3]).toBe(1);
        expect(hexToRgbaUnit("#ffffff", 2)[3]).toBe(1);
        expect(hexToRgbaUnit("#ffffff", -1)[3]).toBe(0);
    });

    it("expands a 3-digit short hex", () => {
        expect(hexToRgbaUnit("#fff", 1)).toEqual([1, 1, 1, 1]);
        const [r, g, b] = hexToRgbaUnit("#f00", 1);
        expect([r, g, b]).toEqual([1, 0, 0]);
    });

    it("ignores any alpha implied by an 8-digit hex (the alpha arg wins)", () => {
        // The rgb is read from the first 6 digits; the supplied alpha overrides.
        const [r, g, b, a] = hexToRgbaUnit("#11223380", 0.5);
        expect(r).toBeCloseTo(0x11 / 255);
        expect(g).toBeCloseTo(0x22 / 255);
        expect(b).toBeCloseTo(0x33 / 255);
        expect(a).toBe(0.5);
    });

    it("falls back to opaque-ish black on a non-# or malformed string (no NaN)", () => {
        expect(hexToRgbaUnit("rgb(1,2,3)", 1)).toEqual([0, 0, 0, 1]);
        expect(hexToRgbaUnit("", 0.3)).toEqual([0, 0, 0, 0.3]);
        const malformed = hexToRgbaUnit("#zzzzzz", 1);
        expect(malformed.some((c) => Number.isNaN(c))).toBe(false);
        expect(malformed).toEqual([0, 0, 0, 1]);
    });
});

describe("cssColorToRgbaUnit", () => {
    it("parses an rgb() string (the `color.rgb(...)` emission form)", () => {
        const [r, g, b, a] = cssColorToRgbaUnit("rgb(207, 176, 102)");
        expect(r).toBeCloseTo(207 / 255);
        expect(g).toBeCloseTo(176 / 255);
        expect(b).toBeCloseTo(102 / 255);
        expect(a).toBe(1);
    });

    it("parses an rgba() string and multiplies the arg alpha by the string alpha", () => {
        expect(cssColorToRgbaUnit("rgba(255, 0, 0, 0.5)")).toEqual([1, 0, 0, 0.5]);
        expect(cssColorToRgbaUnit("rgba(255, 0, 0, 0.5)", 0.5)[3]).toBeCloseTo(0.25);
    });

    it("parses an hsl() string via the hue formula", () => {
        // hsl(0, 100%, 50%) is pure red.
        const [r, g, b] = cssColorToRgbaUnit("hsl(0, 100%, 50%)");
        expect(r).toBeCloseTo(1);
        expect(g).toBeCloseTo(0);
        expect(b).toBeCloseTo(0);
    });

    it("HONOURS the #rrggbbaa / #rgba alpha byte (unlike hexToRgbaUnit)", () => {
        // The transparent guide colour `#86868600` must come through alpha 0.
        expect(cssColorToRgbaUnit("#86868600")[3]).toBe(0);
        expect(cssColorToRgbaUnit("#ff000080")[3]).toBeCloseTo(128 / 255);
        expect(cssColorToRgbaUnit("#f00f")).toEqual([1, 0, 0, 1]); // #rgba short form
        // A plain 6-digit hex carries no alpha → the arg wins.
        expect(cssColorToRgbaUnit("#26a69a", 0.5)[3]).toBe(0.5);
    });

    it("falls back to opaque black on a malformed / unknown string (no NaN)", () => {
        expect(cssColorToRgbaUnit("nope", 0.3)).toEqual([0, 0, 0, 0.3]);
        expect(cssColorToRgbaUnit("rgb(a, b, c)", 1)).toEqual([0, 0, 0, 1]);
        const out = cssColorToRgbaUnit("rgb(1, 2, 3)");
        expect(out.some((c) => Number.isNaN(c))).toBe(false);
    });
});

describe("isBullish", () => {
    it("is true when close >= open (a doji counts bullish, matching the source)", () => {
        expect(isBullish(bar(10, 12))).toBe(true);
        expect(isBullish(bar(10, 10))).toBe(true);
    });

    it("is false when close < open", () => {
        expect(isBullish(bar(12, 10))).toBe(false);
    });
});

describe("resolvePaintColor (3-state colorValue precedence)", () => {
    it("omitted ⇒ static color, falling back to the plot default", () => {
        expect(resolvePaintColor(undefined, "#abc", "#def")).toBe("#abc");
        expect(resolvePaintColor(undefined, null, "#def")).toBe("#def");
    });

    it("present ⇒ the override wins over the static color", () => {
        expect(resolvePaintColor("#111", "#abc", "#def")).toBe("#111");
    });

    it("null ⇒ an explicit paint-nothing gap (distinct from omitted)", () => {
        expect(resolvePaintColor(null, "#abc", "#def")).toBeNull();
    });
});
