// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { color, fromGradient, hsl, rgb, withAlpha } from "./index.js";
import { parseColor } from "./parseColor.js";

function expectRgbClose(actual: string, expected: Readonly<{ r: number; g: number; b: number }>) {
    const parsed = parseColor(actual);
    expect(parsed).not.toBeNull();
    if (parsed === null) return;
    expect(Math.abs(parsed.r - expected.r)).toBeLessThanOrEqual(1);
    expect(Math.abs(parsed.g - expected.g)).toBeLessThanOrEqual(1);
    expect(Math.abs(parsed.b - expected.b)).toBeLessThanOrEqual(1);
}

describe("color namespace", () => {
    it("exposes the named palette and dynamic helpers", () => {
        expect(color.red).toBe("#ff0000");
        expect(color.rgb(255, 0, 0)).toBe("rgb(255, 0, 0)");
        expect(color.hsl(0, 100, 50)).toBe("hsl(0, 100%, 50%)");
    });
});

describe("fromGradient", () => {
    it("returns transparent black for empty stops and the stop color for single-stop gradients", () => {
        expect(fromGradient(0.5, [])).toBe("rgba(0, 0, 0, 0)");
        expect(fromGradient(-1, [{ at: 0.25, color: "#336699" }])).toBe("#336699");
        expect(fromGradient(Number.NaN, [{ at: 0.25, color: "#336699" }])).toBe("#336699");
    });

    it("clamps out-of-range values to boundary stops", () => {
        const stops = [
            { at: 0, color: "#0000ff" },
            { at: 1, color: "#ff0000" },
        ];
        expect(fromGradient(-0.5, stops)).toBe("#0000ff");
        expect(fromGradient(1.5, stops)).toBe("#ff0000");
    });

    it("preserves exact endpoint values and blends midpoint components", () => {
        const stops = [
            { at: 0, color: "#0000ff" },
            { at: 1, color: "#ff0000" },
        ];
        expect(fromGradient(0, stops)).toBe("#0000ff");
        expect(fromGradient(1, stops)).toBe("#ff0000");
        expect(fromGradient(0.5, stops)).toBe("rgb(127, 0, 127)");
        expectRgbClose(fromGradient(0.5, stops), { r: 127, g: 0, b: 127 });
        expect(
            fromGradient(0.75, [
                { at: 0, color: "#0000ff" },
                { at: 0.5, color: "#00ff00" },
                { at: 1, color: "#ff0000" },
            ]),
        ).toBe("rgb(127, 127, 0)");
    });

    it("interpolates alpha and falls back to the previous color when a stop cannot parse", () => {
        const alphaStops = [
            { at: 0, color: "rgba(0, 0, 0, 0.25)" },
            { at: 1, color: "rgba(255, 255, 255, 0.75)" },
        ];
        expect(fromGradient(0.5, alphaStops)).toBe("rgba(127, 127, 127, 0.5)");
        expect(
            fromGradient(0.5, [
                { at: 0, color: "#000" },
                { at: 1, color: "bad" },
            ]),
        ).toBe("#000");
    });
});

describe("withAlpha", () => {
    it("overrides alpha and is idempotent", () => {
        const once = withAlpha("#ff0000", 0.5);
        expect(once).toBe("rgba(255, 0, 0, 0.5)");
        expect(withAlpha(once, 0.5)).toBe(once);
    });

    it("clamps alpha and preserves input for NaN or unparseable colors", () => {
        expect(withAlpha("#ff0000", -1)).toBe("rgba(255, 0, 0, 0)");
        expect(withAlpha("#ff0000", 2)).toBe("rgba(255, 0, 0, 1)");
        expect(withAlpha("#ff0000", Number.NaN)).toBe("#ff0000");
        expect(withAlpha("bad", 0.5)).toBe("bad");
    });
});

describe("rgb", () => {
    it("clamps channels and emits rgb or rgba based on alpha", () => {
        expect(rgb(255, 0, 0)).toBe("rgb(255, 0, 0)");
        expect(rgb(255, 0, 0, 0.5)).toBe("rgba(255, 0, 0, 0.5)");
        expect(rgb(255, 0, 0, 1)).toBe("rgba(255, 0, 0, 1)");
        expect(rgb(300, -1, Number.NaN, Number.NaN)).toBe("rgba(255, 0, 0, 0)");
    });
});

describe("hsl", () => {
    it("clamps channels and emits hsl or hsla based on alpha", () => {
        expect(hsl(0, 100, 50)).toBe("hsl(0, 100%, 50%)");
        expect(hsl(0, 100, 50, 0.5)).toBe("hsla(0, 100%, 50%, 0.5)");
        expect(hsl(360, 200, Number.NaN, Number.NaN)).toBe("hsla(359.999, 100%, 0%, 0)");
        expect(hsl(Number.NaN, 50, 50)).toBe("hsl(0, 50%, 50%)");
    });
});
