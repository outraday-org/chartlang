// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { type InteractionViewport, pxToWorldX, worldXPerPx } from "./interaction.js";

const view: InteractionViewport = { xMin: 0, xMax: 100, pxWidth: 800 };

describe("pxToWorldX", () => {
    it("maps a pixel x into the world window", () => {
        expect(pxToWorldX(view, 0)).toBe(0);
        expect(pxToWorldX(view, 400)).toBe(50);
        expect(pxToWorldX(view, 800)).toBe(100);
    });

    it("offsets by xMin for a shifted window", () => {
        expect(pxToWorldX({ xMin: 1000, xMax: 2000, pxWidth: 100 }, 50)).toBe(1500);
    });

    it("returns xMin for a zero-width viewport (no divide-by-zero)", () => {
        expect(pxToWorldX({ xMin: 7, xMax: 9, pxWidth: 0 }, 50)).toBe(7);
    });
});

describe("worldXPerPx", () => {
    it("returns the world-per-pixel scale", () => {
        expect(worldXPerPx(view)).toBeCloseTo(0.125, 10);
    });

    it("returns 0 for a zero-width viewport", () => {
        expect(worldXPerPx({ xMin: 0, xMax: 100, pxWidth: 0 })).toBe(0);
    });
});
