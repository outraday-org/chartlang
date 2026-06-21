// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { LineStyle } from "@invinite-org/chartlang-core";

/**
 * Canonical `setLineDash` segment array for each {@link LineStyle}.
 * Copied (not moved) from the canvas2d adapter's `render/lineDash.ts`,
 * which still serves the surviving plot renderers there. Decomposers
 * map a `LineStyle` to a `StrokeStyle.dash` through this helper.
 *
 * `"solid"` → `[]`, `"dashed"` → `[6, 4]`, `"dotted"` → `[2, 4]`.
 *
 * @since 1.3
 * @stable
 * @example
 *     const d = dashPattern("dashed"); // [6, 4]
 *     void d;
 */
export function dashPattern(style: LineStyle): ReadonlyArray<number> {
    switch (style) {
        case "solid":
            return [];
        case "dashed":
            return [6, 4];
        case "dotted":
            return [2, 4];
    }
}

/**
 * The `setLineDash` segment array for a solid stroke — an empty array.
 * Shared by the decomposers that emit always-solid primitives (fib
 * arcs, gann/pitchfork rays, container borders) so the `"solid"` dash
 * constant lives in one place instead of a per-file re-declaration.
 *
 * @since 1.3
 * @stable
 * @example
 *     const d = SOLID_DASH; // []
 *     void d;
 */
export const SOLID_DASH: ReadonlyArray<number> = [];
