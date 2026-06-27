// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * Task-12 example fragment — one `default` entry per shape / freehand
 * `draw.*` kind, category `draw-shapes`. Each entry credits exactly one
 * primitive id so the coverage allowlist can shrink by these ids.
 *
 * @since 0.1.0
 */

import type { ExampleMeta } from "../catalogue";

const DRAW_SHAPES_FRAGMENT: ReadonlyArray<ExampleMeta> = [
    {
        id: "pivot-circle",
        label: "Pivot Circle",
        description:
            "A circle centred on a recent pivot, its radius reaching that bar's high — one handle reused each bar.",
        category: "draw-shapes",
        primitives: ["draw.circle"],
    },
    {
        id: "consolidation-ellipse",
        label: "Consolidation Ellipse",
        description:
            "An axis-aligned ellipse bounding the last 20 bars' low-to-high consolidation range.",
        category: "draw-shapes",
        primitives: ["draw.ellipse"],
    },
    {
        id: "swing-arc",
        label: "Swing Arc",
        description:
            "An arc that passes through a high apex between two swing lows (apex at t = 0.5).",
        category: "draw-shapes",
        primitives: ["draw.arc"],
    },
    {
        id: "range-rectangle",
        label: "Range Rectangle",
        description:
            "A range box spanning the last 20 bars' low to the current high, redrawn each bar.",
        category: "draw-shapes",
        primitives: ["draw.rectangle"],
    },
    {
        id: "trend-rotated-box",
        label: "Trend Rotated Box",
        description:
            "A tilted range box — a parallelogram whose long edge follows the 20-bar low-to-high trend.",
        category: "draw-shapes",
        primitives: ["draw.rotatedRectangle"],
    },
    {
        id: "pivot-triangle",
        label: "Pivot Triangle",
        description:
            "A closed triangle over three pivots: two swing lows and a high between them.",
        category: "draw-shapes",
        primitives: ["draw.triangle"],
    },
    {
        id: "region-frame",
        label: "Region Frame",
        description:
            "A labelled rectangular frame highlighting a recent N-bar region with a background fill.",
        category: "draw-shapes",
        primitives: ["draw.frame"],
    },
    {
        id: "swing-curve",
        label: "Swing Curve",
        description:
            "A quadratic Bezier whose middle anchor is the off-curve control point the curve bends toward.",
        category: "draw-shapes",
        primitives: ["draw.curve"],
    },
    {
        id: "double-curve-swing",
        label: "Double Curve Swing",
        description:
            "A cubic-Bezier S-shape through five anchors stepped back over the last 20 bars.",
        category: "draw-shapes",
        primitives: ["draw.doubleCurve"],
    },
    {
        id: "brush-stroke",
        label: "Brush Stroke",
        description:
            "A freehand brush stroke — a closed, filled polyline zig-zagging through a fixed point list.",
        category: "draw-shapes",
        primitives: ["draw.brush"],
    },
    {
        id: "pen-stroke",
        label: "Pen Stroke",
        description:
            "A freehand pen stroke — an open polyline through a fixed point list (no auto-close).",
        category: "draw-shapes",
        primitives: ["draw.pen"],
    },
    {
        id: "price-zone-highlight",
        label: "Price Zone Highlight",
        description:
            "A thick translucent highlighter band over the close level across a recent window.",
        category: "draw-shapes",
        primitives: ["draw.highlighter"],
    },
];

export default DRAW_SHAPES_FRAGMENT;
