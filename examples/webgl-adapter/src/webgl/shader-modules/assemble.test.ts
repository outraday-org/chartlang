// Ported from invinite src/components/trading-chart/webgl/shader-modules/assemble.test.ts @ cd883292.
// WebGL2 renderer adapted to the chartlang Adapter/emission contract.
// "Translate, not transcribe": React/bus coupling dropped; world window
// comes from the shared ViewController, not invinite's frame-state.

import { describe, expect, it } from "vitest";

import { assembleFragmentShader, assembleVertexShader } from "./assemble.js";

describe("assembleVertexShader", () => {
    it("prepends #version + precision", () => {
        const out = assembleVertexShader({ body: "void main() {}", modules: [] });

        expect(out).toContain("#version 300 es");

        expect(out).toContain("precision highp float;");
    });

    it("concatenates modules between header and body", () => {
        const out = assembleVertexShader({
            body: "void main() { uA; helper(); }",
            modules: ["uniform float uA;", "vec3 helper() { return vec3(0.0); }"],
        });

        expect(out.indexOf("uA")).toBeLessThan(out.indexOf("helper"));

        expect(out.indexOf("helper")).toBeLessThan(out.indexOf("void main"));
    });
});

describe("assembleFragmentShader", () => {
    it("prepends #version + mediump precision and concatenates modules before body", () => {
        const out = assembleFragmentShader({
            body: "void main() { fragColor = vec4(uColor, 1.0); }",
            modules: ["uniform vec3 uColor;"],
        });

        expect(out).toContain("#version 300 es");

        expect(out).toContain("precision mediump float;");

        expect(out.indexOf("uColor")).toBeLessThan(out.indexOf("void main"));
    });
});
