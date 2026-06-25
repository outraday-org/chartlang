// Ported from invinite src/components/trading-chart/webgl/shader-modules/assemble.ts @ cd883292.
// WebGL2 renderer adapted to the chartlang Adapter/emission contract.
// "Translate, not transcribe": React/bus coupling dropped; world window
// comes from the shared ViewController, not invinite's frame-state.
//
// Pattern inspired by luma.gl's shader-assembler (MIT, Uber / vis.gl),
// re-implemented in-tree — NOT an npm dependency on luma.gl.

type AssembleArgs = {
    readonly modules: ReadonlyArray<string>;
    readonly body: string;
};

const VS_HEADER = `#version 300 es
precision highp float;
`;

const FS_HEADER = `#version 300 es
precision mediump float;
`;

/**
 * Concatenate `#version 300 es` + `precision highp float;` + every module
 * fragment + the program-specific `body` into a single GLSL vertex-shader
 * source. Modules are joined in order so a downstream module can reference
 * helpers declared by an earlier one.
 *
 * @since 0.1
 * @stable
 * @example
 *     const src = assembleVertexShader({
 *         modules: ["uniform float uA;"],
 *         body: "void main() { gl_Position = vec4(uA); }",
 *     });
 *     src.includes("#version 300 es") === true;
 *     void src;
 */
export function assembleVertexShader({ modules, body }: AssembleArgs): string {
    return `${VS_HEADER}\n${modules.join("\n")}\n${body}`;
}

/**
 * Counterpart for fragment shaders. Defaults to `precision mediump float;`,
 * matching the fragment-shader convention across the WebGL programs.
 *
 * @since 0.1
 * @stable
 * @example
 *     const src = assembleFragmentShader({
 *         modules: ["uniform vec3 uColor;"],
 *         body: "out vec4 o; void main() { o = vec4(uColor, 1.0); }",
 *     });
 *     src.includes("precision mediump float;") === true;
 *     void src;
 */
export function assembleFragmentShader({ modules, body }: AssembleArgs): string {
    return `${FS_HEADER}\n${modules.join("\n")}\n${body}`;
}
