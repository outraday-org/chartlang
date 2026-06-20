// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Harmonic-pattern geometry moved from the canvas2d adapter's per-kind
// renderers
//   examples/canvas2d-adapter/src/render/draw/{xabcdPattern,
//   cypherPattern,headAndShoulders,abcdPattern,trianglePattern,
//   threeDrivesPattern}.ts.
// The originating math is invinite's pattern tools (commit
// 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite); re-licensed
// MIT for chartlang.

import type {
    AbcdPatternState,
    CypherPatternState,
    HeadAndShouldersState,
    ThreeDrivesPatternState,
    TrianglePatternState,
    XabcdPatternState,
} from "@invinite-org/chartlang-core";

import { dashPattern } from "../_lib/dash.js";
import { namedPolylinePrimitives } from "../_lib/namedPolyline.js";
import { worldPointToPixel } from "../project.js";
import type { DrawPrimitive, Viewport } from "../types.js";

const XABCD_LABELS: ReadonlyArray<string> = ["X", "A", "B", "C", "D"];
const HEAD_AND_SHOULDERS_LABELS: ReadonlyArray<string> = ["LS", "LL", "H", "RL", "RS"];
const ABCD_LABELS: ReadonlyArray<string> = ["A", "B", "C", "D"];
const TRIANGLE_LABELS: ReadonlyArray<string> = ["A", "B", "C"];
const THREE_DRIVES_LABELS: ReadonlyArray<string> = ["S", "D1", "R1", "D2", "R2", "D3", "E"];

const HEAD_AND_SHOULDERS_DEFAULT_COLOR = "#f59e0b";
const NECKLINE_WIDTH = 1;

/**
 * Decompose an `xabcd-pattern` drawing — a 4-leg labelled open polyline
 * through the 5 anchors (X-A-B-C-D), one `text` per pivot.
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const s: XabcdPatternState;
 *     declare const v: Viewport;
 *     const prims = decomposeXabcdPattern(s, v);
 *     void prims;
 */
export function decomposeXabcdPattern(
    state: XabcdPatternState,
    view: Viewport,
): ReadonlyArray<DrawPrimitive> {
    const points = state.anchors.map((p) => worldPointToPixel(p, view));
    return namedPolylinePrimitives(points, XABCD_LABELS, state.style);
}

/**
 * Decompose a `cypher-pattern` drawing — structurally identical to
 * `xabcd-pattern`: a 4-leg labelled open polyline through the 5 anchors
 * (X-A-B-C-D). The cypher fib-ratio invariants are a script-author
 * concern, not a geometry one.
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const s: CypherPatternState;
 *     declare const v: Viewport;
 *     const prims = decomposeCypherPattern(s, v);
 *     void prims;
 */
export function decomposeCypherPattern(
    state: CypherPatternState,
    view: Viewport,
): ReadonlyArray<DrawPrimitive> {
    const points = state.anchors.map((p) => worldPointToPixel(p, view));
    return namedPolylinePrimitives(points, XABCD_LABELS, state.style);
}

/**
 * Decompose a `head-and-shoulders` drawing — a 4-leg labelled open
 * polyline through the 5 anchors (LS-LL-H-RL-RS) plus a neckline
 * polyline between the two trough anchors (LL → RL).
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const s: HeadAndShouldersState;
 *     declare const v: Viewport;
 *     const prims = decomposeHeadAndShoulders(s, v);
 *     void prims;
 */
export function decomposeHeadAndShoulders(
    state: HeadAndShouldersState,
    view: Viewport,
): ReadonlyArray<DrawPrimitive> {
    const points = state.anchors.map((p) => worldPointToPixel(p, view));
    const out = [...namedPolylinePrimitives(points, HEAD_AND_SHOULDERS_LABELS, state.style)];
    out.push({
        kind: "polyline",
        points: [points[1], points[3]],
        closed: false,
        stroke: {
            color: state.style.color ?? HEAD_AND_SHOULDERS_DEFAULT_COLOR,
            width: NECKLINE_WIDTH,
            dash: dashPattern("solid"),
        },
    });
    return out;
}

/**
 * Decompose an `abcd-pattern` drawing — a 3-leg labelled open polyline
 * through the 4 anchors (A-B-C-D).
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const s: AbcdPatternState;
 *     declare const v: Viewport;
 *     const prims = decomposeAbcdPattern(s, v);
 *     void prims;
 */
export function decomposeAbcdPattern(
    state: AbcdPatternState,
    view: Viewport,
): ReadonlyArray<DrawPrimitive> {
    const points = state.anchors.map((p) => worldPointToPixel(p, view));
    return namedPolylinePrimitives(points, ABCD_LABELS, state.style);
}

/**
 * Decompose a `triangle-pattern` drawing — a 2-leg labelled open
 * polyline through the 3 anchors (A-B-C). Distinct from `draw.triangle`:
 * this is a `LineDrawStyle` harmonic outline, not a filled shape.
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const s: TrianglePatternState;
 *     declare const v: Viewport;
 *     const prims = decomposeTrianglePattern(s, v);
 *     void prims;
 */
export function decomposeTrianglePattern(
    state: TrianglePatternState,
    view: Viewport,
): ReadonlyArray<DrawPrimitive> {
    const points = state.anchors.map((p) => worldPointToPixel(p, view));
    return namedPolylinePrimitives(points, TRIANGLE_LABELS, state.style);
}

/**
 * Decompose a `three-drives-pattern` drawing — a 6-leg labelled open
 * polyline through the 7 anchors (start → d1 → r1 → d2 → r2 → d3 → end).
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const s: ThreeDrivesPatternState;
 *     declare const v: Viewport;
 *     const prims = decomposeThreeDrivesPattern(s, v);
 *     void prims;
 */
export function decomposeThreeDrivesPattern(
    state: ThreeDrivesPatternState,
    view: Viewport,
): ReadonlyArray<DrawPrimitive> {
    const points = state.anchors.map((p) => worldPointToPixel(p, view));
    return namedPolylinePrimitives(points, THREE_DRIVES_LABELS, state.style);
}
