// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * Resolve the per-bar paint color for a line-family plot point under the
 * normative `PlotEmission.colorValue` 3-state precedence contract (see
 * `@invinite-org/chartlang-adapter-kit` `PlotEmission.colorValue`):
 *
 * - **`colorValue` omitted (`undefined`)** ⇒ use the static color — the
 *   point's `staticColor` (the top-level `PlotEmission.color`) falling back
 *   to `plotDefault` when that is `null`. Byte-identical to the pre-feature
 *   render.
 * - **`colorValue` present (a string)** ⇒ it OVERRIDES the static color for
 *   this bar's segment.
 * - **`colorValue === null`** ⇒ an explicit "no color this bar" gap; the
 *   caller paints nothing for that bar (distinct from omitted, which falls
 *   back to the static color).
 *
 * Returns the resolved color string to paint, or `null` for the
 * paint-nothing gap. This is the single reference implementation every
 * line-family renderer (line / step-line / area / histogram) shares — the
 * same precedence `render/bgColor.ts` applies for `bg-color` / `bar-color`.
 *
 * @since 1.7
 * @stable
 * @example
 *     resolvePaintColor(undefined, "#26a69a", "#888"); // ⇒ "#26a69a"
 *     resolvePaintColor(undefined, null, "#888"); // ⇒ "#888"
 *     resolvePaintColor("#ef5350", "#26a69a", "#888"); // ⇒ "#ef5350"
 *     resolvePaintColor(null, "#26a69a", "#888"); // ⇒ null (gap)
 */
export function resolvePaintColor(
    colorValue: string | null | undefined,
    staticColor: string | null,
    plotDefault: string,
): string | null {
    if (colorValue === undefined) return staticColor ?? plotDefault;
    return colorValue;
}
