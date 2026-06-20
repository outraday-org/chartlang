// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission, PlotEmission } from "@invinite-org/chartlang-adapter-kit";
import type { HLine, PlotPoint } from "./coords.js";

/**
 * The default group bands the reference adapter paints in, bottom→top,
 * **within a single pane**. The render pass sorts every sortable mark by
 * `(z, band, seq)`, so at the default `z = 0` the key reduces to
 * `(band, declarationOrder)` — reproducing the pre-`z` phase order
 * (series → glyphs → hlines → drawings) exactly.
 *
 * Bands are an adapter-internal detail: they keep the sane default
 * (drawings above plots) when `z` ties, but never leak onto the wire. A
 * drawing with `z < 0` sorts below `z = 0` plots regardless of band; a
 * plot with `z > 0` sorts above drawings. Substrate (background, candles,
 * axis, candle/bar/bg overrides) paints *before* the sorted pass and
 * alert badges paint *after*, so neither is in this table.
 *
 * @since 1.4
 * @stable
 * @example
 *     const seriesBeforeDrawing = BAND.series < BAND.drawing;
 *     void seriesBeforeDrawing;
 */
export const BAND = { series: 0, glyph: 1, hline: 2, drawing: 3 } as const;

/**
 * One sortable mark collected for a pane's single z-ordered paint pass.
 * The tagged union routes each mark to its existing per-kind renderer
 * (`drawLine` / glyph renderers / `drawHorizontalLine` / `drawingDispatch`)
 * after the stable sort. `z` is the presentation layer key (default `0`),
 * `band` the default phase, `seq` the global declaration-order tiebreak.
 *
 * @since 1.4
 * @stable
 * @example
 *     const mark: SortableMark = {
 *         kind: "hline",
 *         z: 0,
 *         band: BAND.hline,
 *         seq: 3,
 *         hline: {
 *             price: 70, color: null, lineWidth: 1, lineStyle: "solid", z: 0, seq: 3,
 *         },
 *     };
 *     void mark;
 */
export type SortableMark =
    | {
          readonly kind: "series";
          readonly z: number;
          readonly band: number;
          readonly seq: number;
          readonly key: string;
          readonly series: ReadonlyArray<PlotPoint>;
      }
    | {
          readonly kind: "glyph";
          readonly z: number;
          readonly band: number;
          readonly seq: number;
          readonly plot: PlotEmission;
      }
    | {
          readonly kind: "hline";
          readonly z: number;
          readonly band: number;
          readonly seq: number;
          readonly hline: HLine;
      }
    | {
          readonly kind: "drawing";
          readonly z: number;
          readonly band: number;
          readonly seq: number;
          readonly drawing: DrawingEmission;
      };

/**
 * Stable total order for the z-ordered paint pass: ascending by `z`,
 * then `band`, then `seq`. `seq` (a global, monotonically increasing
 * declaration counter) makes the comparator total, so the result is
 * deterministic regardless of the host engine's `Array.prototype.sort`
 * stability and never falls back to Map iteration order once `z` is in
 * play.
 *
 * Sorts in place and returns the same array for chaining.
 *
 * @since 1.4
 * @stable
 * @example
 *     const marks: SortableMark[] = [];
 *     sortByRenderOrder(marks);
 *     void marks;
 */
export function sortByRenderOrder(marks: SortableMark[]): SortableMark[] {
    marks.sort((a, b) => a.z - b.z || a.band - b.band || a.seq - b.seq);
    return marks;
}
