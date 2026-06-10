// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { DEFAULT_PALETTE } from "../palette.js";
import { MockCanvas2DContext } from "../testing.js";
import { drawBars } from "./bars.js";

describe("drawBars", () => {
    it("emits one fillStyle set + one 1 px wide fillRect", () => {
        const ctx = new MockCanvas2DContext();
        drawBars(ctx, { x: 100, y: 40, baseline: 80, color: "#26a69a" }, DEFAULT_PALETTE);
        expect(ctx.calls).toEqual([
            { kind: "set", prop: "fillStyle", value: "#26a69a" },
            { kind: "fillRect", x: 99.5, y: 40, w: 1, h: 40 },
        ]);
    });

    it("rounds x before centring so adjacent integer-x columns land on adjacent pixels", () => {
        const ctxA = new MockCanvas2DContext();
        drawBars(ctxA, { x: 100.4, y: 0, baseline: 10, color: null }, DEFAULT_PALETTE);
        const ctxB = new MockCanvas2DContext();
        drawBars(ctxB, { x: 100.6, y: 0, baseline: 10, color: null }, DEFAULT_PALETTE);
        const rectA = ctxA.calls.find((c) => c.kind === "fillRect");
        const rectB = ctxB.calls.find((c) => c.kind === "fillRect");
        expect(rectA).toEqual({ kind: "fillRect", x: 99.5, y: 0, w: 1, h: 10 });
        expect(rectB).toEqual({ kind: "fillRect", x: 100.5, y: 0, w: 1, h: 10 });
    });

    it("flips the rectangle when y is below baseline (negative bar)", () => {
        const ctx = new MockCanvas2DContext();
        drawBars(ctx, { x: 50, y: 100, baseline: 60, color: "#ef5350" }, DEFAULT_PALETTE);
        const rect = ctx.calls.find((c) => c.kind === "fillRect");
        expect(rect).toEqual({ kind: "fillRect", x: 49.5, y: 60, w: 1, h: 40 });
    });

    it("falls back to palette.plotDefault when color is null", () => {
        const ctx = new MockCanvas2DContext();
        drawBars(ctx, { x: 5, y: 0, baseline: 10, color: null }, DEFAULT_PALETTE);
        const setFill = ctx.calls.find((c) => c.kind === "set" && c.prop === "fillStyle");
        expect(setFill).toEqual({
            kind: "set",
            prop: "fillStyle",
            value: DEFAULT_PALETTE.plotDefault,
        });
    });
});
