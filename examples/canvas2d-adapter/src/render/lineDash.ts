// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { LineStyle } from "@invinite-org/chartlang-core";

/**
 * Canonical `setLineDash` segment array for each {@link LineStyle}.
 * Shared by every renderer that strokes a {@link LineStyle}-controlled
 * path (`area`, `horizontalLine`, future Phase-2 renderers). Callers
 * `ctx.setLineDash(dashPattern(style))` before stroking and
 * `ctx.setLineDash([])` after to restore solid for downstream draws.
 *
 * `"solid"` → `[]`, `"dashed"` → `[6, 4]`, `"dotted"` → `[2, 4]`.
 *
 * @since 0.2
 * @experimental
 * @example
 *     declare const ctx: { setLineDash(s: ReadonlyArray<number>): void };
 *     ctx.setLineDash(dashPattern("dashed"));
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
