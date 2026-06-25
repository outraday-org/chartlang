// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

// Ported from invinite src/components/trading-chart/webgl/programs/markers-program.ts @ cd883292.
// WebGL2 renderer adapted to the chartlang Adapter/emission contract.
// "Translate, not transcribe": React/bus coupling + tcLog dropped; the typed
// program-cache record becomes the generic getProgram/evictProgram singleton.
// Divergence: invinite packs per-instance color/orientation/sizePx; our
// MarkerDescriptor carries descriptor-UNIFORM color + radius, so the instanced
// triangle reads only `[x, y]` per instance and takes color / size / a fixed
// up-orientation from uniforms (the device-px snap geometry is faithful).

import type { MarkerDescriptor } from "../../layer-descriptor.js";
import type { PooledBuffer } from "../buffer-pool.js";
import { UNIT_QUAD_TRIANGLE_STRIP } from "../geometry.js";
import { evictProgram, getProgram } from "../program-cache.js";
import type { AttributeBinding } from "../program.js";
import { assembleVertexShader } from "../shader-modules/assemble.js";
import { PROJECT32_UNIFORMS, PROJECT32_VS_GLSL } from "../shader-modules/project32.js";
import { Vao } from "../vao.js";
import { BaseProgram } from "./base-program.js";
import type { DrawArgs } from "./base-program.js";
import { MARKER_OFFSET_POS, MARKER_STRIDE_BYTES, packMarkers } from "./marker-pack.js";

/** Per-`gl` program-cache key for the singleton markers program. */
export const MARKERS_PROGRAM_KEY = "markers";

/**
 * Draw-arg alias for the markers program. The renderer builds this from the
 * per-pane projection + device-px viewport (the `project32` snap denominator).
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const args: MarkersDrawArgs;
 *     void args.descriptor.radiusPx;
 */
export type MarkersDrawArgs = DrawArgs<MarkerDescriptor>;

const VERTEX_SOURCE = assembleVertexShader({
    body: `
uniform mat3 uProj;
uniform vec4 uColor;
uniform float uSizePx;

in vec2 aCorner;
in vec2 aPos;

out vec4 vColor;

void main() {
    // Project world center to NDC, then to an integer device-px center so the
    // triangle edges land on integer device-px boundaries at any DPR (the
    // vertical-bars / candle device-px snap pattern, via project32's
    // uViewportSize / uDpr).
    vec2 ndcCenter = (uProj * vec3(aPos, 1.0)).xy;
    vec2 pxCenter = floor((ndcCenter * 0.5 + 0.5) * uViewportSize) + 0.5;

    // Build an up-triangle in device-px around pxCenter. aCorner ∈
    // {(-1,-1),(1,-1),(-1,1),(1,1)} via TRIANGLE_STRIP; the apex (top of the
    // price-up screen = +Y) collapses both top corners onto (0, +half) so the
    // strip's second triangle is zero-area and the GPU clips it.
    float halfPx = uSizePx * uDpr * 0.5;
    vec2 offsetPx;
    if (aCorner.y < 0.0) {
        offsetPx = vec2(0.0, halfPx);
    } else {
        offsetPx = vec2(aCorner.x * halfPx, -halfPx);
    }

    vec2 finalPx = pxCenter + offsetPx;
    vec2 ndcOut = (finalPx / uViewportSize) * 2.0 - 1.0;

    gl_Position = vec4(ndcOut, 0.0, 1.0);
    vColor = uColor;
}
`,
    modules: [PROJECT32_VS_GLSL],
});

const FRAGMENT_SOURCE = `#version 300 es
precision highp float;

in vec4 vColor;
out vec4 fragColor;

void main() {
    fragColor = vColor;
}
`;

const ATTRIBUTE_NAMES = ["aCorner", "aPos"] as const;

const UNIFORM_NAMES = [...PROJECT32_UNIFORMS, "uColor", "uProj", "uSizePx"] as const;

function rebindAttribute(source: AttributeBinding, size: 1 | 2): AttributeBinding {
    return { location: source.location, name: source.name, size, type: source.type };
}

/**
 * Instanced-triangle GL program for {@link MarkerDescriptor} — the GPU perf
 * path for high-volume markers (the correctness baseline is the shared
 * overlay glyph helper; see `glyphs.ts` / CLAUDE.md). One up-triangle instance
 * per `[x, y]` row, device-px-snapped via `project32`, sized in CSS-px
 * (`uSizePx = radiusPx * 2`) so a marker renders at a stable size at any DPR.
 * Color is descriptor-uniform.
 *
 * Extends {@link BaseProgram} for the canonical pack → upload → VAO →
 * setUniforms → draw lifecycle; the subclass owns the static unit-quad buffer,
 * the marker uniforms, and the per-draw blend enable.
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const gl: WebGL2RenderingContext;
 *     const program = MarkersProgram.get(gl);
 *     // program.draw({ descriptor, projection, viewportWidthPx, viewportHeightPx, dpr, paneKey });
 *     void program;
 */
export class MarkersProgram extends BaseProgram<MarkerDescriptor> {
    /** Resolve (compiling once) the per-`gl` singleton via the shared program cache. */
    static get(gl: WebGL2RenderingContext): MarkersProgram {
        return getProgram(gl, MARKERS_PROGRAM_KEY, () => new MarkersProgram(gl));
    }

    private readonly quadBuffer: WebGLBuffer;
    private readonly colorScratch: Float32Array;

    private constructor(gl: WebGL2RenderingContext) {
        super(gl, {
            attributes: ATTRIBUTE_NAMES,
            fsSource: FRAGMENT_SOURCE,
            poolKeySuffix: "markers",
            uniforms: UNIFORM_NAMES,
            vsSource: VERTEX_SOURCE,
        });

        this.colorScratch = new Float32Array(4);

        const quad = gl.createBuffer();
        if (quad === null) {
            throw new Error("MarkersProgram: gl.createBuffer returned null for unit-quad buffer");
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

    protected setUniforms(args: MarkersDrawArgs): void {
        const { descriptor, projection, viewportWidthPx, viewportHeightPx, dpr } = args;
        const { color, radiusPx } = descriptor;

        this.program.setUniformMatrix3fv("uProj", projection);
        this.program.setUniform2f("uViewportSize", viewportWidthPx, viewportHeightPx);
        this.program.setUniform1f("uDpr", dpr);
        // The descriptor carries a CSS-px radius; the triangle bounding box is
        // sized by its full edge length (diameter).
        this.program.setUniform1f("uSizePx", radiusPx * 2);

        this.colorScratch[0] = color[0];
        this.colorScratch[1] = color[1];
        this.colorScratch[2] = color[2];
        this.colorScratch[3] = color[3];
        this.program.setUniform4fv("uColor", this.colorScratch);
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
        evictProgram(this.gl, MARKERS_PROGRAM_KEY);
    }
}
