// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * Vertical anchoring mode shared by Phase 5 glyph plots (`shape`,
 * `character`). `above` / `below` offset the glyph relative to the plot
 * value; `absolute` pins it at the value.
 *
 * @since 0.5
 * @stable
 * @example
 *     const location: PlotLocation = "below";
 *     void location;
 */
export type PlotLocation = "above" | "below" | "absolute";
