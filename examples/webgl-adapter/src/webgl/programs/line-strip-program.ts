// Ported from invinite src/components/trading-chart/webgl/programs/line-strip-program.ts @ cd883292.
// WebGL2 renderer adapted to the chartlang Adapter/emission contract.
// "Translate, not transcribe": invinite's horizontal/vertical-threshold
// branches, tcLog / traceIndicator / import.meta.env.DEV, and the typed
// program-cache record are dropped; pxToWorldX/Y are derived from the
// per-pane projection + device-px viewport, not passed in.

import type { LineStripDescriptor } from "../../layer-descriptor.js";
import { evictProgram, getProgram } from "../program-cache.js";
import type { AttributeBinding } from "../program.js";
import { assembleVertexShader } from "../shader-modules/assemble.js";
import { NAN_SKIP_VS_GLSL } from "../shader-modules/nan-skip.js";
import { Vao } from "../vao.js";
import { BaseProgram } from "./base-program.js";
import type { DrawArgs } from "./base-program.js";
import { LINE_STRIP_STRIDE_FLOATS, packLineStrip } from "./line-strip-pack.js";

/** Per-`gl` program-cache key for the singleton line-strip program. */
export const LINE_STRIP_PROGRAM_KEY = "line-strip";

/**
 * Draw-arg alias for the line-strip program. The renderer builds this from
 * the per-pane projection + device-px viewport; `drawOverride` derives the
 * pixel↔world scale from `projection` + `viewportWidthPx/HeightPx`.
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const args: LineStripDrawArgs;
 *     void args.descriptor.points;
 */
export type LineStripDrawArgs = DrawArgs<LineStripDescriptor>;

const VERTEX_SOURCE = assembleVertexShader({
    body: `
uniform mat3  uProj;
uniform float uPxToWorldX;
uniform float uPxToWorldY;
uniform float uHalfWidthPx;

in float aSide;
in vec2  aPrev;
in vec2  aCurrent;
in vec2  aNext;
in vec2  aFurther;
in float aArclengthStart;
in float aArclengthEnd;

// highp so the dashed-stroke arclength stays precise even for long polylines
// (a chartlang line uploads its whole series; a mediump varying loses integer
// precision past ~2048 px and collapses the dash mod() into a solid line).
out highp float vArclength;
out float vOnSide;

void main() {
  // gl_VertexID layout for the line-quad (drawArraysInstanced TRIANGLE_STRIP, 4 verts):
  //   v=0: isStart=true,  aSide=-1  -> start - perp
  //   v=1: isStart=true,  aSide=+1  -> start + perp
  //   v=2: isStart=false, aSide=-1  -> end   - perp
  //   v=3: isStart=false, aSide=+1  -> end   + perp
  // Use isStart = gl_VertexID < 2 (NOT (gl_VertexID & 1) == 0 — the and-1 form
  // collapses the quad to coincident points and rasterises nothing silently).
  bool isStart = gl_VertexID < 2;
  vec2 p0 = isStart ? aCurrent : aNext;

  if (nan_skip_segmentInvalid(aCurrent, aNext)) {
    gl_Position = vec4(0.0);
    vArclength = 0.0;
    vOnSide = 0.0;
    return;
  }

  vec2 dirPx = normalize(vec2((aNext.x - aCurrent.x) / uPxToWorldX,
                              (aNext.y - aCurrent.y) / uPxToWorldY));
  vec2 normalPx = vec2(-dirPx.y, dirPx.x);

  vec2 neighborPos = isStart ? aPrev : aFurther;
  vec2 neighborRef = isStart ? aCurrent : aNext;
  bool neighborValid = !nan_skip_neighborInvalid(neighborPos, neighborRef);

  vec2 miterPx;
  if (neighborValid) {
    vec2 dirNeighborPx;
    if (isStart) {
      dirNeighborPx = normalize(vec2((aCurrent.x - aPrev.x) / uPxToWorldX,
                                     (aCurrent.y - aPrev.y) / uPxToWorldY));
    } else {
      dirNeighborPx = normalize(vec2((aFurther.x - aNext.x) / uPxToWorldX,
                                     (aFurther.y - aNext.y) / uPxToWorldY));
    }
    vec2 normalNeighborPx = vec2(-dirNeighborPx.y, dirNeighborPx.x);
    miterPx = normalize(normalPx + normalNeighborPx);
    float miterScale = 1.0 / max(0.1, dot(miterPx, normalPx));
    miterPx *= miterScale;
  } else {
    miterPx = normalPx;
  }

  vec2 offsetWorld = vec2(miterPx.x * uHalfWidthPx * uPxToWorldX,
                          miterPx.y * uHalfWidthPx * uPxToWorldY) * aSide;

  vec2 worldPos = p0 + offsetWorld;
  gl_Position = vec4((uProj * vec3(worldPos, 1.0)).xy, 0.0, 1.0);

  vArclength = isStart ? aArclengthStart : aArclengthEnd;
  vOnSide = aSide;
}
`,
    modules: [NAN_SKIP_VS_GLSL],
});

const FRAGMENT_SOURCE = `#version 300 es
precision mediump float;

uniform vec4  uColor;
uniform float uDashOnPx;
uniform float uDashOffPx;

in highp float vArclength;
in float vOnSide;

out vec4 outColor;

void main() {
  if (uDashOffPx > 0.0) {
    float period = uDashOnPx + uDashOffPx;
    float t = mod(vArclength, period);
    if (t > uDashOnPx) discard;
  }
  outColor = uColor;
}
`;

const ATTRIBUTE_NAMES = [
    "aArclengthEnd",
    "aArclengthStart",
    "aCurrent",
    "aFurther",
    "aNext",
    "aPrev",
    "aSide",
] as const;

const UNIFORM_NAMES = [
    "uColor",
    "uDashOffPx",
    "uDashOnPx",
    "uHalfWidthPx",
    "uProj",
    "uPxToWorldX",
    "uPxToWorldY",
] as const;

// The four TRIANGLE_STRIP corners' side flags (-1 / +1 / -1 / +1) — a static
// per-vertex (divisor 0) buffer the whole program shares.
const SIDE_DATA = new Float32Array([-1, 1, -1, 1]);

const FLOAT_BYTES = 4;
const STRIDE_BYTES = LINE_STRIP_STRIDE_FLOATS * FLOAT_BYTES;

// The single shared scratch pool slot every line descriptor uploads its own
// segment bytes into. `scratch: true` opts it out of the same-frame
// upload-once gate (each descriptor writes legitimately divergent bytes).
const INSTANCE_BUFFER_ID = "line-strip-instance";

// Sentinel consumer key for the constructor's pre-acquire of the shared
// instance slot — never released, so the slot's lifetime is the program's
// lifetime (it frees through `BufferPool.dispose()`'s bulk teardown).
const LINE_STRIP_INSTANCE_HOLDER = "<line-strip-program-init>";

function vec2Binding(name: string, location: number): AttributeBinding {
    return { location, name, size: 2, type: 0x1406 };
}

function floatBinding(
    name: string,
    location: number,
    gl: WebGL2RenderingContext,
): AttributeBinding {
    return { location, name, size: 1, type: gl.FLOAT };
}

/**
 * Miter-joined, anti-aliased, dash-capable thick-polyline GL program for
 * {@link LineStripDescriptor}. The vertex shader expands a polyline of N
 * world-space points into a miter-joined TRIANGLE_STRIP of `2 * (N - 1)`
 * triangles, computing the miter direction from the neighbour segment normals
 * (`1 / dot(miter, normal)` scale; falling back to the segment normal when a
 * neighbour is NaN / coincident via `nan-skip`); the fragment shader supports
 * solid + dashed strokes via `mod(vArclength, period)`.
 *
 * Extends {@link BaseProgram} for `dispose` orchestration but supplies a
 * `drawOverride`: a single shared VAO + a single shared scratch instance pool
 * slot serve every pane (no per-pane VAO cache). `pxToWorldX/Y` (world units
 * per device pixel) are derived from the per-pane `projection` + device-px
 * `viewportWidthPx/HeightPx`, and the CSS-px `widthPx` / dash are scaled to
 * device px via `dpr`.
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const gl: WebGL2RenderingContext;
 *     const program = LineStripProgram.get(gl);
 *     // program.draw({ descriptor, projection, viewportWidthPx, viewportHeightPx, dpr, paneKey });
 *     void program;
 */
export class LineStripProgram extends BaseProgram<LineStripDescriptor> {
    /** Resolve (compiling once) the per-`gl` singleton via the shared program cache. */
    static get(gl: WebGL2RenderingContext): LineStripProgram {
        return getProgram(gl, LINE_STRIP_PROGRAM_KEY, () => new LineStripProgram(gl));
    }

    private readonly sideBuffer: WebGLBuffer;
    private readonly sharedVao: Vao;
    private readonly colorScratch: Float32Array;

    private constructor(gl: WebGL2RenderingContext) {
        super(gl, {
            attributes: ATTRIBUTE_NAMES,
            fsSource: FRAGMENT_SOURCE,
            // Unused — the drawOverride path uses INSTANCE_BUFFER_ID directly.
            poolKeySuffix: "instance",
            uniforms: UNIFORM_NAMES,
            vsSource: VERTEX_SOURCE,
        });

        this.colorScratch = new Float32Array(4);

        const sideBuffer = gl.createBuffer();
        if (sideBuffer === null) {
            throw new Error("LineStripProgram: gl.createBuffer returned null for aSide buffer");
        }
        this.sideBuffer = sideBuffer;

        gl.bindBuffer(gl.ARRAY_BUFFER, sideBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, SIDE_DATA, gl.STATIC_DRAW);

        // Pre-acquire wires the shared VAO bindings to the shared instance
        // slot. The sentinel consumer key is never released (slot lifetime =
        // program lifetime); `scratch: true` opts out of the upload-once gate.
        const instanceBuffer = this.bufferPool.acquire(
            INSTANCE_BUFFER_ID,
            LINE_STRIP_STRIDE_FLOATS,
            LINE_STRIP_INSTANCE_HOLDER,
            { scratch: true },
        );

        const sideLayout = {
            attribute: floatBinding("aSide", this.program.getAttribute("aSide").location, gl),
            buffer: { glBuffer: sideBuffer },
            divisor: 0,
            offset: 0,
            stride: FLOAT_BYTES,
        };

        this.sharedVao = new Vao(gl, [
            sideLayout,
            {
                attribute: vec2Binding("aPrev", this.program.getAttribute("aPrev").location),
                buffer: instanceBuffer,
                divisor: 1,
                offset: 0,
                stride: STRIDE_BYTES,
            },
            {
                attribute: vec2Binding("aCurrent", this.program.getAttribute("aCurrent").location),
                buffer: instanceBuffer,
                divisor: 1,
                offset: 2 * FLOAT_BYTES,
                stride: STRIDE_BYTES,
            },
            {
                attribute: vec2Binding("aNext", this.program.getAttribute("aNext").location),
                buffer: instanceBuffer,
                divisor: 1,
                offset: 4 * FLOAT_BYTES,
                stride: STRIDE_BYTES,
            },
            {
                attribute: vec2Binding("aFurther", this.program.getAttribute("aFurther").location),
                buffer: instanceBuffer,
                divisor: 1,
                offset: 6 * FLOAT_BYTES,
                stride: STRIDE_BYTES,
            },
            {
                attribute: floatBinding(
                    "aArclengthStart",
                    this.program.getAttribute("aArclengthStart").location,
                    gl,
                ),
                buffer: instanceBuffer,
                divisor: 1,
                offset: 8 * FLOAT_BYTES,
                stride: STRIDE_BYTES,
            },
            {
                attribute: floatBinding(
                    "aArclengthEnd",
                    this.program.getAttribute("aArclengthEnd").location,
                    gl,
                ),
                buffer: instanceBuffer,
                divisor: 1,
                offset: 9 * FLOAT_BYTES,
                stride: STRIDE_BYTES,
            },
        ]);
    }

    // `pack` / `buildVao` / `setUniforms` are unused — the drawOverride owns
    // the full custom flow (single shared VAO; draws by `segmentCount`).
    protected pack(): Float32Array {
        throw new Error("LineStripProgram.pack: drawOverride owns the pack flow");
    }

    protected buildVao(): Vao {
        throw new Error("LineStripProgram.buildVao: single shared VAO owned by the program");
    }

    protected setUniforms(): void {
        throw new Error("LineStripProgram.setUniforms: drawOverride owns the uniform flow");
    }

    /* v8 ignore start -- gl.* draw flow is browser-only; the example adapter is not coverage-gated */
    protected override drawOverride(args: LineStripDrawArgs): void {
        const { descriptor, projection, viewportWidthPx, viewportHeightPx, dpr, paneKey } = args;
        const { points, pointCount, color, widthPx, dash } = descriptor;

        if (pointCount < 2) return;

        // World units per device pixel, derived from the column-major ortho2d
        // matrix (sx = uProj[0], sy = uProj[4]) and the device-px viewport: the
        // NDC range is 2 across `viewport*Px` device pixels, and a world span of
        // `2 / s` maps to that NDC range, so worldPerDevicePx = 2 / (s * px).
        const pxToWorldX = 2 / (projection[0] * viewportWidthPx);
        const pxToWorldY = 2 / (projection[4] * viewportHeightPx);

        const packed = packLineStrip({ pointCount, points, pxToWorldX, pxToWorldY });
        if (packed.segmentCount === 0) return;

        const gl = this.gl;

        const pooled = this.bufferPool.acquire(
            INSTANCE_BUFFER_ID,
            packed.instanceData.length,
            paneKey,
            { scratch: true },
        );
        pooled.cpu.set(packed.instanceData);
        // Always full-upload: the instance layout is derived from the whole
        // points buffer + per-segment miter math, so a partial copy is invalid.
        this.bufferPool.upload(pooled);

        this.program.use();
        this.sharedVao.bind();

        this.program.setUniformMatrix3fv("uProj", projection);
        this.program.setUniform1f("uPxToWorldX", pxToWorldX);
        this.program.setUniform1f("uPxToWorldY", pxToWorldY);
        // CSS-px stroke width → device-px half-width.
        this.program.setUniform1f("uHalfWidthPx", widthPx * 0.5 * dpr);

        this.colorScratch[0] = color[0];
        this.colorScratch[1] = color[1];
        this.colorScratch[2] = color[2];
        this.colorScratch[3] = color[3];
        this.program.setUniform4fv("uColor", this.colorScratch);

        // CSS-px dash → device-px (arclength is in device px). Solid → off 0.
        const dashOnPx = dash === null ? 1 : dash[0] * dpr;
        const dashOffPx = dash === null ? 0 : dash[1] * dpr;
        this.program.setUniform1f("uDashOnPx", dashOnPx);
        this.program.setUniform1f("uDashOffPx", dashOffPx);

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, packed.segmentCount);

        this.sharedVao.unbind();
    }

    protected override prunePaneOverride(paneKey: string): void {
        this.bufferPool.disposeByConsumer(paneKey);
    }
    /* v8 ignore stop */

    protected override cleanupExtras(): void {
        this.sharedVao.dispose();
        this.gl.deleteBuffer(this.sideBuffer);
    }

    protected clearCacheSlot(): void {
        evictProgram(this.gl, LINE_STRIP_PROGRAM_KEY);
    }
}
