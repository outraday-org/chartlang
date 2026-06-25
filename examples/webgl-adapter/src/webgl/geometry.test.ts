// Ported from invinite src/components/trading-chart/webgl/geometry.test.ts @ cd883292.
// WebGL2 renderer adapted to the chartlang Adapter/emission contract.
// "Translate, not transcribe": React/bus coupling dropped; world window
// comes from the shared ViewController, not invinite's frame-state.

import { describe, expect, it } from "vitest";

import { UNIT_QUAD_TRIANGLE_STRIP, Y_ZERO_QUAD_TRIANGLE_STRIP } from "./geometry.js";

describe("UNIT_QUAD_TRIANGLE_STRIP", () => {
    it("encodes a 4-corner unit quad in [-1..+1] triangle-strip order", () => {
        expect(UNIT_QUAD_TRIANGLE_STRIP).toBeInstanceOf(Float32Array);

        expect(UNIT_QUAD_TRIANGLE_STRIP.length).toBe(8);

        // bottom-left, bottom-right, top-left, top-right
        expect(Array.from(UNIT_QUAD_TRIANGLE_STRIP)).toEqual([-1, -1, 1, -1, -1, 1, 1, 1]);
    });

    it("is exposed as a Float32Array view (not freezable in V8 — read-only by convention)", () => {
        expect(ArrayBuffer.isView(UNIT_QUAD_TRIANGLE_STRIP)).toBe(true);
    });
});

describe("Y_ZERO_QUAD_TRIANGLE_STRIP", () => {
    it("encodes a quad anchored at y=0 (used by vertical bars)", () => {
        expect(Y_ZERO_QUAD_TRIANGLE_STRIP).toBeInstanceOf(Float32Array);

        expect(Y_ZERO_QUAD_TRIANGLE_STRIP.length).toBe(8);

        expect(Array.from(Y_ZERO_QUAD_TRIANGLE_STRIP)).toEqual([-1, 0, 1, 0, -1, 1, 1, 1]);
    });

    it("is exposed as a Float32Array view (not freezable in V8 — read-only by convention)", () => {
        expect(ArrayBuffer.isView(Y_ZERO_QUAD_TRIANGLE_STRIP)).toBe(true);
    });
});
