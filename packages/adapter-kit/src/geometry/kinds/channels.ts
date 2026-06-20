// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Channel geometry moved from the canvas2d adapter's per-kind renderers
//   examples/canvas2d-adapter/src/render/draw/{trendChannel,
//   flatTopBottom,disjointChannel,regressionTrend}.ts.
// The originating math is invinite's trend-channel / flat-top-bottom /
// disjoint-channel / regression-trend tools (commit
// 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite); re-licensed
// MIT for chartlang.

import type {
    DisjointChannelState,
    FlatTopBottomState,
    RegressionTrendState,
    TrendChannelState,
} from "@invinite-org/chartlang-core";

import { dashPattern } from "../_lib/dash.js";
import { worldPointToPixel } from "../project.js";
import type { DrawPrimitive, StrokeStyle, Viewport } from "../types.js";

const DEFAULT_COLOR = "#000000";
const DEFAULT_LINE_WIDTH = 1;

/**
 * Default stroke colour of a `regression-trend` placeholder line —
 * `#3b82f6`, matching the canvas2d source renderer.
 */
const REGRESSION_DEFAULT_COLOR = "#3b82f6";

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
 * Decompose a `trend-channel` drawing — two parallel line segments. The
 * primary rail runs `anchors[0]` → `anchors[1]`; the second rail is its
 * translate by the offset vector `anchors[2] − anchors[0]`, keeping the
 * pair strictly parallel. Stroke-only — `LineDrawStyle` carries no fill,
 * so there is no inter-rail band (matching the canvas2d source).
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const s: TrendChannelState;
 *     declare const v: Viewport;
 *     const prims = decomposeTrendChannel(s, v);
 *     // prims.length === 2
 *     void prims;
 */
export function decomposeTrendChannel(
    state: TrendChannelState,
    view: Viewport,
): ReadonlyArray<DrawPrimitive> {
    const a = worldPointToPixel(state.anchors[0], view);
    const b = worldPointToPixel(state.anchors[1], view);
    const hook = worldPointToPixel(state.anchors[2], view);
    const dx = hook.x - a.x;
    const dy = hook.y - a.y;
    const stroke = strokeOf(state.style);
    return [
        { kind: "polyline", points: [a, b], closed: false, stroke },
        {
            kind: "polyline",
            points: [
                { x: a.x + dx, y: a.y + dy },
                { x: b.x + dx, y: b.y + dy },
            ],
            closed: false,
            stroke,
        },
    ];
}

/**
 * Decompose a `flat-top-bottom` drawing — two horizontal rails. The top
 * rail sits at `max(anchors[0].price, anchors[2].price)` and the bottom
 * at `min(...)`; both span the time range `anchors[0].time` →
 * `anchors[1].time`. Stroke-only.
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const s: FlatTopBottomState;
 *     declare const v: Viewport;
 *     const prims = decomposeFlatTopBottom(s, v);
 *     // prims.length === 2
 *     void prims;
 */
export function decomposeFlatTopBottom(
    state: FlatTopBottomState,
    view: Viewport,
): ReadonlyArray<DrawPrimitive> {
    const p0 = state.anchors[0];
    const p1 = state.anchors[1];
    const p2 = state.anchors[2];
    const topPrice = Math.max(p0.price, p2.price);
    const bottomPrice = Math.min(p0.price, p2.price);
    const topLeft = worldPointToPixel({ time: p0.time, price: topPrice }, view);
    const topRight = worldPointToPixel({ time: p1.time, price: topPrice }, view);
    const bottomLeft = worldPointToPixel({ time: p0.time, price: bottomPrice }, view);
    const bottomRight = worldPointToPixel({ time: p1.time, price: bottomPrice }, view);
    const stroke = strokeOf(state.style);
    return [
        { kind: "polyline", points: [topLeft, topRight], closed: false, stroke },
        { kind: "polyline", points: [bottomLeft, bottomRight], closed: false, stroke },
    ];
}

/**
 * Decompose a `disjoint-channel` drawing — two independent line segments
 * with no shared geometry constraint: `anchors[0]` → `anchors[1]` and
 * `anchors[2]` → `anchors[3]`. Stroke-only.
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const s: DisjointChannelState;
 *     declare const v: Viewport;
 *     const prims = decomposeDisjointChannel(s, v);
 *     // prims.length === 2
 *     void prims;
 */
export function decomposeDisjointChannel(
    state: DisjointChannelState,
    view: Viewport,
): ReadonlyArray<DrawPrimitive> {
    const a = worldPointToPixel(state.anchors[0], view);
    const b = worldPointToPixel(state.anchors[1], view);
    const c = worldPointToPixel(state.anchors[2], view);
    const d = worldPointToPixel(state.anchors[3], view);
    const stroke = strokeOf(state.style);
    return [
        { kind: "polyline", points: [a, b], closed: false, stroke },
        { kind: "polyline", points: [c, d], closed: false, stroke },
    ];
}

/**
 * Decompose a `regression-trend` drawing — a single placeholder line
 * between the two anchors, colour `style.color ?? "#3b82f6"`, width 1,
 * solid. The OLS fit + ±σ bands the `RegressionTrendOpts` flags
 * (`source` / `stdevMultiplier` / `showUpperBand` / `showLowerBand`)
 * describe require a bar buffer the `Viewport` does not expose and band
 * anchors the 2-point `state.anchors` does not carry; the canvas2d
 * source renders the same placeholder line, so this decomposer preserves
 * that geometry. Those style fields are accepted but unused here —
 * consumer adapters with a bar buffer can compute the fit themselves.
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const s: RegressionTrendState;
 *     declare const v: Viewport;
 *     const prims = decomposeRegressionTrend(s, v);
 *     // prims.length === 1; prims[0].kind === "polyline"
 *     void prims;
 */
export function decomposeRegressionTrend(
    state: RegressionTrendState,
    view: Viewport,
): ReadonlyArray<DrawPrimitive> {
    const a = worldPointToPixel(state.anchors[0], view);
    const b = worldPointToPixel(state.anchors[1], view);
    return [
        {
            kind: "polyline",
            points: [a, b],
            closed: false,
            stroke: {
                color: state.style.color ?? REGRESSION_DEFAULT_COLOR,
                width: DEFAULT_LINE_WIDTH,
                dash: dashPattern("solid"),
            },
        },
    ];
}
