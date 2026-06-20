// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Stroke + fill semantics ported from the per-tool style application
// in invinite/src/components/trading-chart/tools/rectangle-tool.ts,
// triangle-tool.ts, rotated-rectangle-tool.ts (commit
// 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite). Re-licensed
// MIT for chartlang.

import type { ShapeStyle } from "@invinite-org/chartlang-core";

import type { FillStyle, StrokeStyle } from "../types.js";
import { dashPattern } from "./dash.js";

const DEFAULT_STROKE = "#000000";
const DEFAULT_LINE_WIDTH = 1;
const DEFAULT_FILL_ALPHA = 1;

/**
 * Resolved {@link ShapeStyle} → IR styles. `stroke` is always present
 * (defaults `"#000000"` / `1` / solid); `fill` is present only when the
 * source `style.fill` is set, with `alpha` defaulting to `1`. The
 * box / shape decomposers map this straight onto a `polyline` / `arc`
 * primitive's `stroke` / `fill`. Pure — no `ctx`.
 *
 * @since 1.3
 * @stable
 * @example
 *     const r = resolveShapeStyle({ stroke: "#3b82f6", fill: "#dbeafe", fillAlpha: 0.4 });
 *     // r.stroke.color === "#3b82f6"; r.fill?.alpha === 0.4
 *     void r;
 */
export function resolveShapeStyle(style: ShapeStyle): {
    readonly stroke: StrokeStyle;
    readonly fill?: FillStyle;
} {
    const stroke: StrokeStyle = {
        color: style.stroke ?? DEFAULT_STROKE,
        width: style.lineWidth ?? DEFAULT_LINE_WIDTH,
        dash: dashPattern(style.lineStyle ?? "solid"),
    };
    if (style.fill === undefined) {
        return { stroke };
    }
    return {
        stroke,
        fill: { color: style.fill, alpha: style.fillAlpha ?? DEFAULT_FILL_ALPHA },
    };
}
