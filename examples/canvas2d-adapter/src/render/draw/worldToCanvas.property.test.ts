// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import { yToPrice, type Viewport } from "../coords";
import { worldPointToCanvas } from "./worldToCanvas";

const VIEW: Viewport = {
    xMin: 0,
    xMax: 100,
    yMin: 50,
    yMax: 150,
    pxWidth: 1_000,
    pxHeight: 500,
};

describe("worldPointToCanvas — property", () => {
    it("round-trips the price axis through priceToY ↔ yToPrice (1000 samples)", () => {
        for (let i = 0; i < 1000; i++) {
            const price = VIEW.yMin + (VIEW.yMax - VIEW.yMin) * (i / 999);
            const px = worldPointToCanvas({ time: VIEW.xMin, price }, VIEW);
            const recovered = yToPrice(px.y, VIEW);
            expect(recovered).toBeCloseTo(price, 9);
        }
    });

    it("produces strictly monotonic x for strictly increasing time", () => {
        let last = Number.NEGATIVE_INFINITY;
        for (let i = 0; i <= 200; i++) {
            const time = VIEW.xMin + (VIEW.xMax - VIEW.xMin) * (i / 200);
            const px = worldPointToCanvas({ time, price: VIEW.yMax }, VIEW);
            expect(px.x).toBeGreaterThanOrEqual(last);
            last = px.x;
        }
    });

    it("produces strictly anti-monotonic y for strictly increasing price (y axis flipped)", () => {
        let last = Number.POSITIVE_INFINITY;
        for (let i = 0; i <= 200; i++) {
            const price = VIEW.yMin + (VIEW.yMax - VIEW.yMin) * (i / 200);
            const px = worldPointToCanvas({ time: VIEW.xMin, price }, VIEW);
            expect(px.y).toBeLessThanOrEqual(last);
            last = px.y;
        }
    });
});
