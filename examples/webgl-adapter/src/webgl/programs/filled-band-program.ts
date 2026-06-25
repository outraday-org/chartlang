// Ported from invinite src/components/trading-chart/webgl/programs/filled-band-program.ts @ cd883292.
// WebGL2 renderer adapted to the chartlang Adapter/emission contract.
// "Translate, not transcribe": React/bus coupling + tcLog dropped; the typed
// program-cache record + invinite's per-vertex above/below color swap are
// dropped — our FilledBandDescriptor bakes world x in and carries ONE uniform
// color, so vertices pack `[x, y]` only and color rides a uColor uniform.

import type { FilledBandDescriptor } from "../../layer-descriptor.js";
import type { PooledBuffer } from "../buffer-pool.js";
import { evictProgram, getProgram } from "../program-cache.js";
import type { AttributeBinding } from "../program.js";
import { Vao } from "../vao.js";
import { BaseProgram } from "./base-program.js";
import type { DrawArgs } from "./base-program.js";
import { FILLED_BAND_STRIDE_BYTES, packFilledBand } from "./filled-band-pack.js";

/** Per-`gl` program-cache key for the singleton filled-band program. */
export const FILLED_BAND_PROGRAM_KEY = "filled-band";

/**
 * Draw-arg alias for the filled-band program. The renderer builds this from
 * the per-pane projection + device-px viewport (only `projection` + `paneKey`
 * are consumed — the band needs no px↔world scale).
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const args: FilledBandDrawArgs;
 *     void args.descriptor.upper;
 */
export type FilledBandDrawArgs = DrawArgs<FilledBandDescriptor>;

// World-pos projected straight through uProj — NO sub-pixel snap. A filled
// band must stay stable under pan/zoom; a snap would shimmer the polygon edges
// (invinite's contract).
const VERTEX_SOURCE = `#version 300 es
precision highp float;

uniform mat3 uProj;

in vec2 aWorldPos;

void main() {
    gl_Position = vec4((uProj * vec3(aWorldPos, 1.0)).xy, 0.0, 1.0);
}
`;

// Single uniform color (with alpha) — the program stays stateless across band
// instances; every band's translucency rides on the descriptor's color alpha.
const FRAGMENT_SOURCE = `#version 300 es
precision highp float;

uniform vec4 uColor;

out vec4 fragColor;

void main() {
    fragColor = uColor;
}
`;

const ATTRIBUTE_NAMES = ["aWorldPos"] as const;

const UNIFORM_NAMES = ["uColor", "uProj"] as const;

// Re-stamp the resolved single-size attribute binding as the vec2 the VAO
// layout needs (the program resolves every attribute at size 1).
function vec2Binding(source: AttributeBinding): AttributeBinding {
    return { location: source.location, name: source.name, size: 2, type: source.type };
}

/**
 * Triangle-strip GL program for {@link FilledBandDescriptor}: an alpha-blended
 * fill between two aligned world-space edge polylines. {@link packFilledBand}
 * walks the `upper` / `lower` arrays into a NaN-separated set of runs, each a
 * single `gl.drawArrays(TRIANGLE_STRIP, vertexOffset, vertexCount)` call so a
 * per-column gap cleanly splits the strip — no triangle spans a gap. The world
 * position projects straight through `uProj` with NO sub-pixel snap (band
 * edges must not shimmer under pan/zoom), and the single `uColor` uniform
 * (with descriptor alpha) keeps the program stateless across bands.
 *
 * Extends {@link BaseProgram} for the `dispose` / `prunePane` lifecycle but
 * supplies a `drawOverride` because the draw shape diverges from the canonical
 * instanced strip: filled-band issues one `drawArrays` per NaN-separated run,
 * not a single `drawArraysInstanced`. `pack` / `buildVao` / `setUniforms` are
 * therefore unused (they throw — `drawOverride` owns the flow), like the
 * line-strip program.
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const gl: WebGL2RenderingContext;
 *     const program = FilledBandProgram.get(gl);
 *     // program.draw({ descriptor, projection, viewportWidthPx, viewportHeightPx, dpr, paneKey });
 *     void program;
 */
export class FilledBandProgram extends BaseProgram<FilledBandDescriptor> {
    /** Resolve (compiling once) the per-`gl` singleton via the shared program cache. */
    static get(gl: WebGL2RenderingContext): FilledBandProgram {
        return getProgram(gl, FILLED_BAND_PROGRAM_KEY, () => new FilledBandProgram(gl));
    }

    private readonly colorScratch: Float32Array;

    private constructor(gl: WebGL2RenderingContext) {
        super(gl, {
            attributes: ATTRIBUTE_NAMES,
            fsSource: FRAGMENT_SOURCE,
            poolKeySuffix: FILLED_BAND_PROGRAM_KEY,
            uniforms: UNIFORM_NAMES,
            vsSource: VERTEX_SOURCE,
        });

        this.colorScratch = new Float32Array(4);
    }

    // `pack` / `buildVao` / `setUniforms` are unused — the drawOverride owns
    // the full custom flow (per-descriptor pool slot; draws by run).
    protected pack(): Float32Array {
        throw new Error("FilledBandProgram.pack: drawOverride owns the pack flow");
    }

    protected buildVao(): Vao {
        throw new Error("FilledBandProgram.buildVao: drawOverride owns the VAO flow");
    }

    protected setUniforms(): void {
        throw new Error("FilledBandProgram.setUniforms: drawOverride owns the uniform flow");
    }

    /* v8 ignore start -- gl.* draw flow is browser-only; the example adapter is not coverage-gated */
    protected override drawOverride(args: FilledBandDrawArgs): void {
        const { descriptor, projection, paneKey } = args;
        const { color } = descriptor;

        const packed = packFilledBand(descriptor);
        if (packed.runs.length === 0) return;

        const gl = this.gl;
        const poolKey = `${descriptor.id}:${this.poolKeySuffix}`;
        const pooled = this.bufferPool.acquire(poolKey, packed.vertices.length, paneKey);
        pooled.cpu.set(packed.vertices, 0);
        this.bufferPool.upload(pooled);

        let vao = this.vaoCache.get(poolKey);
        if (vao === undefined) {
            vao = this.buildVaoForSlot(pooled);
            this.vaoCache.set(poolKey, vao);
        }

        this.program.use();
        this.program.setUniformMatrix3fv("uProj", projection);

        this.colorScratch[0] = color[0];
        this.colorScratch[1] = color[1];
        this.colorScratch[2] = color[2];
        this.colorScratch[3] = color[3];
        this.program.setUniform4fv("uColor", this.colorScratch);

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        vao.bind();
        for (const run of packed.runs) {
            gl.drawArrays(gl.TRIANGLE_STRIP, run.vertexOffset, run.vertexCount);
        }
        vao.unbind();
    }

    private buildVaoForSlot(pooled: PooledBuffer): Vao {
        const worldPosBinding = vec2Binding(this.program.getAttribute("aWorldPos"));
        return new Vao(this.gl, [
            {
                attribute: worldPosBinding,
                buffer: pooled,
                offset: 0,
                stride: FILLED_BAND_STRIDE_BYTES,
            },
        ]);
    }

    protected override prunePaneOverride(paneKey: string): void {
        const freed = this.bufferPool.disposeByConsumer(paneKey);
        for (const slotId of freed) {
            const vao = this.vaoCache.get(slotId);
            if (vao === undefined) continue;
            vao.dispose();
            this.vaoCache.delete(slotId);
        }
    }
    /* v8 ignore stop */

    protected clearCacheSlot(): void {
        evictProgram(this.gl, FILLED_BAND_PROGRAM_KEY);
    }
}
