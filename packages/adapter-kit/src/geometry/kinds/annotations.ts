// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Annotation geometry moved from the canvas2d adapter's per-kind
// renderers
//   examples/canvas2d-adapter/src/render/draw/{text,arrow,arrowMarker,
//   arrowMarkUp,arrowMarkDown}.ts.
// The originating math is invinite's text / arrow / arrow-marker /
// arrow-mark-up / arrow-mark-down tools (commit
// 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite); re-licensed
// MIT for chartlang.

import type {
    ArrowMarkDownState,
    ArrowMarkUpState,
    ArrowMarkerState,
    ArrowState,
    TextState,
} from "@invinite-org/chartlang-core";

import { arrowheadPolygon } from "../_lib/arrowhead.js";
import { chevronPolygon } from "../_lib/chevron.js";
import { dashPattern } from "../_lib/dash.js";
import { resolveTextOpts } from "../_lib/textStyle.js";
import { worldPointToPixel } from "../project.js";
import type { DrawPrimitive, Viewport } from "../types.js";

const DEFAULT_LINE_COLOR = "#000000";
const DEFAULT_LINE_WIDTH = 1;
const DEFAULT_ARROW_MARKER_COLOR = "#3b82f6"; // invinite toolbar blue
const DEFAULT_MARK_UP_COLOR = "#22c55e";
const DEFAULT_MARK_DOWN_COLOR = "#ef4444";
const SOLID_FILL_ALPHA = 1;
const ARROW_LABEL_FONT = "12px sans-serif";
const ARROW_LABEL_VERTICAL_OFFSET = 4;
const MARKER_DOT_RADIUS = 3;
const MARKER_STUB_DX = 16;
const MARKER_STUB_DY = -8;
const MARKER_TEXT_OFFSET_X = 6;
const MARKER_TEXT_FONT = "12px sans-serif";
const TWO_PI = Math.PI * 2;

/**
 * Decompose a `text` drawing — a single label at the projected anchor,
 * its font / alignment / colour resolved from `TextOpts`. `bgColor` is
 * carried through onto the IR `text` primitive (adapters that can paint
 * a background rect may use it; the canvas sink ignores it).
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const s: TextState;
 *     declare const v: Viewport;
 *     const prims = decomposeText(s, v);
 *     // prims[0].kind === "text"
 *     void prims;
 */
export function decomposeText(state: TextState, view: Viewport): ReadonlyArray<DrawPrimitive> {
    const anchor = worldPointToPixel(state.anchor, view);
    const resolved = resolveTextOpts(state.style);
    return [
        {
            kind: "text",
            x: anchor.x,
            y: anchor.y,
            text: state.body,
            color: resolved.color,
            font: resolved.font,
            align: resolved.align,
            baseline: resolved.baseline,
            ...(state.style.bgColor === undefined ? {} : { bgColor: state.style.bgColor }),
        },
    ];
}

/**
 * Decompose an `arrow` drawing — a stroked shaft, a filled arrowhead
 * triangle at the head anchor, and an optional label at the shaft
 * midpoint. Stroke and arrowhead fill share `style.color`.
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const s: ArrowState;
 *     declare const v: Viewport;
 *     const prims = decomposeArrow(s, v);
 *     // prims[0].kind === "polyline"; prims[1].kind === "polyline"
 *     void prims;
 */
export function decomposeArrow(state: ArrowState, view: Viewport): ReadonlyArray<DrawPrimitive> {
    const from = worldPointToPixel(state.anchors[0], view);
    const to = worldPointToPixel(state.anchors[1], view);
    const color = state.style.color ?? DEFAULT_LINE_COLOR;
    const out: DrawPrimitive[] = [
        {
            kind: "polyline",
            points: [from, to],
            closed: false,
            stroke: {
                color,
                width: state.style.lineWidth ?? DEFAULT_LINE_WIDTH,
                dash: dashPattern(state.style.lineStyle ?? "solid"),
            },
        },
        {
            kind: "polyline",
            points: arrowheadPolygon(from, to),
            closed: true,
            fill: { color, alpha: SOLID_FILL_ALPHA },
        },
    ];
    if (state.style.label !== undefined) {
        out.push({
            kind: "text",
            x: (from.x + to.x) / 2,
            y: (from.y + to.y) / 2 - ARROW_LABEL_VERTICAL_OFFSET,
            text: state.style.label,
            color,
            font: ARROW_LABEL_FONT,
            align: "center",
            baseline: "bottom",
        });
    }
    return out;
}

/**
 * Decompose an `arrow-marker` drawing — a self-contained compact glyph
 * at the anchor: a filled dot, a short stub up + right, a filled
 * arrowhead at the stub end, and optional text to the right. Default
 * colour is `"#3b82f6"` (invinite toolbar blue).
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const s: ArrowMarkerState;
 *     declare const v: Viewport;
 *     const prims = decomposeArrowMarker(s, v);
 *     void prims;
 */
export function decomposeArrowMarker(
    state: ArrowMarkerState,
    view: Viewport,
): ReadonlyArray<DrawPrimitive> {
    const anchor = worldPointToPixel(state.anchor, view);
    const color = state.style.color ?? DEFAULT_ARROW_MARKER_COLOR;
    const stubEnd = { x: anchor.x + MARKER_STUB_DX, y: anchor.y + MARKER_STUB_DY };
    const out: DrawPrimitive[] = [
        {
            kind: "arc",
            cx: anchor.x,
            cy: anchor.y,
            r: MARKER_DOT_RADIUS,
            start: 0,
            end: TWO_PI,
            closed: false,
            fill: { color, alpha: SOLID_FILL_ALPHA },
        },
        {
            kind: "polyline",
            points: [anchor, stubEnd],
            closed: false,
            stroke: { color, width: DEFAULT_LINE_WIDTH, dash: dashPattern("solid") },
        },
        {
            kind: "polyline",
            points: arrowheadPolygon(anchor, stubEnd),
            closed: true,
            fill: { color, alpha: SOLID_FILL_ALPHA },
        },
    ];
    if (state.style.text !== undefined) {
        out.push({
            kind: "text",
            x: anchor.x + MARKER_TEXT_OFFSET_X,
            y: anchor.y,
            text: state.style.text,
            color,
            font: MARKER_TEXT_FONT,
            align: "left",
            baseline: "middle",
        });
    }
    return out;
}

/**
 * Decompose an `arrow-mark-up` drawing — a filled up-chevron glyph at
 * the anchor. Default fill colour is `"#22c55e"` (green); an explicit
 * `style.color` overrides.
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const s: ArrowMarkUpState;
 *     declare const v: Viewport;
 *     const prims = decomposeArrowMarkUp(s, v);
 *     void prims;
 */
export function decomposeArrowMarkUp(
    state: ArrowMarkUpState,
    view: Viewport,
): ReadonlyArray<DrawPrimitive> {
    const anchor = worldPointToPixel(state.anchor, view);
    const color = state.style.color ?? DEFAULT_MARK_UP_COLOR;
    return [
        {
            kind: "polyline",
            points: chevronPolygon(anchor, "up"),
            closed: true,
            fill: { color, alpha: SOLID_FILL_ALPHA },
        },
    ];
}

/**
 * Decompose an `arrow-mark-down` drawing — a filled down-chevron glyph
 * at the anchor. Default fill colour is `"#ef4444"` (red); an explicit
 * `style.color` overrides.
 *
 * @since 1.3
 * @stable
 * @example
 *     declare const s: ArrowMarkDownState;
 *     declare const v: Viewport;
 *     const prims = decomposeArrowMarkDown(s, v);
 *     void prims;
 */
export function decomposeArrowMarkDown(
    state: ArrowMarkDownState,
    view: Viewport,
): ReadonlyArray<DrawPrimitive> {
    const anchor = worldPointToPixel(state.anchor, view);
    const color = state.style.color ?? DEFAULT_MARK_DOWN_COLOR;
    return [
        {
            kind: "polyline",
            points: chevronPolygon(anchor, "down"),
            closed: true,
            fill: { color, alpha: SOLID_FILL_ALPHA },
        },
    ];
}
