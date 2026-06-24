// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { DrawingEmission, PlotEmission } from "@invinite-org/chartlang-adapter-kit";
import { RENDER_BAND } from "@invinite-org/chartlang-adapter-kit";
import type { HLine, PlotPoint } from "./coords.js";

// The z-order comparator + band map now live in adapter-kit
// (`geometry/renderOrder.ts`), shared by every adapter — mirroring the
// `shift.ts` promotion. We re-export the comparator and alias the band
// const so the local `BAND.*` call sites are untouched, while keeping the
// canvas2d-specific `SortableMark` payload union local.
export { sortByRenderOrder } from "@invinite-org/chartlang-adapter-kit";

/**
 * The default group bands the reference adapter paints in, bottom→top,
 * **within a single pane**. Aliases the shared `RENDER_BAND` so existing
 * `BAND.series` call sites are unchanged. The render pass sorts every
 * sortable mark by `(z, band, seq)`, so at the default `z = 0` the key
 * reduces to `(band, declarationOrder)` — reproducing the pre-`z` phase
 * order (series → glyphs → hlines → drawings) exactly.
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
export const BAND = RENDER_BAND;

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
