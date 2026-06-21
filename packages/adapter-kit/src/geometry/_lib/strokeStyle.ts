// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { StrokeStyle } from "../types.js";
import { dashPattern } from "./dash.js";

/**
 * The line-style inputs every line-family decomposer reads off its
 * drawing state — the structural shape shared by `lines`, `curves`,
 * `channels`, and `cycles`.
 *
 * @since 1.3
 * @stable
 * @example
 *     const style: LineStyleInput = { color: "#000000", lineStyle: "dashed" };
 *     void style;
 */
export type LineStyleInput = {
    readonly color?: string | undefined;
    readonly lineWidth?: number | undefined;
    readonly lineStyle?: "solid" | "dashed" | "dotted" | undefined;
};

/**
 * Resolve a {@link LineStyleInput} into a {@link StrokeStyle}, applying
 * the family defaults: colour falls back to `defaultColor` (black for
 * most kinds; the `cycles` decomposers pass their own accent), width to
 * `1`, and the dash array is derived from `lineStyle` via
 * {@link dashPattern}. Extracted so the four line-family `kinds/` files
 * share one resolver instead of byte-identical copies.
 *
 * @since 1.3
 * @stable
 * @example
 *     const s = strokeOf({ lineStyle: "dashed" });
 *     // { color: "#000000", width: 1, dash: [6, 4] }
 *     void s;
 */
export function strokeOf(style: LineStyleInput, defaultColor = "#000000"): StrokeStyle {
    return {
        color: style.color ?? defaultColor,
        width: style.lineWidth ?? 1,
        dash: dashPattern(style.lineStyle ?? "solid"),
    };
}
