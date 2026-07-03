// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { MockCanvas2DContext } from "../testing.js";
import { type CandleArgs, drawCandle } from "./candle.js";
import type { Viewport } from "./coords.js";

// priceToY(p) === 100 - p under this viewport (yMin 0, yMax 100, pxHeight 100).
const VIEWPORT: Viewport = { xMin: 0, xMax: 10, yMin: 0, yMax: 100, pxWidth: 100, pxHeight: 100 };

function args(overrides: Partial<CandleArgs> = {}): CandleArgs {
    return {
        x: 50,
        open: 40,
        high: 60,
        low: 30,
        close: 50,
        bull: "#0f0",
        bear: "#f00",
        barCount: 10,
        ...overrides,
    };
}

describe("drawCandle", () => {
    it("paints a bullish candle: bull wick + body, min body-width 6px", () => {
        const ctx = new MockCanvas2DContext();
        drawCandle(ctx, args(), VIEWPORT);
        expect(ctx.calls).toEqual([
            { kind: "set", prop: "strokeStyle", value: "#0f0" },
            { kind: "beginPath" },
            { kind: "moveTo", x: 50, y: 40 },
            { kind: "lineTo", x: 50, y: 70 },
            { kind: "stroke" },
            { kind: "set", prop: "fillStyle", value: "#0f0" },
            { kind: "fillRect", x: 47, y: 50, w: 6, h: 10 },
        ]);
    });

    it("paints a bearish body with the bear color", () => {
        const ctx = new MockCanvas2DContext();
        drawCandle(ctx, args({ open: 50, close: 40 }), VIEWPORT);
        // open 50 > close 40 ⇒ bear; body spans openY 50 → closeY 60.
        expect(ctx.calls).toContainEqual({ kind: "set", prop: "fillStyle", value: "#f00" });
        expect(ctx.calls).toContainEqual({ kind: "fillRect", x: 47, y: 50, w: 6, h: 10 });
    });

    it("clamps a doji body to 1px and uses the doji color when set", () => {
        const doji = new MockCanvas2DContext();
        drawCandle(doji, args({ open: 40, close: 40, doji: "#999" }), VIEWPORT);
        // open === close ⇒ zero-height body clamped to 1px, doji fill.
        expect(doji.calls).toContainEqual({ kind: "set", prop: "fillStyle", value: "#999" });
        expect(doji.calls).toContainEqual({ kind: "fillRect", x: 47, y: 60, w: 6, h: 1 });

        const fallback = new MockCanvas2DContext();
        drawCandle(fallback, args({ open: 40, close: 40 }), VIEWPORT);
        // No doji color ⇒ falls back to bull.
        expect(fallback.calls).toContainEqual({ kind: "set", prop: "fillStyle", value: "#0f0" });
    });

    it("colors the wick with wickColor when set, else the body color", () => {
        const withWick = new MockCanvas2DContext();
        drawCandle(withWick, args({ wickColor: "#333" }), VIEWPORT);
        expect(withWick.calls[0]).toEqual({ kind: "set", prop: "strokeStyle", value: "#333" });

        const withoutWick = new MockCanvas2DContext();
        drawCandle(withoutWick, args(), VIEWPORT);
        expect(withoutWick.calls[0]).toEqual({ kind: "set", prop: "strokeStyle", value: "#0f0" });
    });

    it("strokes a body border when borderColor is set (and not otherwise)", () => {
        const bordered = new MockCanvas2DContext();
        drawCandle(bordered, args({ borderColor: "#123" }), VIEWPORT);
        expect(bordered.calls.slice(-4)).toEqual([
            { kind: "set", prop: "strokeStyle", value: "#123" },
            { kind: "beginPath" },
            { kind: "rect", x: 47, y: 50, w: 6, h: 10 },
            { kind: "stroke" },
        ]);

        const plain = new MockCanvas2DContext();
        drawCandle(plain, args(), VIEWPORT);
        expect(plain.calls.some((c) => c.kind === "rect")).toBe(false);
    });

    it("draws nothing for an all-null gap bar", () => {
        const ctx = new MockCanvas2DContext();
        drawCandle(ctx, args({ open: null, high: null, low: null, close: null }), VIEWPORT);
        expect(ctx.calls).toEqual([]);
    });

    it("draws nothing when any single OHLC field is null", () => {
        for (const gap of [
            { open: null },
            { high: null },
            { low: null },
            { close: null },
        ] as const) {
            const ctx = new MockCanvas2DContext();
            drawCandle(ctx, args(gap), VIEWPORT);
            expect(ctx.calls).toEqual([]);
        }
    });
});
