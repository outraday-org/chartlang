// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { DEFAULT_PALETTE } from "../palette.js";
import { MockCanvas2DContext } from "../testing.js";
import { drawFilledBand } from "./filledBand.js";

const UPPER = [
    { x: 0, y: 50 },
    { x: 10, y: 60 },
    { x: 20, y: 55 },
];

const LOWER = [
    { x: 0, y: 40 },
    { x: 10, y: 45 },
    { x: 20, y: 42 },
];

describe("drawFilledBand", () => {
    it("returns early when upper has no finite points", () => {
        const ctx = new MockCanvas2DContext();
        drawFilledBand(
            ctx,
            {
                upper: [
                    { x: 0, y: null },
                    { x: 10, y: Number.NaN },
                ],
                lower: LOWER,
                color: "#26a69a",
                alpha: 0.2,
            },
            DEFAULT_PALETTE,
        );
        expect(ctx.calls).toEqual([]);
    });

    it("returns early when lower has no finite points", () => {
        const ctx = new MockCanvas2DContext();
        drawFilledBand(
            ctx,
            {
                upper: UPPER,
                lower: [
                    { x: 0, y: null },
                    { x: 10, y: Number.POSITIVE_INFINITY },
                ],
                color: "#26a69a",
                alpha: 0.2,
            },
            DEFAULT_PALETTE,
        );
        expect(ctx.calls).toEqual([]);
    });

    it("emits the canonical fill sequence walking upper LTR and lower RTL", () => {
        const ctx = new MockCanvas2DContext();
        drawFilledBand(
            ctx,
            { upper: UPPER, lower: LOWER, color: "#26a69a", alpha: 0.25 },
            DEFAULT_PALETTE,
        );
        expect(ctx.calls).toEqual([
            { kind: "set", prop: "fillStyle", value: "#26a69a" },
            { kind: "set", prop: "globalAlpha", value: 0.25 },
            { kind: "beginPath" },
            { kind: "moveTo", x: 0, y: 50 }, // upper[0]
            { kind: "lineTo", x: 10, y: 60 }, // upper[1]
            { kind: "lineTo", x: 20, y: 55 }, // upper[2]
            { kind: "lineTo", x: 20, y: 42 }, // lower[2]
            { kind: "lineTo", x: 10, y: 45 }, // lower[1]
            { kind: "lineTo", x: 0, y: 40 }, // lower[0]
            { kind: "closePath" },
            { kind: "fill" },
            { kind: "set", prop: "globalAlpha", value: 1 },
        ]);
    });

    it("skips null / non-finite points on either boundary while preserving the polygon", () => {
        const ctx = new MockCanvas2DContext();
        drawFilledBand(
            ctx,
            {
                upper: [
                    { x: 0, y: 50 },
                    { x: 5, y: null }, // skipped
                    { x: 10, y: 60 },
                ],
                lower: [
                    { x: 0, y: 40 },
                    { x: 5, y: Number.NaN }, // skipped
                    { x: 10, y: 45 },
                ],
                color: "#26a69a",
                alpha: 0.2,
            },
            DEFAULT_PALETTE,
        );
        // Two upper points + two lower points = 1 moveTo + 3 lineTo.
        const moves = ctx.calls.filter((c) => c.kind === "moveTo").length;
        const lines = ctx.calls.filter((c) => c.kind === "lineTo").length;
        expect(moves).toBe(1);
        expect(lines).toBe(3);
    });

    it("falls back to palette.plotDefault when color is null", () => {
        const ctx = new MockCanvas2DContext();
        drawFilledBand(
            ctx,
            { upper: UPPER, lower: LOWER, color: null, alpha: 0.2 },
            DEFAULT_PALETTE,
        );
        const fill = ctx.calls.find((c) => c.kind === "set" && c.prop === "fillStyle");
        expect(fill).toEqual({
            kind: "set",
            prop: "fillStyle",
            value: DEFAULT_PALETTE.plotDefault,
        });
    });
});
