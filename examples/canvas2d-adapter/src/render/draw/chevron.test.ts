// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { MockCanvas2DContext } from "../../testing.js";
import { drawChevron } from "./chevron.js";

describe("drawChevron", () => {
    it("issues fillStyle set + beginPath + moveTo + 2 lineTo + closePath + fill", () => {
        const ctx = new MockCanvas2DContext();
        drawChevron(ctx, { x: 100, y: 100 }, "up", "#22c55e");
        const kinds = ctx.calls.map((c) => c.kind);
        expect(kinds).toEqual([
            "set",
            "beginPath",
            "moveTo",
            "lineTo",
            "lineTo",
            "closePath",
            "fill",
        ]);
        expect(ctx.calls[0]).toEqual({ kind: "set", prop: "fillStyle", value: "#22c55e" });
    });

    it("up: tip is above the anchor (smaller y)", () => {
        const ctx = new MockCanvas2DContext();
        drawChevron(ctx, { x: 100, y: 100 }, "up", "#22c55e");
        const tip = ctx.calls[2];
        if (tip.kind === "moveTo") {
            expect(tip.y).toBeLessThan(100);
        }
    });

    it("down: tip is below the anchor (larger y)", () => {
        const ctx = new MockCanvas2DContext();
        drawChevron(ctx, { x: 100, y: 100 }, "down", "#ef4444");
        const tip = ctx.calls[2];
        if (tip.kind === "moveTo") {
            expect(tip.y).toBeGreaterThan(100);
        }
    });

    it("up and down produce mirrored tip y-coordinates", () => {
        const ctxUp = new MockCanvas2DContext();
        const ctxDown = new MockCanvas2DContext();
        drawChevron(ctxUp, { x: 100, y: 100 }, "up", "#22c55e");
        drawChevron(ctxDown, { x: 100, y: 100 }, "down", "#ef4444");
        const tipUp = ctxUp.calls[2];
        const tipDown = ctxDown.calls[2];
        if (tipUp.kind === "moveTo" && tipDown.kind === "moveTo") {
            expect(100 - tipUp.y).toBeCloseTo(tipDown.y - 100);
        }
    });

    it("base corners sit symmetrically on either side of the anchor x", () => {
        const ctx = new MockCanvas2DContext();
        drawChevron(ctx, { x: 100, y: 100 }, "up", "#22c55e");
        const left = ctx.calls[3];
        const right = ctx.calls[4];
        if (left.kind === "lineTo" && right.kind === "lineTo") {
            expect(100 - left.x).toBeCloseTo(right.x - 100);
        }
    });

    it("respects custom baseWidth and height", () => {
        const ctx = new MockCanvas2DContext();
        drawChevron(ctx, { x: 100, y: 100 }, "up", "#22c55e", 20, 16);
        const tip = ctx.calls[2];
        const left = ctx.calls[3];
        if (tip.kind === "moveTo" && left.kind === "lineTo") {
            expect(100 - tip.y).toBe(8);
            expect(100 - left.x).toBe(10);
        }
    });
});
