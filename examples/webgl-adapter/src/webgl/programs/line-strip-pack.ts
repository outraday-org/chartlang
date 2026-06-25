// Ported from invinite src/components/trading-chart/webgl/programs/line-strip-pack.ts @ cd883292.
// WebGL2 renderer adapted to the chartlang Adapter/emission contract.
// "Translate, not transcribe": invinite's horizontal/vertical-threshold
// packers are dropped (this adapter has a single LineStripDescriptor); only
// the core polyline packer is ported, plus a shared-spline run sampler.

import { monotoneCubicSegments } from "@invinite-org/chartlang-adapter-kit";

/**
 * Per-instance stride for the line-strip buffer, in floats. The packer fills
 * `[prev.x, prev.y, current.x, current.y, next.x, next.y, further.x,
 * further.y, arclengthStart, arclengthEnd, pad0, pad1]` per segment — the two
 * trailing pads keep the layout a multiple of 16 bytes (a future vec4
 * attribute can claim them).
 *
 * @since 0.1
 * @stable
 * @example
 *     LINE_STRIP_STRIDE_FLOATS === 12;
 */
export const LINE_STRIP_STRIDE_FLOATS = 12;

/**
 * Result of {@link packLineStrip}: the interleaved per-segment instance buffer
 * (stride {@link LINE_STRIP_STRIDE_FLOATS}), the segment count
 * (`pointCount - 1`, clamped `>= 0`), and the per-point cumulative arclength.
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const r: LineStripPackResult;
 *     // r.instanceData.length === r.segmentCount * LINE_STRIP_STRIDE_FLOATS
 *     void r;
 */
export type LineStripPackResult = {
    /** Interleaved per-segment instance buffer; stride {@link LINE_STRIP_STRIDE_FLOATS}. */
    readonly instanceData: Float32Array;
    /** Number of segments (`pointCount - 1`, clamped `>= 0`). */
    readonly segmentCount: number;
    /** Cumulative arclength (pixel units), length `pointCount`, `[0] === 0`. */
    readonly cumulativePx: Float32Array;
};

/**
 * Build the per-segment instance buffer + cumulative arclength for an N-point
 * world-space polyline. `pxToWorldX` / `pxToWorldY` convert world deltas to
 * pixel units (`worldDelta / pxToWorldX`) so the arclength the dash fragment
 * shader reads is in pixels.
 *
 * NaN points (warmup gaps, intermittent NaN) carry the last finite arclength
 * across the gap rather than poisoning `cumulativePx` forward — a propagated
 * NaN would make `mod(vArclength, period)` NaN in the fragment shader and
 * collapse a dashed stroke to solid (the `discard` for `NaN > onPx` never
 * fires). The `aCurrent` / `aNext` slots still carry the raw NaN, which the
 * vertex shader detects (`nan_skip_segmentInvalid`) and collapses to a
 * zero-area triangle.
 *
 * @since 0.1
 * @stable
 * @example
 *     const r = packLineStrip({
 *         points: new Float32Array([0, 0, 1, 1]),
 *         pointCount: 2,
 *         pxToWorldX: 1,
 *         pxToWorldY: 1,
 *     });
 *     // r.segmentCount === 1
 *     void r;
 */
export function packLineStrip(args: {
    readonly points: Float32Array;
    readonly pointCount: number;
    readonly pxToWorldX: number;
    readonly pxToWorldY: number;
}): LineStripPackResult {
    const { points, pointCount, pxToWorldX, pxToWorldY } = args;

    const segmentCount = Math.max(0, pointCount - 1);

    const cumulativePx = new Float32Array(pointCount);
    if (pointCount > 0) cumulativePx[0] = 0;

    for (let i = 1; i < pointCount; i += 1) {
        const x0 = points[(i - 1) * 2];
        const y0 = points[(i - 1) * 2 + 1];
        const x1 = points[i * 2];
        const y1 = points[i * 2 + 1];

        const dxPx = (x1 - x0) / pxToWorldX;
        const dyPx = (y1 - y0) / pxToWorldY;
        const distPx = Math.sqrt(dxPx * dxPx + dyPx * dyPx);

        // A NaN segment must NOT poison every subsequent arclength — carry the
        // last finite value across the gap; the NaN endpoints still collapse
        // the segment to zero-area in the vertex shader.
        const prev = Number.isFinite(cumulativePx[i - 1]) ? cumulativePx[i - 1] : 0;
        cumulativePx[i] = Number.isFinite(distPx) ? prev + distPx : prev;
    }

    const instanceData = new Float32Array(segmentCount * LINE_STRIP_STRIDE_FLOATS);

    for (let i = 0; i < segmentCount; i += 1) {
        const prevIdx = i > 0 ? i - 1 : i;
        const furtherIdx = i + 2 < pointCount ? i + 2 : i + 1;
        const base = i * LINE_STRIP_STRIDE_FLOATS;

        instanceData[base + 0] = points[prevIdx * 2];
        instanceData[base + 1] = points[prevIdx * 2 + 1];
        instanceData[base + 2] = points[i * 2];
        instanceData[base + 3] = points[i * 2 + 1];
        instanceData[base + 4] = points[(i + 1) * 2];
        instanceData[base + 5] = points[(i + 1) * 2 + 1];
        instanceData[base + 6] = points[furtherIdx * 2];
        instanceData[base + 7] = points[furtherIdx * 2 + 1];
        instanceData[base + 8] = cumulativePx[i];
        instanceData[base + 9] = cumulativePx[i + 1];
        instanceData[base + 10] = 0;
        instanceData[base + 11] = 0;
    }

    return { cumulativePx, instanceData, segmentCount };
}

// Number of intermediate samples inserted per finite gap when densifying a
// default `line` plot through the monotone-cubic spline. A few points per gap
// is enough for visual smoothness without inflating the GPU upload — the GPU
// then miter-joins the dense polyline into a curve.
const SAMPLES_PER_GAP = 6;

// Evaluate a cubic Bézier (start s, controls c1/c2, end e) at parameter t.
function bezierAt(s: number, c1: number, c2: number, e: number, t: number): number {
    const u = 1 - t;
    return u * u * u * s + 3 * u * u * t * c1 + 3 * u * t * t * c2 + t * t * t * e;
}

/**
 * Densify a world-space `[x0, y0, x1, y1, …]` point buffer into a smooth
 * monotone-cubic curve sampled into denser line-strip points, so the GPU
 * line program — which has no native curve — draws the same smooth default
 * `line` the canvas2d / konva / echarts / uplot / lightweight-charts adapters
 * render. The shared {@link monotoneCubicSegments} (Fritsch–Carlson, passes
 * through every point, no overshoot) is the single curve source; do NOT fork
 * a parallel sampler.
 *
 * NaN gaps split the polyline into independent finite runs — each run is
 * sampled on its own, and the NaN point is preserved between runs so the
 * program still skips the bridging segment. A run of fewer than three finite
 * points (or a sampler that returns nothing) passes straight through
 * unchanged. `step-line` and area edges must NOT call this (they stay
 * straight); the caller gates on the plot style.
 *
 * @since 0.1
 * @stable
 * @example
 *     const dense = sampleMonotoneRuns(
 *         new Float32Array([0, 0, 1, 1, 2, 0]),
 *         3,
 *     );
 *     // dense.length > 3 * 2  (intermediate points inserted)
 *     void dense;
 */
export function sampleMonotoneRuns(points: Float32Array, pointCount: number): Float32Array {
    if (pointCount < 2) return points.subarray(0, pointCount * 2);

    const out: number[] = [];
    let run: { x: number; y: number }[] = [];

    const flushRun = (): void => {
        if (run.length < 3) {
            // Too short to smooth — emit the raw run verbatim.
            for (const p of run) out.push(p.x, p.y);
            run = [];
            return;
        }
        out.push(run[0].x, run[0].y);
        const segs = monotoneCubicSegments(run);
        for (let s = 0; s < segs.length; s += 1) {
            const seg = segs[s];
            const p0 = run[s];
            // Intermediate samples (t in (0, 1)); the segment end (t = 1) is the
            // next run point, emitted as that segment's start or the final push.
            for (let k = 1; k < SAMPLES_PER_GAP; k += 1) {
                const t = k / SAMPLES_PER_GAP;
                const x = bezierAt(p0.x, seg.c1x, seg.c2x, seg.x, t);
                const y = bezierAt(p0.y, seg.c1y, seg.c2y, seg.y, t);
                out.push(x, y);
            }
            out.push(seg.x, seg.y);
        }
        run = [];
    };

    for (let i = 0; i < pointCount; i += 1) {
        const x = points[i * 2];
        const y = points[i * 2 + 1];
        if (Number.isFinite(y)) {
            run.push({ x, y });
        } else {
            // Close the current finite run, then re-emit the NaN point so the
            // program opens a gap between runs.
            flushRun();
            out.push(x, y);
        }
    }
    flushRun();

    return new Float32Array(out);
}
