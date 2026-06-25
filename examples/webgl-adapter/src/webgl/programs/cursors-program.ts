// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

// Ported from invinite src/components/trading-chart/webgl/programs/cursors-program.ts @ cd883292.
// WebGL2 renderer adapted to the chartlang Adapter/emission contract.
// "Translate, not transcribe": React/bus coupling + tcLog dropped; the typed
// program-cache record becomes the generic getProgram/evictProgram singleton,
// and pxToWorldX/Y are DERIVED from the per-pane projection + device-px
// viewport (the line-strip pattern), not passed in through DrawArgs.

import type { CursorDescriptor } from "../../layer-descriptor.js";
import type { PooledBuffer } from "../buffer-pool.js";
import { UNIT_QUAD_TRIANGLE_STRIP } from "../geometry.js";
import { evictProgram, getProgram } from "../program-cache.js";
import type { AttributeBinding } from "../program.js";
import { AA_FS_GLSL } from "../shader-modules/aa.js";
import { assembleFragmentShader } from "../shader-modules/assemble.js";
import { Vao } from "../vao.js";
import { BaseProgram } from "./base-program.js";
import type { DrawArgs } from "./base-program.js";
import {
    CURSOR_OFFSET_COLOR,
    CURSOR_OFFSET_POS,
    CURSOR_STRIDE_BYTES,
    packCursors,
} from "./cursor-pack.js";

/** Per-`gl` program-cache key for the singleton cursors program. */
export const CURSORS_PROGRAM_KEY = "cursors";

/**
 * Draw-arg alias for the cursors program. The renderer builds this from the
 * per-pane projection + device-px viewport; `setUniforms` derives the
 * pixel↔world scale from `projection` + `viewportWidthPx/HeightPx`.
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const args: CursorsDrawArgs;
 *     void args.descriptor.radiusPx;
 */
export type CursorsDrawArgs = DrawArgs<CursorDescriptor>;

const VERTEX_SOURCE = `#version 300 es
precision highp float;

uniform mat3 uProj;
uniform float uPxToWorldX;
uniform float uPxToWorldY;
uniform float uRadiusPx;

in vec2 aCorner;
in vec2 aPos;
in vec4 aColor;

out vec2 vLocalNorm;
out vec4 vColor;

void main() {
    float halfX = uRadiusPx * uPxToWorldX;
    float halfY = uRadiusPx * uPxToWorldY;
    vec2 worldPos = aPos + aCorner * vec2(halfX, halfY);
    gl_Position = vec4((uProj * vec3(worldPos, 1.0)).xy, 0.0, 1.0);
    vLocalNorm = aCorner;
    vColor = aColor;
}
`;

const FRAGMENT_SOURCE = assembleFragmentShader({
    body: `
in vec2 vLocalNorm;
in vec4 vColor;

out vec4 outColor;

void main() {
    float alpha = disk_aa_alpha(vLocalNorm);
    if (alpha <= 0.0) discard;
    outColor = vec4(vColor.rgb, vColor.a * alpha);
}
`,
    modules: [AA_FS_GLSL],
});

const ATTRIBUTE_NAMES = ["aColor", "aCorner", "aPos"] as const;

const UNIFORM_NAMES = ["uProj", "uPxToWorldX", "uPxToWorldY", "uRadiusPx"] as const;

// Re-stamp a resolved attribute binding with the `size` the VAO layout needs
// (the program resolves every attribute at size 1; `aCorner`/`aPos` are vec2,
// `aColor` is vec4).
function rebindAttribute(source: AttributeBinding, size: 1 | 2 | 4): AttributeBinding {
    return { location: source.location, name: source.name, size, type: source.type };
}

/**
 * Instanced unit-quad GL program for {@link CursorDescriptor} — the crosshair
 * cursor dots / halos. Per-vertex `aCorner` spans `(-1,-1)..(1,1)` and is
 * interpolated into the fragment as `vLocalNorm`; the fragment computes
 * `disk_aa_alpha` (an `fwidth`-based `smoothstep` for a sub-pixel-AA disk edge,
 * from `aa.ts`). Per-instance `aPos` (world position) + `aColor` (unit RGBA)
 * come from the descriptor's `[x, y, r, g, b, a]` `rows`; `uRadiusPx` is the
 * descriptor-uniform CSS-px radius scaled to world via the DERIVED
 * `pxToWorldX/Y`.
 *
 * Extends {@link BaseProgram} for the canonical pack → upload → VAO →
 * setUniforms → draw lifecycle; the subclass owns the static unit-quad buffer,
 * the cursor uniforms, and the premultiplied-alpha blend enable.
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const gl: WebGL2RenderingContext;
 *     const program = CursorsProgram.get(gl);
 *     // program.draw({ descriptor, projection, viewportWidthPx, viewportHeightPx, dpr, paneKey });
 *     void program;
 */
export class CursorsProgram extends BaseProgram<CursorDescriptor> {
    /** Resolve (compiling once) the per-`gl` singleton via the shared program cache. */
    static get(gl: WebGL2RenderingContext): CursorsProgram {
        return getProgram(gl, CURSORS_PROGRAM_KEY, () => new CursorsProgram(gl));
    }

    private readonly quadBuffer: WebGLBuffer;

    private constructor(gl: WebGL2RenderingContext) {
        super(gl, {
            attributes: ATTRIBUTE_NAMES,
            fsSource: FRAGMENT_SOURCE,
            poolKeySuffix: "cursors",
            uniforms: UNIFORM_NAMES,
            vsSource: VERTEX_SOURCE,
        });

        const quad = gl.createBuffer();
        if (quad === null) {
            throw new Error("CursorsProgram: gl.createBuffer returned null for unit-quad buffer");
        }
        this.quadBuffer = quad;

        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, UNIT_QUAD_TRIANGLE_STRIP, gl.STATIC_DRAW);
    }

    protected pack(descriptor: CursorDescriptor): Float32Array {
        return packCursors(descriptor);
    }

    protected buildVao(pooled: PooledBuffer): Vao {
        const cornerBinding = rebindAttribute(this.program.getAttribute("aCorner"), 2);
        const posBinding = rebindAttribute(this.program.getAttribute("aPos"), 2);
        const colorBinding = rebindAttribute(this.program.getAttribute("aColor"), 4);

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
                offset: CURSOR_OFFSET_POS,
                stride: CURSOR_STRIDE_BYTES,
            },
            {
                attribute: colorBinding,
                buffer: pooled,
                divisor: 1,
                offset: CURSOR_OFFSET_COLOR,
                stride: CURSOR_STRIDE_BYTES,
            },
        ]);
    }

    protected setUniforms(args: CursorsDrawArgs): void {
        const { descriptor, projection, viewportWidthPx, viewportHeightPx } = args;

        // World units per device pixel, derived from the column-major ortho2d
        // matrix (sx = proj[0], sy = proj[4]) + the device-px viewport — the
        // same derivation the line-strip program uses (invinite passed these
        // through DrawArgs; our DrawArgs carry projection + viewport instead).
        const pxToWorldX = 2 / (projection[0] * viewportWidthPx);
        const pxToWorldY = 2 / (projection[4] * viewportHeightPx);

        this.program.setUniformMatrix3fv("uProj", projection);
        this.program.setUniform1f("uPxToWorldX", pxToWorldX);
        this.program.setUniform1f("uPxToWorldY", pxToWorldY);
        this.program.setUniform1f("uRadiusPx", descriptor.radiusPx);
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
        evictProgram(this.gl, CURSORS_PROGRAM_KEY);
    }
}
