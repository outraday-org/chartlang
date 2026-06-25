// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { applyFormat, formatNumber, str } from "./index.js";

describe("str namespace", () => {
    it("exposes exactly the fourteen documented members and is frozen", () => {
        expect(Object.keys(str).sort()).toEqual(
            [
                "contains",
                "endsWith",
                "format",
                "length",
                "lower",
                "repeat",
                "replace",
                "replaceAll",
                "split",
                "startsWith",
                "substring",
                "tostring",
                "trim",
                "upper",
            ].sort(),
        );
        expect(Object.isFrozen(str)).toBe(true);
    });
});

describe("str.tostring", () => {
    it("formats numbers via the mask, passing through booleans and strings", () => {
        expect(str.tostring(12.349, "#.##")).toBe("12.35");
        expect(str.tostring(1234.5, "0.0000")).toBe("1234.5000");
        expect(str.tostring(42)).toBe("42");
        expect(str.tostring(true)).toBe("true");
        expect(str.tostring("abc")).toBe("abc");
    });

    it("renders the Pine non-finite glyphs and normalizes negative zero", () => {
        expect(str.tostring(Number.NaN)).toBe("NaN");
        expect(str.tostring(Number.POSITIVE_INFINITY)).toBe("∞");
        expect(str.tostring(Number.NEGATIVE_INFINITY)).toBe("-∞");
        expect(str.tostring(-0)).toBe("0");
    });
});

describe("formatNumber", () => {
    it("trims trailing zeros for a `#` fractional run", () => {
        expect(formatNumber(12.349, "#.##")).toBe("12.35");
        expect(formatNumber(3.1, "#.##")).toBe("3.1");
        expect(formatNumber(3, "#.##")).toBe("3");
        expect(formatNumber(-2.5, "#.##")).toBe("-2.5");
    });

    it("zero-pads to a fixed width for a `0` fractional run", () => {
        expect(formatNumber(1234.5, "0.0000")).toBe("1234.5000");
        expect(formatNumber(-1.2, "0.00")).toBe("-1.20");
    });

    it("treats a maskless call as String(value) with non-finite glyphs", () => {
        expect(formatNumber(42)).toBe("42");
        expect(formatNumber(-7.25)).toBe("-7.25");
        expect(formatNumber(Number.NaN)).toBe("NaN");
        expect(formatNumber(Number.POSITIVE_INFINITY)).toBe("∞");
        expect(formatNumber(Number.NEGATIVE_INFINITY)).toBe("-∞");
        expect(formatNumber(-0)).toBe("0");
    });

    it("ignores a mask with no fractional part", () => {
        expect(formatNumber(42.7, "#")).toBe("42.7");
        expect(formatNumber(42.7, "0")).toBe("42.7");
    });

    it("keeps integer zeros for a zero-width fractional run (trailing dot)", () => {
        // `toFixed(0)` produces no decimal point, so the trailing-zero trim
        // must not run — otherwise `"100"` would collapse to `"1"`.
        expect(formatNumber(100, "0.")).toBe("100");
        expect(formatNumber(100, "#.")).toBe("100");
        expect(formatNumber(150.6, ".")).toBe("151");
    });
});

describe("applyFormat", () => {
    it("substitutes positional placeholders", () => {
        expect(applyFormat("{0} / {1}", ["a", "b"])).toBe("a / b");
        expect(applyFormat("{1}-{0}", ["a", "b"])).toBe("b-a");
    });

    it("routes a numeric sub-mask through formatNumber", () => {
        expect(applyFormat("p={0,number,#.##}", [12.349])).toBe("p=12.35");
        expect(applyFormat("{0,number,0.0000}", [1234.5])).toBe("1234.5000");
    });

    it("leaves an out-of-range index intact (Pine parity)", () => {
        expect(applyFormat("{0} {1}", ["only"])).toBe("only {1}");
        expect(applyFormat("{2,number,#.##}", [1])).toBe("{2,number,#.##}");
    });

    it("unescapes doubled braces as literals", () => {
        expect(applyFormat("{{literal}} {0}", ["x"])).toBe("{literal} x");
        expect(applyFormat("{{}}", [])).toBe("{}");
    });
});

describe("str string helpers", () => {
    it("measures, searches, and tests prefixes/suffixes", () => {
        expect(str.length("abc")).toBe(3);
        expect(str.contains("abcdef", "cd")).toBe(true);
        expect(str.contains("abcdef", "zz")).toBe(false);
        expect(str.startsWith("abcdef", "abc")).toBe(true);
        expect(str.endsWith("abcdef", "def")).toBe(true);
    });

    it("replaces the first occurrence vs every occurrence", () => {
        expect(str.replace("a.b.c", ".", "-")).toBe("a-b.c");
        expect(str.replaceAll("a.b.c", ".", "-")).toBe("a-b-c");
    });

    it("splits, including on an empty separator", () => {
        expect(str.split("a,b,c", ",")).toEqual(["a", "b", "c"]);
        expect(str.split("ab", "")).toEqual(["a", "b"]);
    });

    it("substrings with and past the end", () => {
        expect(str.substring("abcdef", 1, 3)).toBe("bc");
        expect(str.substring("abcdef", 2)).toBe("cdef");
        expect(str.substring("abc", 1, 99)).toBe("bc");
    });

    it("upper / lower / trim", () => {
        expect(str.upper("ab")).toBe("AB");
        expect(str.lower("AB")).toBe("ab");
        expect(str.trim(" x ")).toBe("x");
    });

    it("repeat guards negative and fractional counts", () => {
        expect(str.repeat("-", 3)).toBe("---");
        expect(str.repeat("-", -1)).toBe("");
        expect(str.repeat("-", 2.9)).toBe("--");
        expect(str.repeat("-", 0)).toBe("");
    });
});
