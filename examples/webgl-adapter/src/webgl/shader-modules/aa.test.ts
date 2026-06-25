// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

// Ported from invinite src/components/trading-chart/webgl/shader-modules/aa.test.ts @ cd883292.
// WebGL2 renderer adapted to the chartlang Adapter/emission contract.
// "Translate, not transcribe": React/bus coupling dropped; world window
// comes from the shared ViewController, not invinite's frame-state.
//
// Pattern inspired by luma.gl's vs-utils + deck.gl's IconLayer fragment
// shader (MIT, Uber / vis.gl), re-implemented in-tree — NOT an npm
// dependency on luma.gl / deck.gl.

import { describe, expect, it } from "vitest";

import * as AaModule from "./aa.js";
import { AA_FS_GLSL } from "./aa.js";

describe("AA_FS_GLSL", () => {
    it("declares disk_aa_alpha", () => {
        expect(AA_FS_GLSL).toContain("float disk_aa_alpha(vec2 localNorm)");
    });

    it("uses fwidth(r) for screen-space derivative of length", () => {
        expect(AA_FS_GLSL).toContain("fwidth(r)");
    });

    it("uses 1 - smoothstep(1 - aa, 1, r) for premultiplied edge alpha", () => {
        expect(AA_FS_GLSL).toContain("1.0 - smoothstep(1.0 - aa, 1.0, r)");
    });

    it("does not export a uniforms tuple (helper takes a parameter, not a uniform)", () => {
        expect(Object.keys(AaModule)).toEqual(["AA_FS_GLSL"]);
    });
});
