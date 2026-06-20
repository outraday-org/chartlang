// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Elliott-wave geometry moved from the canvas2d adapter's per-kind
// renderers
//   examples/canvas2d-adapter/src/render/draw/{elliottImpulseWave,
//   elliottCorrectionWave,elliottTriangleWave,elliottDoubleCombo,
//   elliottTripleCombo}.ts.
// The originating math is invinite's elliott-wave tools (commit
// 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite); re-licensed
// MIT for chartlang.

import type {
    ElliottCorrectionWaveState,
    ElliottDoubleComboState,
    ElliottImpulseWaveState,
    ElliottTriangleWaveState,
    ElliottTripleComboState,
    LineDrawStyle,
} from "@invinite-org/chartlang-core";

import { namedPolylinePrimitives } from "../_lib/namedPolyline.js";
import { worldPointToPixel } from "../project.js";
import type { DrawPrimitive, Point2, Viewport } from "../types.js";

const ELLIOTT_DEFAULT_COLOR = "#14b8a6";

const IMPULSE_LABELS: ReadonlyArray<string> = ["1", "2", "3", "4", "5"];
const CORRECTION_LABELS: ReadonlyArray<string> = ["A", "B", "C"];
const TRIANGLE_LABELS: ReadonlyArray<string> = ["a", "b", "c", "d", "e"];
const DOUBLE_COMBO_LABELS: ReadonlyArray<string> = ["S", "W", "x1", "X", "x2", "Yi", "Y"];
const TRIPLE_COMBO_LABELS: ReadonlyArray<string> = ["S", "W", "X1", "Y", "X2", "Zi", "Z"];

/**
 * Shared elliott-wave decomposer: project the anchors, choose
 * `state.labels` when present and length-matching (else `defaults`), and
 * emit a labelled open polyline. The teal default colour is applied
 * unless `style.color` overrides it — mirroring the source's
 * `{ color: "#14b8a6", ...state.style }` spread.
 */
function decomposeElliott(
    points: ReadonlyArray<Point2>,
    labels: ReadonlyArray<string> | undefined,
    defaults: ReadonlyArray<string>,
    style: LineDrawStyle,
): ReadonlyArray<DrawPrimitive> {
    const resolved = labels !== undefined && labels.length === points.length ? labels : defaults;
    return namedPolylinePrimitives(points, resolved, { color: ELLIOTT_DEFAULT_COLOR, ...style });
}

/**
 * Decompose an `elliott-impulse-wave` drawing — a 4-leg labelled open
 * polyline through the 5 anchors (1-2-3-4-5). `state.labels` overrides
 * the default `["1","2","3","4","5"]` when present and length-matching.
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const s: ElliottImpulseWaveState;
 *     declare const v: Viewport;
 *     const prims = decomposeElliottImpulseWave(s, v);
 *     void prims;
 */
export function decomposeElliottImpulseWave(
    state: ElliottImpulseWaveState,
    view: Viewport,
): ReadonlyArray<DrawPrimitive> {
    const points = state.anchors.map((p) => worldPointToPixel(p, view));
    return decomposeElliott(points, state.labels, IMPULSE_LABELS, state.style);
}

/**
 * Decompose an `elliott-correction-wave` drawing — a 2-leg labelled open
 * polyline through the 3 anchors (A-B-C). `state.labels` overrides the
 * default `["A","B","C"]` when present and length-matching.
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const s: ElliottCorrectionWaveState;
 *     declare const v: Viewport;
 *     const prims = decomposeElliottCorrectionWave(s, v);
 *     void prims;
 */
export function decomposeElliottCorrectionWave(
    state: ElliottCorrectionWaveState,
    view: Viewport,
): ReadonlyArray<DrawPrimitive> {
    const points = state.anchors.map((p) => worldPointToPixel(p, view));
    return decomposeElliott(points, state.labels, CORRECTION_LABELS, state.style);
}

/**
 * Decompose an `elliott-triangle-wave` drawing — a 4-leg labelled open
 * polyline through the 5 anchors (a-b-c-d-e). `state.labels` overrides
 * the default `["a","b","c","d","e"]` when present and length-matching.
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const s: ElliottTriangleWaveState;
 *     declare const v: Viewport;
 *     const prims = decomposeElliottTriangleWave(s, v);
 *     void prims;
 */
export function decomposeElliottTriangleWave(
    state: ElliottTriangleWaveState,
    view: Viewport,
): ReadonlyArray<DrawPrimitive> {
    const points = state.anchors.map((p) => worldPointToPixel(p, view));
    return decomposeElliott(points, state.labels, TRIANGLE_LABELS, state.style);
}

/**
 * Decompose an `elliott-double-combo` drawing — a 6-leg labelled open
 * polyline through the 7 anchors. `state.labels` overrides the default
 * `["S","W","x1","X","x2","Yi","Y"]` when present and length-matching.
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const s: ElliottDoubleComboState;
 *     declare const v: Viewport;
 *     const prims = decomposeElliottDoubleCombo(s, v);
 *     void prims;
 */
export function decomposeElliottDoubleCombo(
    state: ElliottDoubleComboState,
    view: Viewport,
): ReadonlyArray<DrawPrimitive> {
    const points = state.anchors.map((p) => worldPointToPixel(p, view));
    return decomposeElliott(points, state.labels, DOUBLE_COMBO_LABELS, state.style);
}

/**
 * Decompose an `elliott-triple-combo` drawing — a 6-leg labelled open
 * polyline through the 7 anchors. `state.labels` overrides the default
 * `["S","W","X1","Y","X2","Zi","Z"]` when present and length-matching.
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const s: ElliottTripleComboState;
 *     declare const v: Viewport;
 *     const prims = decomposeElliottTripleCombo(s, v);
 *     void prims;
 */
export function decomposeElliottTripleCombo(
    state: ElliottTripleComboState,
    view: Viewport,
): ReadonlyArray<DrawPrimitive> {
    const points = state.anchors.map((p) => worldPointToPixel(p, view));
    return decomposeElliott(points, state.labels, TRIPLE_COMBO_LABELS, state.style);
}
