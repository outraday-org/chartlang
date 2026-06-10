// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { priceToY, timeToX, yToPrice, type Viewport } from "./coords.js";

const viewport: Viewport = {
    xMin: 0,
    xMax: 10,
    yMin: 100,
    yMax: 110,
    pxWidth: 200,
    pxHeight: 100,
};

describe("priceToY / yToPrice", () => {
    it("maps yMax to y=0 and yMin to y=pxHeight", () => {
        expect(priceToY(110, viewport)).toBe(0);
        expect(priceToY(100, viewport)).toBe(100);
    });

    it("maps midpoint price to midpoint y", () => {
        expect(priceToY(105, viewport)).toBe(50);
    });

    it("round-trips through yToPrice for a deterministic random sample", () => {
        // Mulberry32 seeded for determinism — no Math.random.
        let s = 0x9e3779b9;
        function next(): number {
            s |= 0;
            s = (s + 0x6d2b79f5) | 0;
            let t = Math.imul(s ^ (s >>> 15), 1 | s);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
        }
        for (let i = 0; i < 50; i++) {
            const p = viewport.yMin + next() * (viewport.yMax - viewport.yMin);
            const round = yToPrice(priceToY(p, viewport), viewport);
            expect(round).toBeCloseTo(p, 9);
        }
    });
});

describe("timeToX", () => {
    it("maps xMin to 0 and xMax to pxWidth", () => {
        expect(timeToX(0, viewport)).toBe(0);
        expect(timeToX(10, viewport)).toBe(200);
    });

    it("maps midpoint time to midpoint x", () => {
        expect(timeToX(5, viewport)).toBe(100);
    });

    it("pins single-bar viewport to canvas centre", () => {
        const single: Viewport = { ...viewport, xMin: 7, xMax: 7 };
        expect(timeToX(7, single)).toBe(100);
        expect(timeToX(99, single)).toBe(100);
    });
});
