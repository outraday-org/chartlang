// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

// Ported from invinite src/components/trading-chart/webgl/programs/candle-bodies-program.ts @ cd883292.
// WebGL2 renderer adapted to the chartlang Adapter/emission contract.
// "Translate, not transcribe": React/bus coupling dropped; world window
// comes from the shared ViewController, not invinite's frame-state.
//
// Divergence: invinite resolves the pitch-aware width IN this program
// (`computeBarWidthPx(barPitchPx, …)` from the projection). We run the SAME
// shared formula upstream in `buildFrame` (where the visible window + pane
// width are known), so the descriptor's `bodyWidthPx` is already the
// pitch-resolved CSS-px width — bodies shrink to avoid overlap when zoomed out,
// cap at their ceiling when zoomed in. This program feeds `uBodyWidthPx`
// straight through and floors it at 1 device-px in the shader (the canvas2d
// `MIN_BODY_WIDTH_PX` parity).

import type { CandleBodiesDescriptor } from "../../layer-descriptor.js";
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
    CANDLE_BODIES_OFFSET_CLOSE,
    CANDLE_BODIES_OFFSET_IDX,
    CANDLE_BODIES_OFFSET_IS_BULL,
    CANDLE_BODIES_OFFSET_OPEN,
    CANDLE_BODIES_STRIDE_BYTES,
    packCandleBodies,
} from "./candle-pack.js";

/** Per-`gl` program-cache key for the singleton candle-bodies program. */
export const CANDLE_BODIES_PROGRAM_KEY = "candle-bodies";

/**
 * Draw-arg alias for the candle-bodies program. The renderer builds this from
 * the per-pane projection + device-px viewport.
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const args: CandleBodiesDrawArgs;
 *     void args.descriptor.bodyWidthPx;
 */
export type CandleBodiesDrawArgs = DrawArgs<CandleBodiesDescriptor>;

const VERTEX_SOURCE = assembleVertexShader({
    body: `
uniform mat3 uProj;
uniform float uBodyWidthPx;
uniform vec4 uBullColor;
uniform vec4 uBearColor;

in vec2 aCorner;
in float aIdx;
in float aOpen;
in float aClose;
in float aIsBull;

out vec4 vColor;

void main() {
    float topY = max(aOpen, aClose);
    float bottomY = min(aOpen, aClose);
    bool isDoji = (topY == bottomY);

    // Project the bar center (world units) to an integer device-px center
    // and back to NDC via the shared project32 helper so a 1-device-px body
    // edge rasterizes fully opaque without AA leak.
    vec2 worldCenter = vec2(aIdx, (topY + bottomY) * 0.5);
    vec2 snappedNdc = worldToSnappedNdc(worldCenter, uProj);

    // Half-extent in NDC. Width derives from the CSS-px body width scaled to
    // device-px and floored at 1 device-px (parity with the canvas2d
    // MIN_BODY_WIDTH_PX fix — a body never collapses below one pixel).
    float bodyDevicePx = max(1.0, uBodyWidthPx * uDpr);
    float halfBodyNdcX = (bodyDevicePx * 0.5) / (uViewportSize.x * 0.5);

    // Height from the world-y span scaled into NDC via uProj[1][1] (= sy =
    // 2 / (top - bottom) from ortho2d, column-major).
    float halfBodyWorldY = (topY - bottomY) * 0.5;
    float halfBodyNdcY = halfBodyWorldY * uProj[1][1];

    // Doji inflation: enforce a 1-device-px minimum body height when the bar
    // has no real body (open == close). dojiInflateNdcY() is one device px in
    // NDC-y; ensure the half-extent is at least half of that.
    if (isDoji) {
        halfBodyNdcY = max(halfBodyNdcY, dojiInflateNdcY() * 0.5);
    }

    vec2 halfSizeNdc = vec2(halfBodyNdcX, halfBodyNdcY);

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

const ATTRIBUTE_NAMES = ["aClose", "aCorner", "aIdx", "aIsBull", "aOpen"] as const;

const UNIFORM_NAMES = [
    ...PROJECT32_UNIFORMS,
    "uBearColor",
    "uBodyWidthPx",
    "uBullColor",
    "uProj",
] as const;

// Re-stamp a resolved attribute binding with the `size` the VAO layout needs
// (the program resolves every attribute at size 1; `aCorner` is a vec2).
function rebindAttribute(source: AttributeBinding, size: 1 | 2): AttributeBinding {
    return { location: source.location, name: source.name, size, type: source.type };
}

/**
 * Instanced-quad GL program for {@link CandleBodiesDescriptor}: one unit-quad
 * instance per bar, per-instance attributes `aIdx/aOpen/aClose/aIsBull` read
 * from the descriptor's `[x, open, high, low, close, isBull]` `rows`
 * (`high`/`low` present in the buffer but unbound — the body is
 * `max/min(open, close)`). The vertex shader device-px-snaps the bar center,
 * inflates dojis to 1 device-px, floors the body width at 1 device-px, and
 * colors via `mix(bear, bull, aIsBull)`; the fragment is a flat fill with
 * `SRC_ALPHA, ONE_MINUS_SRC_ALPHA` blend.
 *
 * Extends {@link BaseProgram} for the canonical pack → upload → VAO →
 * setUniforms → draw lifecycle; the subclass owns the static unit-quad
 * buffer, the bodies uniforms, and the per-draw blend enable.
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const gl: WebGL2RenderingContext;
 *     const program = CandleBodiesProgram.get(gl);
 *     // program.draw({ descriptor, projection, viewportWidthPx, viewportHeightPx, dpr, paneKey });
 *     void program;
 */
export class CandleBodiesProgram extends BaseProgram<CandleBodiesDescriptor> {
    /** Resolve (compiling once) the per-`gl` singleton via the shared program cache. */
    static get(gl: WebGL2RenderingContext): CandleBodiesProgram {
        return getProgram(gl, CANDLE_BODIES_PROGRAM_KEY, () => new CandleBodiesProgram(gl));
    }

    private readonly quadBuffer: WebGLBuffer;
    private readonly colorScratch: Float32Array;

    private constructor(gl: WebGL2RenderingContext) {
        super(gl, {
            attributes: ATTRIBUTE_NAMES,
            fsSource: FRAGMENT_SOURCE,
            poolKeySuffix: "bodies",
            uniforms: UNIFORM_NAMES,
            vsSource: VERTEX_SOURCE,
        });

        this.colorScratch = new Float32Array(4);

        const quad = gl.createBuffer();
        if (quad === null) {
            throw new Error(
                "CandleBodiesProgram: gl.createBuffer returned null for unit-quad buffer",
            );
        }
        this.quadBuffer = quad;

        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, UNIT_QUAD_TRIANGLE_STRIP, gl.STATIC_DRAW);
    }

    protected pack(descriptor: CandleBodiesDescriptor): Float32Array {
        return packCandleBodies(descriptor);
    }

    protected buildVao(pooled: PooledBuffer): Vao {
        const cornerBinding = rebindAttribute(this.program.getAttribute("aCorner"), 2);
        const idxBinding = rebindAttribute(this.program.getAttribute("aIdx"), 1);
        const openBinding = rebindAttribute(this.program.getAttribute("aOpen"), 1);
        const closeBinding = rebindAttribute(this.program.getAttribute("aClose"), 1);
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
                offset: CANDLE_BODIES_OFFSET_IDX,
                stride: CANDLE_BODIES_STRIDE_BYTES,
            },
            {
                attribute: openBinding,
                buffer: pooled,
                divisor: 1,
                offset: CANDLE_BODIES_OFFSET_OPEN,
                stride: CANDLE_BODIES_STRIDE_BYTES,
            },
            {
                attribute: closeBinding,
                buffer: pooled,
                divisor: 1,
                offset: CANDLE_BODIES_OFFSET_CLOSE,
                stride: CANDLE_BODIES_STRIDE_BYTES,
            },
            {
                attribute: isBullBinding,
                buffer: pooled,
                divisor: 1,
                offset: CANDLE_BODIES_OFFSET_IS_BULL,
                stride: CANDLE_BODIES_STRIDE_BYTES,
            },
        ]);
    }

    protected setUniforms(args: CandleBodiesDrawArgs): void {
        const { descriptor, projection, viewportWidthPx, viewportHeightPx, dpr } = args;
        const { bodyWidthPx, bullColor, bearColor } = descriptor;

        this.program.setUniformMatrix3fv("uProj", projection);
        this.program.setUniform2f("uViewportSize", viewportWidthPx, viewportHeightPx);
        this.program.setUniform1f("uDpr", dpr);
        this.program.setUniform1f("uBodyWidthPx", bodyWidthPx);

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
        evictProgram(this.gl, CANDLE_BODIES_PROGRAM_KEY);
    }
}
