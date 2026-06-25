// Ported from invinite src/components/trading-chart/webgl/shader-modules/nan-skip.ts @ cd883292.
// WebGL2 renderer adapted to the chartlang Adapter/emission contract.
// "Translate, not transcribe": React/bus coupling dropped; world window
// comes from the shared ViewController, not invinite's frame-state.
//
// Pattern inspired by luma.gl's project module (MIT, Uber / vis.gl),
// re-implemented in-tree — NOT an npm dependency on luma.gl.

import { describe, expect, it } from "vitest";

import * as NanSkipModule from "./nan-skip.js";
import { NAN_SKIP_VS_GLSL } from "./nan-skip.js";

describe("NAN_SKIP_VS_GLSL", () => {
    it("declares the nan_skip_segmentInvalid predicate", () => {
        expect(NAN_SKIP_VS_GLSL).toContain("bool nan_skip_segmentInvalid(vec2 a, vec2 b)");
    });

    it("declares the nan_skip_neighborInvalid predicate", () => {
        expect(NAN_SKIP_VS_GLSL).toContain(
            "bool nan_skip_neighborInvalid(vec2 neighborPos, vec2 neighborRef)",
        );
    });

    it("uses isnan(...) to test for NaN endpoints", () => {
        expect(NAN_SKIP_VS_GLSL).toContain("isnan(a)");

        expect(NAN_SKIP_VS_GLSL).toContain("isnan(b)");
    });

    it("exports only the GLSL string (no uniforms tuple — the predicates take parameters)", () => {
        expect(Object.keys(NanSkipModule)).toEqual(["NAN_SKIP_VS_GLSL"]);
    });
});
