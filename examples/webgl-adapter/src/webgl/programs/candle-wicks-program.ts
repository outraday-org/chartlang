// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

// Ported from invinite src/components/trading-chart/webgl/programs/candle-wicks-program.ts @ cd883292.
// WebGL2 renderer adapted to the chartlang Adapter/emission contract.
// "Translate, not transcribe": React/bus coupling dropped; world window
// comes from the shared ViewController, not invinite's frame-state.
//
// Divergence: our `CandleWicksDescriptor` is a single quad per bar spanning
// low→high (`[x, low, high, isBull]`); the per-bar `isBull` flag picks the
// bull/bear colour in-shader so each wick matches its candle body — NOT
// invinite's 2-stub upper/lower model with a per-bar bull-flags Uint8 stream
// and bodyBottom/bodyTop. So this program runs the canonical BaseProgram flow
// (1 instance/bar, `drawArraysInstanced(…, rowCount)`) — invinite's
// drawOverride / prunePaneOverride / bull-flags machinery is not ported. The
// edge-aligned X snap (not center snap) is kept so a thin 1-CSS-px wick stays
// fully covered (crisp) at any DPR.

import type { CandleWicksDescriptor } from "../../layer-descriptor.js";
import type { PooledBuffer } from "../buffer-pool.js";
import { UNIT_QUAD_TRIANGLE_STRIP } from "../geometry.js";
import { evictProgram, getProgram } from "../program-cache.js";
import type { AttributeBinding } from "../program.js";
import { assembleVertexShader } from "../shader-modules/assemble.js";
import { PROJECT32_UNIFORMS, PROJECT32_VS_GLSL } from "../shader-modules/project32.js";
import { Vao } from "../vao.js";
import { BaseProgram } from "./base-program.js";
import type { DrawArgs } from "./base-program.js";
import {
    CANDLE_WICKS_OFFSET_HIGH,
    CANDLE_WICKS_OFFSET_IDX,
    CANDLE_WICKS_OFFSET_IS_BULL,
    CANDLE_WICKS_OFFSET_LOW,
    CANDLE_WICKS_STRIDE_BYTES,
    packCandleWicks,
} from "./candle-pack.js";

/** Per-`gl` program-cache key for the singleton candle-wicks program. */
export const CANDLE_WICKS_PROGRAM_KEY = "candle-wicks";

/**
 * Draw-arg alias for the candle-wicks program.
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const args: CandleWicksDrawArgs;
 *     void args.descriptor.wickWidthPx;
 */
export type CandleWicksDrawArgs = DrawArgs<CandleWicksDescriptor>;

const VERTEX_SOURCE = assembleVertexShader({
    body: `
uniform mat3 uProj;
uniform float uWickWidthPx;
uniform vec4 uBullColor;
uniform vec4 uBearColor;

in vec2 aCorner;
in float aIdx;
in float aLow;
in float aHigh;
in float aIsBull;

out vec4 vColor;

void main() {
    float topY = aHigh;
    float bottomY = aLow;

    // Edge-align the wick to whole device-px columns. Snapping the bar
    // *center* to a pixel center only lands both edges on integer device-px
    // when the device-px width is odd; a 1-CSS-px wick is 2 device-px (even)
    // at DPR 2, so a center-snap would leave it half-covering the flanking
    // columns and read darker. Snapping the LEFT EDGE to an integer keeps
    // every wick pixel fully covered, so the wick color matches the body at
    // any DPR. Y stays as the projection produces it (the wick spans the
    // bar's low→high world-y range).
    vec2 worldCenter = vec2(aIdx, (topY + bottomY) * 0.5);
    vec2 ndcCenter = (uProj * vec3(worldCenter, 1.0)).xy;

    float rawCenterPxX = (ndcCenter.x * 0.5 + 0.5) * uViewportSize.x;
    float wickDevicePx = max(1.0, floor(uWickWidthPx * uDpr + 0.5));
    float leftPx = floor(rawCenterPxX - wickDevicePx * 0.5 + 0.5);
    float snappedCenterPxX = leftPx + wickDevicePx * 0.5;
    float snappedNdcX = (snappedCenterPxX / uViewportSize.x) * 2.0 - 1.0;
    float halfWickNdcX = (wickDevicePx * 0.5) / (uViewportSize.x * 0.5);

    float halfSegmentWorldY = (topY - bottomY) * 0.5;
    float halfSegmentNdcY = halfSegmentWorldY * uProj[1][1];

    vec2 snappedNdc = vec2(snappedNdcX, ndcCenter.y);
    vec2 halfSizeNdc = vec2(halfWickNdcX, halfSegmentNdcY);

    gl_Position = vec4(snappedNdc + aCorner * halfSizeNdc, 0.0, 1.0);
    vColor = mix(uBearColor, uBullColor, aIsBull);
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

const ATTRIBUTE_NAMES = ["aCorner", "aHigh", "aIdx", "aIsBull", "aLow"] as const;

const UNIFORM_NAMES = [
    ...PROJECT32_UNIFORMS,
    "uBearColor",
    "uBullColor",
    "uProj",
    "uWickWidthPx",
] as const;

// Re-stamp a resolved attribute binding with the `size` the VAO layout needs
// (the program resolves every attribute at size 1; `aCorner` is a vec2).
function rebindAttribute(source: AttributeBinding, size: 1 | 2): AttributeBinding {
    return { location: source.location, name: source.name, size, type: source.type };
}

/**
 * Instanced-quad GL program for {@link CandleWicksDescriptor}: one unit-quad
 * instance per bar spanning the bar's low→high world-y range, per-instance
 * attributes `aIdx/aLow/aHigh/aIsBull` read from the descriptor's `[x, low,
 * high, isBull]` `rows`; the vertex shader colours each wick via
 * `mix(bear, bull, aIsBull)` so it matches its candle body. It edge-snaps the
 * wick X to
 * whole device-px columns (so a thin wick stays crisp), draws via
 * `drawArraysInstanced(TRIANGLE_STRIP, 0, 4, rowCount)`, and blends with
 * `SRC_ALPHA, ONE_MINUS_SRC_ALPHA`.
 *
 * Extends {@link BaseProgram} for the canonical lifecycle; the subclass owns
 * the static unit-quad buffer, the wick uniforms, and the per-draw blend.
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const gl: WebGL2RenderingContext;
 *     const program = CandleWicksProgram.get(gl);
 *     // program.draw({ descriptor, projection, viewportWidthPx, viewportHeightPx, dpr, paneKey });
 *     void program;
 */
export class CandleWicksProgram extends BaseProgram<CandleWicksDescriptor> {
    /** Resolve (compiling once) the per-`gl` singleton via the shared program cache. */
    static get(gl: WebGL2RenderingContext): CandleWicksProgram {
        return getProgram(gl, CANDLE_WICKS_PROGRAM_KEY, () => new CandleWicksProgram(gl));
    }

    private readonly quadBuffer: WebGLBuffer;
    private readonly colorScratch: Float32Array;

    private constructor(gl: WebGL2RenderingContext) {
        super(gl, {
            attributes: ATTRIBUTE_NAMES,
            fsSource: FRAGMENT_SOURCE,
            poolKeySuffix: "wicks",
            uniforms: UNIFORM_NAMES,
            vsSource: VERTEX_SOURCE,
        });

        this.colorScratch = new Float32Array(4);

        const quad = gl.createBuffer();
        if (quad === null) {
            throw new Error(
                "CandleWicksProgram: gl.createBuffer returned null for unit-quad buffer",
            );
        }
        this.quadBuffer = quad;

        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, UNIT_QUAD_TRIANGLE_STRIP, gl.STATIC_DRAW);
    }

    protected pack(descriptor: CandleWicksDescriptor): Float32Array {
        return packCandleWicks(descriptor);
    }

    protected buildVao(pooled: PooledBuffer): Vao {
        const cornerBinding = rebindAttribute(this.program.getAttribute("aCorner"), 2);
        const idxBinding = rebindAttribute(this.program.getAttribute("aIdx"), 1);
        const lowBinding = rebindAttribute(this.program.getAttribute("aLow"), 1);
        const highBinding = rebindAttribute(this.program.getAttribute("aHigh"), 1);
        const isBullBinding = rebindAttribute(this.program.getAttribute("aIsBull"), 1);

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
                offset: CANDLE_WICKS_OFFSET_IDX,
                stride: CANDLE_WICKS_STRIDE_BYTES,
            },
            {
                attribute: lowBinding,
                buffer: pooled,
                divisor: 1,
                offset: CANDLE_WICKS_OFFSET_LOW,
                stride: CANDLE_WICKS_STRIDE_BYTES,
            },
            {
                attribute: highBinding,
                buffer: pooled,
                divisor: 1,
                offset: CANDLE_WICKS_OFFSET_HIGH,
                stride: CANDLE_WICKS_STRIDE_BYTES,
            },
            {
                attribute: isBullBinding,
                buffer: pooled,
                divisor: 1,
                offset: CANDLE_WICKS_OFFSET_IS_BULL,
                stride: CANDLE_WICKS_STRIDE_BYTES,
            },
        ]);
    }

    protected setUniforms(args: CandleWicksDrawArgs): void {
        const { descriptor, projection, viewportWidthPx, viewportHeightPx, dpr } = args;
        const { wickWidthPx, bullColor, bearColor } = descriptor;

        this.program.setUniformMatrix3fv("uProj", projection);
        this.program.setUniform2f("uViewportSize", viewportWidthPx, viewportHeightPx);
        this.program.setUniform1f("uDpr", dpr);
        this.program.setUniform1f("uWickWidthPx", wickWidthPx);

        this.colorScratch[0] = bullColor[0];
        this.colorScratch[1] = bullColor[1];
        this.colorScratch[2] = bullColor[2];
        this.colorScratch[3] = bullColor[3];
        this.program.setUniform4fv("uBullColor", this.colorScratch);

        this.colorScratch[0] = bearColor[0];
        this.colorScratch[1] = bearColor[1];
        this.colorScratch[2] = bearColor[2];
        this.colorScratch[3] = bearColor[3];
        this.program.setUniform4fv("uBearColor", this.colorScratch);
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
        evictProgram(this.gl, CANDLE_WICKS_PROGRAM_KEY);
    }
}
