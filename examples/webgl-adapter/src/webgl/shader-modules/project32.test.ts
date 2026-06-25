// Ported from invinite src/components/trading-chart/webgl/shader-modules/project32.ts @ cd883292.
// WebGL2 renderer adapted to the chartlang Adapter/emission contract.
// "Translate, not transcribe": React/bus coupling dropped; world window
// comes from the shared ViewController, not invinite's frame-state.
//
// Pattern inspired by luma.gl's project module (MIT, Uber / vis.gl),
// re-implemented in-tree — NOT an npm dependency on luma.gl.

import { describe, expect, it } from "vitest";

import { PROJECT32_UNIFORMS, PROJECT32_VS_GLSL } from "./project32.js";

describe("PROJECT32_UNIFORMS", () => {
    it("declares the two uniforms the GLSL fragment uses", () => {
        expect([...PROJECT32_UNIFORMS]).toEqual(["uViewportSize", "uDpr"]);
    });
});

describe("PROJECT32_VS_GLSL", () => {
    it("declares the worldToSnappedNdc helper with its (worldPos, uProj) signature", () => {
        expect(PROJECT32_VS_GLSL).toContain("vec2 worldToSnappedNdc(vec2 worldPos, mat3 uProj)");
    });

    it("declares the dojiInflateNdcY helper", () => {
        expect(PROJECT32_VS_GLSL).toContain("float dojiInflateNdcY()");
    });

    it("declares the uniforms it consumes so the assembled shader compiles", () => {
        expect(PROJECT32_VS_GLSL).toContain("uniform vec2 uViewportSize;");

        expect(PROJECT32_VS_GLSL).toContain("uniform float uDpr;");
    });
});
