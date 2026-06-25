// Ported from invinite src/components/trading-chart/webgl/projection.test.ts @ cd883292.
// WebGL2 renderer adapted to the chartlang Adapter/emission contract.
// "Translate, not transcribe": React/bus coupling dropped; world window
// comes from the shared ViewController, not invinite's frame-state.

import { describe, expect, it } from "vitest";

import { ortho2d } from "./projection.js";

function applyOrtho(matrix: Float32Array, x: number, y: number): { ndcX: number; ndcY: number } {
    // Column-major layout: [sx, 0, 0,  0, sy, 0,  tx, ty, 1]
    const sx = matrix[0];

    const sy = matrix[4];

    const tx = matrix[6];

    const ty = matrix[7];

    return { ndcX: sx * x + tx, ndcY: sy * y + ty };
}

describe("ortho2d", () => {
    it("maps the symmetric (-1, -1) – (1, 1) world to identity NDC", () => {
        const matrix = ortho2d(-1, 1, -1, 1);

        // sx = sy = 1, tx = ty = 0
        expect(matrix[0]).toBeCloseTo(1);

        expect(matrix[4]).toBeCloseTo(1);

        expect(matrix[6]).toBeCloseTo(0);

        expect(matrix[7]).toBeCloseTo(0);

        expect(matrix[8]).toBe(1);

        const corner = applyOrtho(matrix, 1, 1);

        expect(corner.ndcX).toBeCloseTo(1);

        expect(corner.ndcY).toBeCloseTo(1);
    });

    it("maps an asymmetric world rect onto NDC corners", () => {
        const matrix = ortho2d(0, 100, 0, 50);

        const bottomLeft = applyOrtho(matrix, 0, 0);

        expect(bottomLeft.ndcX).toBeCloseTo(-1);

        expect(bottomLeft.ndcY).toBeCloseTo(-1);

        const topRight = applyOrtho(matrix, 100, 50);

        expect(topRight.ndcX).toBeCloseTo(1);

        expect(topRight.ndcY).toBeCloseTo(1);

        const center = applyOrtho(matrix, 50, 25);

        expect(center.ndcX).toBeCloseTo(0);

        expect(center.ndcY).toBeCloseTo(0);
    });

    it("round-trips a sample point world → ndc → world exactly", () => {
        const left = -25;

        const right = 175;

        const bottom = 10;

        const top = 90;

        const matrix = ortho2d(left, right, bottom, top);

        const sx = matrix[0];

        const sy = matrix[4];

        const tx = matrix[6];

        const ty = matrix[7];

        const worldX = 42;

        const worldY = 73;

        const ndcX = sx * worldX + tx;

        const ndcY = sy * worldY + ty;

        const recoveredX = (ndcX - tx) / sx;

        const recoveredY = (ndcY - ty) / sy;

        expect(recoveredX).toBeCloseTo(worldX, 10);

        expect(recoveredY).toBeCloseTo(worldY, 10);
    });

    it("returns a Float32Array of length 9", () => {
        const matrix = ortho2d(0, 1, 0, 1);

        expect(matrix).toBeInstanceOf(Float32Array);

        expect(matrix.length).toBe(9);
    });

    it("clamps degenerate equal bounds to a finite matrix (no NaN / Infinity)", () => {
        // Both axes collapsed: left === right AND bottom === top. The
        // epsilon clamp keeps every entry finite instead of dividing by
        // zero (the chartlang-contract hardening over the pinned source).
        const matrix = ortho2d(5, 5, 7, 7);

        for (const value of matrix) {
            expect(Number.isFinite(value)).toBe(true);
        }

        // A degenerate x-span with a healthy y-span only clamps x.
        const partial = ortho2d(3, 3, 0, 50);

        for (const value of partial) {
            expect(Number.isFinite(value)).toBe(true);
        }

        // The healthy y-axis still projects exactly.
        const bottom = applyOrtho(partial, 0, 0);

        expect(bottom.ndcY).toBeCloseTo(-1);

        const topEdge = applyOrtho(partial, 0, 50);

        expect(topEdge.ndcY).toBeCloseTo(1);
    });
});
