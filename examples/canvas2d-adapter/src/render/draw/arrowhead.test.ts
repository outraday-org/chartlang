// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { MockCanvas2DContext } from "../../testing";
import { drawArrowhead } from "./arrowhead";

describe("drawArrowhead", () => {
    it("issues beginPath + moveTo(to) + 2 lineTo + closePath + fill", () => {
        const ctx = new MockCanvas2DContext();
        drawArrowhead(ctx, { x: 0, y: 0 }, { x: 100, y: 0 });
        const kinds = ctx.calls.map((c) => c.kind);
        expect(kinds).toEqual([
            "beginPath",
            "moveTo",
            "lineTo",
            "lineTo",
            "closePath",
            "fill",
        ]);
        const tip = ctx.calls[1];
        if (tip.kind === "moveTo") {
            expect(tip.x).toBe(100);
            expect(tip.y).toBe(0);
        }
    });

    it("places left + right wings symmetrically about the shaft axis", () => {
        const ctx = new MockCanvas2DContext();
        drawArrowhead(ctx, { x: 0, y: 0 }, { x: 100, y: 0 });
        const left = ctx.calls[2];
        const right = ctx.calls[3];
        if (left.kind === "lineTo" && right.kind === "lineTo") {
            // Horizontal shaft → wings mirror across y = 0.
            expect(left.x).toBeCloseTo(right.x);
            expect(left.y).toBeCloseTo(-right.y);
            // Both wings sit behind the tip (smaller x).
            expect(left.x).toBeLessThan(100);
            expect(right.x).toBeLessThan(100);
        }
    });

    it("respects a custom size", () => {
        const ctx = new MockCanvas2DContext();
        drawArrowhead(ctx, { x: 0, y: 0 }, { x: 100, y: 0 }, 16);
        const left = ctx.calls[2];
        const right = ctx.calls[3];
        if (left.kind === "lineTo" && right.kind === "lineTo") {
            // Larger size → wings sit further back from the tip.
            const wingDistFromTip = 100 - left.x;
            expect(wingDistFromTip).toBeGreaterThan(10);
        }
    });

    it("orients along an arbitrary shaft angle (vertical)", () => {
        const ctx = new MockCanvas2DContext();
        drawArrowhead(ctx, { x: 0, y: 0 }, { x: 0, y: 100 });
        const left = ctx.calls[2];
        const right = ctx.calls[3];
        if (left.kind === "lineTo" && right.kind === "lineTo") {
            // Vertical shaft → wings sit above the tip and mirror across x = 0.
            expect(left.y).toBeLessThan(100);
            expect(right.y).toBeLessThan(100);
            expect(left.x).toBeCloseTo(-right.x);
        }
    });
});
