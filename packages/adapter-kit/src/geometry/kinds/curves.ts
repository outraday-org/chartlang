// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Curve geometry moved from the canvas2d adapter's per-kind renderers
//   examples/canvas2d-adapter/src/render/draw/{arc,curve,doubleCurve}.ts.
// The originating math is invinite's arc / curve / double-curve tools
// (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite);
// re-licensed MIT for chartlang.

import type { ArcState, CurveState, DoubleCurveState } from "@invinite-org/chartlang-core";

import { sampleCubic, sampleQuadratic } from "../_lib/bezier.js";
import { dashPattern } from "../_lib/dash.js";
import { worldPointToPixel } from "../project.js";
import type { DrawPrimitive, StrokeStyle, Viewport } from "../types.js";

const DEFAULT_COLOR = "#000000";
const DEFAULT_LINE_WIDTH = 1;

/**
 * Number of polyline segments each curve is sampled into — matching the
 * canvas2d source renderers exactly (the structural `RenderCtx` exposes
 * no `quadraticCurveTo` / `bezierCurveTo`, so every curve is stroked as
 * a sampled polyline).
 */
const CURVE_SAMPLES = 32;

function strokeOf(style: {
    readonly color?: string | undefined;
    readonly lineWidth?: number | undefined;
    readonly lineStyle?: "solid" | "dashed" | "dotted" | undefined;
}): StrokeStyle {
    return {
        color: style.color ?? DEFAULT_COLOR,
        width: style.lineWidth ?? DEFAULT_LINE_WIDTH,
        dash: dashPattern(style.lineStyle ?? "solid"),
    };
}

/**
 * Decompose an `arc` drawing — a quadratic Bezier whose middle anchor
 * (the apex) lies ON the curve at `t = 0.5`. The off-curve control point
 * is derived by inverse-quadratic interpolation
 * (`2·apex − 0.5·(from + to)`) so the sampled curve passes through the
 * apex, then sampled into one open {@link CURVE_SAMPLES}-segment
 * polyline.
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const s: ArcState;
 *     declare const v: Viewport;
 *     const prims = decomposeArc(s, v);
 *     // prims[0].kind === "polyline"; prims[0].closed === false
 *     void prims;
 */
export function decomposeArc(state: ArcState, view: Viewport): ReadonlyArray<DrawPrimitive> {
    const from = worldPointToPixel(state.anchors[0], view);
    const apex = worldPointToPixel(state.anchors[1], view);
    const to = worldPointToPixel(state.anchors[2], view);
    const control = {
        x: 2 * apex.x - 0.5 * (from.x + to.x),
        y: 2 * apex.y - 0.5 * (from.y + to.y),
    };
    return [
        {
            kind: "polyline",
            points: sampleQuadratic(from, control, to, CURVE_SAMPLES),
            closed: false,
            stroke: strokeOf(state.style),
        },
    ];
}

/**
 * Decompose a `curve` drawing — a quadratic Bezier whose middle anchor
 * IS the off-curve control point (distinct from `arc`, whose apex lies
 * on the curve). Sampled into one open {@link CURVE_SAMPLES}-segment
 * polyline.
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const s: CurveState;
 *     declare const v: Viewport;
 *     const prims = decomposeCurve(s, v);
 *     void prims;
 */
export function decomposeCurve(state: CurveState, view: Viewport): ReadonlyArray<DrawPrimitive> {
    const from = worldPointToPixel(state.anchors[0], view);
    const control = worldPointToPixel(state.anchors[1], view);
    const to = worldPointToPixel(state.anchors[2], view);
    return [
        {
            kind: "polyline",
            points: sampleQuadratic(from, control, to, CURVE_SAMPLES),
            closed: false,
            stroke: strokeOf(state.style),
        },
    ];
}

/**
 * Decompose a `double-curve` drawing — a single cubic Bezier from
 * `anchors[0]` to `anchors[4]` with off-curve controls `anchors[1]` and
 * `anchors[3]`. The middle stitch anchor `anchors[2]` is preserved in
 * state but unused by the current single-cubic render path (matching the
 * canvas2d source). Sampled into one open {@link CURVE_SAMPLES}-segment
 * polyline.
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const s: DoubleCurveState;
 *     declare const v: Viewport;
 *     const prims = decomposeDoubleCurve(s, v);
 *     void prims;
 */
export function decomposeDoubleCurve(
    state: DoubleCurveState,
    view: Viewport,
): ReadonlyArray<DrawPrimitive> {
    const p0 = worldPointToPixel(state.anchors[0], view);
    const p1 = worldPointToPixel(state.anchors[1], view);
    const p3 = worldPointToPixel(state.anchors[3], view);
    const p4 = worldPointToPixel(state.anchors[4], view);
    return [
        {
            kind: "polyline",
            points: sampleCubic(p0, p1, p3, p4, CURVE_SAMPLES),
            closed: false,
            stroke: strokeOf(state.style),
        },
    ];
}
