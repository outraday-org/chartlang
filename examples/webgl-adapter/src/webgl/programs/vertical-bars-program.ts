// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

// Ported from invinite src/components/trading-chart/webgl/programs/vertical-bars-program.ts @ cd883292.
// WebGL2 renderer adapted to the chartlang Adapter/emission contract.
// "Translate, not transcribe": React/bus coupling dropped; world window
// comes from the shared ViewController, not invinite's frame-state.
//
// Divergence: our descriptor carries a concrete `barWidthPx` (CSS-px), not
// invinite's `Infinity` ceiling + `computeBarWidthPx(barPitchPx, …)` pitch
// formula (that module is not in this adapter) — so this program feeds
// `uBarWidthPx` straight through and floors it at 1 device-px in the shader
// (the candle-bodies `MIN_BODY_WIDTH_PX` parity). invinite's `tcLog` was
// dropped.

import type { VerticalBarsDescriptor } from "../../layer-descriptor.js";
import type { PooledBuffer } from "../buffer-pool.js";
import { Y_ZERO_QUAD_TRIANGLE_STRIP } from "../geometry.js";
import { evictProgram, getProgram } from "../program-cache.js";
import type { AttributeBinding } from "../program.js";
import { assembleVertexShader } from "../shader-modules/assemble.js";
import { PROJECT32_UNIFORMS, PROJECT32_VS_GLSL } from "../shader-modules/project32.js";
import { Vao } from "../vao.js";
import { BaseProgram } from "./base-program.js";
import type { DrawArgs } from "./base-program.js";
import {
    VERTICAL_BARS_OFFSET_HEIGHT,
    VERTICAL_BARS_OFFSET_IDX,
    VERTICAL_BARS_OFFSET_IS_POSITIVE,
    VERTICAL_BARS_STRIDE_BYTES,
    packVerticalBars,
} from "./vertical-bars-pack.js";

/** Per-`gl` program-cache key for the singleton vertical-bars program. */
export const VERTICAL_BARS_PROGRAM_KEY = "vertical-bars";

/**
 * Draw-arg alias for the vertical-bars program. The renderer builds this from
 * the per-pane projection + device-px viewport.
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const args: VerticalBarsDrawArgs;
 *     void args.descriptor.barWidthPx;
 */
export type VerticalBarsDrawArgs = DrawArgs<VerticalBarsDescriptor>;

const VERTEX_SOURCE = assembleVertexShader({
    body: `
uniform mat3 uProj;
uniform float uBarWidthPx;
uniform float uBaseline;
uniform vec4 uPositiveColor;
uniform vec4 uNegativeColor;

in vec2 aCorner;
in float aIdx;
in float aHeight;
in float aIsPositive;

out vec4 vColor;

void main() {
    // Snap the bar X-center to integer device-px (via the project32 helper)
    // so left/right edges rasterize crisply. Y is anchored at the world
    // baseline (the bar grows up or down with aHeight's sign); the
    // projection's world-y scaling (uProj[1][1] = sy from ortho2d,
    // column-major) handles the vertical mapping unchanged.
    vec2 worldCenter = vec2(aIdx, uBaseline);
    vec2 ndcCenter = (uProj * vec3(worldCenter, 1.0)).xy;
    vec2 fullSnappedNdc = worldToSnappedNdc(vec2(aIdx, 0.0), uProj);
    float snappedNdcX = fullSnappedNdc.x;

    // Half-bar in NDC. Width derives from the CSS-px bar width scaled to
    // device-px and floored at 1 device-px (canvas2d MIN_BODY_WIDTH_PX parity
    // — a bar never collapses below one pixel).
    float barDevicePx = max(1.0, uBarWidthPx * uDpr);
    float halfBarNdcX = (barDevicePx * 0.5) / (uViewportSize.x * 0.5);

    // World-y top edge: the Y_ZERO quad's corners are {0, 1} along Y, so the
    // bottom edge (aCorner.y == 0) sits at the projected baseline (ndcCenter.y)
    // and the top edge (aCorner.y == 1) reaches baseline + aHeight.
    // uProj[1][1] scales the world-y height to NDC-y.
    float ndcTopOffset = aCorner.y * aHeight * uProj[1][1];

    vec2 ndcPos = vec2(snappedNdcX + aCorner.x * halfBarNdcX, ndcCenter.y + ndcTopOffset);

    gl_Position = vec4(ndcPos, 0.0, 1.0);
    vColor = mix(uNegativeColor, uPositiveColor, aIsPositive);
}
`,
    modules: [PROJECT32_VS_GLSL],
});

const FRAGMENT_SOURCE = `#version 300 es
precision mediump float;

in vec4 vColor;
out vec4 fragColor;

void main() {
    fragColor = vColor;
}
`;

const ATTRIBUTE_NAMES = ["aCorner", "aHeight", "aIdx", "aIsPositive"] as const;

const UNIFORM_NAMES = [
    ...PROJECT32_UNIFORMS,
    "uBarWidthPx",
    "uBaseline",
    "uNegativeColor",
    "uPositiveColor",
    "uProj",
] as const;

// Re-stamp a resolved attribute binding with the `size` the VAO layout needs
// (the program resolves every attribute at size 1; `aCorner` is a vec2).
function rebindAttribute(source: AttributeBinding, size: 1 | 2): AttributeBinding {
    return { location: source.location, name: source.name, size, type: source.type };
}

/**
 * Instanced-quad GL program for {@link VerticalBarsDescriptor}: one
 * `Y_ZERO_QUAD` instance per bar anchored at world `y = 0`, per-instance
 * attributes `aIdx/aHeight/aIsPositive` read from the descriptor's
 * `[x, height, isPositive]` `rows`. One program serves volume bars
 * (always-positive heights) and the MACD-style histogram (signed heights):
 * `mix(uNegativeColor, uPositiveColor, aIsPositive)` picks the per-bar color.
 * The vertex shader device-px-snaps the bar center, floors the bar width at
 * 1 device-px, and grows the bar up (positive height) or down (negative).
 * A NaN height propagates through `uProj` into a NaN `gl_Position` the GPU
 * clips — no CPU-side filter.
 *
 * Extends {@link BaseProgram} for the canonical pack → upload → VAO →
 * setUniforms → draw lifecycle; the subclass owns the static Y_ZERO-quad
 * buffer, the bars uniforms, and the per-draw blend enable.
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const gl: WebGL2RenderingContext;
 *     const program = VerticalBarsProgram.get(gl);
 *     // program.draw({ descriptor, projection, viewportWidthPx, viewportHeightPx, dpr, paneKey });
 *     void program;
 */
export class VerticalBarsProgram extends BaseProgram<VerticalBarsDescriptor> {
    /** Resolve (compiling once) the per-`gl` singleton via the shared program cache. */
    static get(gl: WebGL2RenderingContext): VerticalBarsProgram {
        return getProgram(gl, VERTICAL_BARS_PROGRAM_KEY, () => new VerticalBarsProgram(gl));
    }

    private readonly quadBuffer: WebGLBuffer;
    private readonly colorScratch: Float32Array;

    private constructor(gl: WebGL2RenderingContext) {
        super(gl, {
            attributes: ATTRIBUTE_NAMES,
            fsSource: FRAGMENT_SOURCE,
            poolKeySuffix: "bars",
            uniforms: UNIFORM_NAMES,
            vsSource: VERTEX_SOURCE,
        });

        this.colorScratch = new Float32Array(4);

        const quad = gl.createBuffer();
        if (quad === null) {
            throw new Error(
                "VerticalBarsProgram: gl.createBuffer returned null for Y_ZERO-quad buffer",
            );
        }
        this.quadBuffer = quad;

        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, Y_ZERO_QUAD_TRIANGLE_STRIP, gl.STATIC_DRAW);
    }

    protected pack(descriptor: VerticalBarsDescriptor): Float32Array {
        return packVerticalBars(descriptor);
    }

    protected buildVao(pooled: PooledBuffer): Vao {
        const cornerBinding = rebindAttribute(this.program.getAttribute("aCorner"), 2);
        const idxBinding = rebindAttribute(this.program.getAttribute("aIdx"), 1);
        const heightBinding = rebindAttribute(this.program.getAttribute("aHeight"), 1);
        const isPositiveBinding = rebindAttribute(this.program.getAttribute("aIsPositive"), 1);

        return new Vao(this.gl, [
            {
                attribute: cornerBinding,
                buffer: { glBuffer: this.quadBuffer },
                offset: 0,
                stride: 0,
            },
            {
                attribute: idxBinding,
                buffer: pooled,
                divisor: 1,
                offset: VERTICAL_BARS_OFFSET_IDX,
                stride: VERTICAL_BARS_STRIDE_BYTES,
            },
            {
                attribute: heightBinding,
                buffer: pooled,
                divisor: 1,
                offset: VERTICAL_BARS_OFFSET_HEIGHT,
                stride: VERTICAL_BARS_STRIDE_BYTES,
            },
            {
                attribute: isPositiveBinding,
                buffer: pooled,
                divisor: 1,
                offset: VERTICAL_BARS_OFFSET_IS_POSITIVE,
                stride: VERTICAL_BARS_STRIDE_BYTES,
            },
        ]);
    }

    protected setUniforms(args: VerticalBarsDrawArgs): void {
        const { descriptor, projection, viewportWidthPx, viewportHeightPx, dpr } = args;
        const { barWidthPx, positiveColor, negativeColor } = descriptor;

        this.program.setUniformMatrix3fv("uProj", projection);
        this.program.setUniform2f("uViewportSize", viewportWidthPx, viewportHeightPx);
        this.program.setUniform1f("uDpr", dpr);
        this.program.setUniform1f("uBarWidthPx", barWidthPx);
        this.program.setUniform1f("uBaseline", descriptor.baseline ?? 0);

        this.colorScratch[0] = positiveColor[0];
        this.colorScratch[1] = positiveColor[1];
        this.colorScratch[2] = positiveColor[2];
        this.colorScratch[3] = positiveColor[3];
        this.program.setUniform4fv("uPositiveColor", this.colorScratch);

        this.colorScratch[0] = negativeColor[0];
        this.colorScratch[1] = negativeColor[1];
        this.colorScratch[2] = negativeColor[2];
        this.colorScratch[3] = negativeColor[3];
        this.program.setUniform4fv("uNegativeColor", this.colorScratch);
    }

    protected override onBeforeDraw(): void {
        const { gl } = this;
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }

    protected override cleanupExtras(): void {
        this.gl.deleteBuffer(this.quadBuffer);
    }

    protected clearCacheSlot(): void {
        evictProgram(this.gl, VERTICAL_BARS_PROGRAM_KEY);
    }
}
