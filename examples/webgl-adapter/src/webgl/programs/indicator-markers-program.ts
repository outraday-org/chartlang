// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

// Ported from invinite src/components/trading-chart/webgl/programs/indicator-markers-program.ts @ cd883292.
// WebGL2 renderer adapted to the chartlang Adapter/emission contract.
// "Translate, not transcribe": React/bus coupling + tcLog dropped; the typed
// program-cache record becomes the generic getProgram/evictProgram singleton,
// and pxToWorldX/Y are DERIVED from the per-pane projection + device-px
// viewport (the line-strip pattern), not passed in. Divergence: our
// MarkerDescriptor carries no per-line `glyphKind`, so this program renders the
// AA-disk glyph (uGlyphKind 0); the `+` cross branch is preserved in the
// fragment for forward-compatibility but is not selected by our descriptor.

import type { MarkerDescriptor } from "../../layer-descriptor.js";
import type { PooledBuffer } from "../buffer-pool.js";
import { UNIT_QUAD_TRIANGLE_STRIP } from "../geometry.js";
import { evictProgram, getProgram } from "../program-cache.js";
import type { AttributeBinding } from "../program.js";
import { assembleFragmentShader } from "../shader-modules/assemble.js";
import { Vao } from "../vao.js";
import { BaseProgram } from "./base-program.js";
import type { DrawArgs } from "./base-program.js";
import { MARKER_OFFSET_POS, MARKER_STRIDE_BYTES, packMarkers } from "./marker-pack.js";

/** Per-`gl` program-cache key for the singleton indicator-markers program. */
export const INDICATOR_MARKERS_PROGRAM_KEY = "indicator-markers";

// The descriptor renders the AA-disk glyph (the `+` cross is preserved in the
// fragment for forward-compatibility; our MarkerDescriptor selects circle).
const GLYPH_KIND_CIRCLE = 0;

/**
 * Draw-arg alias for the indicator-markers program. The renderer builds this
 * from the per-pane projection + device-px viewport; `setUniforms` derives the
 * pixel↔world scale from `projection` + `viewportWidthPx/HeightPx`.
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const args: IndicatorMarkersDrawArgs;
 *     void args.descriptor.radiusPx;
 */
export type IndicatorMarkersDrawArgs = DrawArgs<MarkerDescriptor>;

const VERTEX_SOURCE = `#version 300 es
precision highp float;

uniform mat3 uProj;
uniform float uPxToWorldX;
uniform float uPxToWorldY;
uniform float uRadiusPx;

in vec2 aCorner;
in vec2 aPos;

out vec2 vLocalNorm;

void main() {
    float halfX = uRadiusPx * uPxToWorldX;
    float halfY = uRadiusPx * uPxToWorldY;
    vec2 worldPos = aPos + aCorner * vec2(halfX, halfY);
    gl_Position = vec4((uProj * vec3(worldPos, 1.0)).xy, 0.0, 1.0);
    vLocalNorm = aCorner;
}
`;

const FRAGMENT_SOURCE = assembleFragmentShader({
    body: `
uniform vec4 uColor;
uniform int uGlyphKind;

in vec2 vLocalNorm;

out vec4 outColor;

void main() {
    if (uGlyphKind == 0) {
        // Circle — smoothstep AA disk via fwidth derivative.
        float dist = length(vLocalNorm);
        float aa = fwidth(dist);
        float alpha = 1.0 - smoothstep(1.0 - aa, 1.0, dist);
        if (alpha <= 0.0) discard;
        outColor = vec4(uColor.rgb, uColor.a * alpha);
    } else {
        // Cross / plus glyph — two perpendicular bars in normalized quad
        // space. armHalf = arm half-length; thick = arm half-thickness, sized
        // so the rasterized arm covers a stable >=3 device-px count.
        float armHalf = 1.0;
        float thick = 0.3;
        float ax = abs(vLocalNorm.x);
        float ay = abs(vLocalNorm.y);
        bool inH = (ax <= armHalf) && (ay <= thick);
        bool inV = (ay <= armHalf) && (ax <= thick);
        if (!(inH || inV)) discard;
        float edgeDist;
        if (inH && inV) {
            edgeDist = min(armHalf - ax, armHalf - ay);
        } else if (inH) {
            edgeDist = min(armHalf - ax, thick - ay);
        } else {
            edgeDist = min(armHalf - ay, thick - ax);
        }
        float alpha = smoothstep(0.0, fwidth(edgeDist), edgeDist);
        outColor = vec4(uColor.rgb, uColor.a * alpha);
    }
}
`,
    modules: [],
});

const ATTRIBUTE_NAMES = ["aCorner", "aPos"] as const;

const UNIFORM_NAMES = [
    "uColor",
    "uGlyphKind",
    "uProj",
    "uPxToWorldX",
    "uPxToWorldY",
    "uRadiusPx",
] as const;

function rebindAttribute(source: AttributeBinding, size: 1 | 2): AttributeBinding {
    return { location: source.location, name: source.name, size, type: source.type };
}

/**
 * Instanced unit-quad GL program for {@link MarkerDescriptor} rendered as
 * AA-disk indicator markers (the GPU perf path for per-bar `circles`-style
 * line markers; the correctness baseline is the shared overlay glyph helper).
 * Per-vertex `aCorner` interpolates to `vLocalNorm`; the fragment renders an
 * AA disk (`uGlyphKind 0`). Color + radius are descriptor-uniform. A NaN slot
 * in `descriptor.rows[i*2 + 1]` propagates to a NaN `gl_Position` the GPU
 * clips — no CPU-side filter.
 *
 * Extends {@link BaseProgram} for the canonical pack → upload → VAO →
 * setUniforms → draw lifecycle; sibling of {@link CursorsProgram} +
 * {@link MarkersProgram}, each owning a disjoint glyph lifecycle.
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const gl: WebGL2RenderingContext;
 *     const program = IndicatorMarkersProgram.get(gl);
 *     // program.draw({ descriptor, projection, viewportWidthPx, viewportHeightPx, dpr, paneKey });
 *     void program;
 */
export class IndicatorMarkersProgram extends BaseProgram<MarkerDescriptor> {
    /** Resolve (compiling once) the per-`gl` singleton via the shared program cache. */
    static get(gl: WebGL2RenderingContext): IndicatorMarkersProgram {
        return getProgram(gl, INDICATOR_MARKERS_PROGRAM_KEY, () => new IndicatorMarkersProgram(gl));
    }

    private readonly quadBuffer: WebGLBuffer;
    private readonly colorScratch: Float32Array;

    private constructor(gl: WebGL2RenderingContext) {
        super(gl, {
            attributes: ATTRIBUTE_NAMES,
            fsSource: FRAGMENT_SOURCE,
            poolKeySuffix: "indicator-markers",
            uniforms: UNIFORM_NAMES,
            vsSource: VERTEX_SOURCE,
        });

        this.colorScratch = new Float32Array(4);

        const quad = gl.createBuffer();
        if (quad === null) {
            throw new Error(
                "IndicatorMarkersProgram: gl.createBuffer returned null for unit-quad buffer",
            );
        }
        this.quadBuffer = quad;

        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, UNIT_QUAD_TRIANGLE_STRIP, gl.STATIC_DRAW);
    }

    protected pack(descriptor: MarkerDescriptor): Float32Array {
        return packMarkers(descriptor);
    }

    protected buildVao(pooled: PooledBuffer): Vao {
        const cornerBinding = rebindAttribute(this.program.getAttribute("aCorner"), 2);
        const posBinding = rebindAttribute(this.program.getAttribute("aPos"), 2);

        return new Vao(this.gl, [
            {
                attribute: cornerBinding,
                buffer: { glBuffer: this.quadBuffer },
                offset: 0,
                stride: 0,
            },
            {
                attribute: posBinding,
                buffer: pooled,
                divisor: 1,
                offset: MARKER_OFFSET_POS,
                stride: MARKER_STRIDE_BYTES,
            },
        ]);
    }

    protected setUniforms(args: IndicatorMarkersDrawArgs): void {
        const { descriptor, projection, viewportWidthPx, viewportHeightPx } = args;
        const { color, radiusPx } = descriptor;

        const pxToWorldX = 2 / (projection[0] * viewportWidthPx);
        const pxToWorldY = 2 / (projection[4] * viewportHeightPx);

        this.program.setUniformMatrix3fv("uProj", projection);
        this.program.setUniform1f("uPxToWorldX", pxToWorldX);
        this.program.setUniform1f("uPxToWorldY", pxToWorldY);
        this.program.setUniform1f("uRadiusPx", radiusPx);

        this.colorScratch[0] = color[0];
        this.colorScratch[1] = color[1];
        this.colorScratch[2] = color[2];
        this.colorScratch[3] = color[3];
        this.program.setUniform4fv("uColor", this.colorScratch);

        this.gl.uniform1i(this.program.getUniform("uGlyphKind").location, GLYPH_KIND_CIRCLE);
    }

    protected override onBeforeDraw(): void {
        const { gl } = this;
        gl.enable(gl.BLEND);
        gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }

    protected override cleanupExtras(): void {
        this.gl.deleteBuffer(this.quadBuffer);
    }

    protected clearCacheSlot(): void {
        evictProgram(this.gl, INDICATOR_MARKERS_PROGRAM_KEY);
    }
}
