// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * Default render-order bands. At the default `z = 0` the composite key
 * reduces to `(band, seq)` = series → glyphs → hlines → drawings, the
 * phase order every adapter shared before `z` existed. A `z < 0` mark
 * sorts beneath `z = 0` marks; a `z > 0` plot sorts above drawings —
 * the lever a fixed band stack cannot express.
 *
 * @since 1.7
 * @stable
 * @example
 *     const seriesBeforeDrawing = RENDER_BAND.series < RENDER_BAND.drawing;
 *     void seriesBeforeDrawing;
 */
export const RENDER_BAND = { series: 0, glyph: 1, hline: 2, drawing: 3 } as const;

/**
 * The structural key a mark must carry to participate in the z-sort:
 * presentation `z` (default 0), its default `band`, and a global
 * monotonic declaration `seq` (ingest order = script order) that makes
 * the comparator total and deterministic.
 *
 * @since 1.7
 * @stable
 * @example
 *     const k: RenderOrderKey = { z: 0, band: RENDER_BAND.series, seq: 0 };
 *     void k;
 */
export type RenderOrderKey = { readonly z: number; readonly band: number; readonly seq: number };

/**
 * Stable total order for the z-ordered paint pass: ascending by `z`,
 * then `band`, then `seq`. Sorts in place and returns the same array
 * for chaining. Generic over the mark payload so every adapter keeps
 * its own mark union and shares ONE comparator (no hand-port).
 *
 * @since 1.7
 * @stable
 * @example
 *     const marks = [{ z: 1, band: 0, seq: 0 }, { z: 0, band: 0, seq: 1 }];
 *     sortByRenderOrder(marks);
 *     // marks[0].z === 0
 *     void marks;
 */
export function sortByRenderOrder<T extends RenderOrderKey>(marks: T[]): T[] {
    marks.sort((a, b) => a.z - b.z || a.band - b.band || a.seq - b.seq);
    return marks;
}
