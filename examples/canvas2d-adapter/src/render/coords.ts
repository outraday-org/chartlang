// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Viewport } from "@invinite-org/chartlang-adapter-kit";
import type { LineStyle } from "@invinite-org/chartlang-core";

// The projection primitives (`Viewport`, `timeToX`, `priceToY`) AND the
// bar-shift helpers (`projectShiftedX` / `shiftedBarTime` /
// `medianBarSpacing`) now live in the shared adapter-kit geometry layer
// (`geometry/shift.ts`) so every adapter projects a shifted point
// identically; re-export them here so existing `./render` importers keep
// their import sites while no adapter owns a parallel copy. Only `yToPrice`
// and the adapter-layer render types (`PlotPoint` / `HLine`) stay
// canvas2d-local — they were not ported.
export {
    medianBarSpacing,
    priceToY,
    projectShiftedX,
    shiftedBarTime,
    timeToX,
} from "@invinite-org/chartlang-adapter-kit";
export type { Viewport } from "@invinite-org/chartlang-adapter-kit";

/**
 * One accumulated point in a plot series, keyed by callsite slot id at
 * the adapter layer (`AdapterState.plotSeries`). `value` is `null` when
 * the script emitted a "skip this bar" gap. `bar` is the source bar
 * index the point was computed at; `xShift` is the presentation-only
 * horizontal display shift in bars (omitted ⇒ no shift). Render paths
 * resolve the drawn x from `bar` + `xShift` via {@link projectShiftedX},
 * so an omitted `xShift` reproduces the pre-shift `timeToX(time)` x.
 *
 * `z` is the presentation-only layer key (default `0`); `seq` is the
 * global declaration-order tiebreak both assigned at ingest. The render
 * pass sorts every sortable mark by `(z, band, seq)`, so a `PlotPoint`
 * carries them on each accumulated point.
 *
 * `upper` / `lower` are the per-bar band edges of a `filled-band` series
 * (each `null` for a per-bar gap). They are omitted for every other plot
 * style — line / step-line / histogram / area read `value` only and
 * ignore them, so a non-band point is byte-identical to the pre-feature
 * shape.
 *
 * `colorValue` is the per-bar dynamic-color channel
 * (`PlotEmission.colorValue`) for line-family plots: **omitted** ⇒ paint
 * the static `color`; **present** ⇒ it OVERRIDES `color` for this bar's
 * segment; **`null`** ⇒ an explicit "no color this bar" gap (paint
 * nothing). It is omitted on the stored point when the emission carries
 * no `colorValue`, so a no-`colorValue` frame is byte-identical to the
 * pre-feature shape. The `resolvePaintColor` helper applies the
 * precedence at render time.
 *
 * @since 0.1
 * @stable
 * @example
 *     const p: PlotPoint = {
 *         time: 1_700_000_000_000, value: 42.31, color: "#26a69a", bar: 100,
 *         z: 0, seq: 0,
 *     };
 *     void p;
 */
export type PlotPoint = {
    readonly time: number;
    readonly value: number | null;
    readonly color: string | null;
    readonly bar: number;
    readonly xShift?: number;
    readonly z: number;
    readonly seq: number;
    readonly upper?: number | null;
    readonly lower?: number | null;
    readonly colorValue?: string | null;
};

/**
 * One horizontal-line definition keyed by callsite slot id. Stays at
 * the most recent value emitted for the slot — `hline` is a last-write
 * primitive at the adapter layer. `z` (default `0`) and `seq` (global
 * declaration order) are the render-pass sort keys, assigned at ingest.
 *
 * @since 0.1
 * @stable
 * @example
 *     const h: HLine = {
 *         price: 70,
 *         color: "#ef4444",
 *         lineWidth: 1,
 *         lineStyle: "dashed",
 *         z: 0,
 *         seq: 0,
 *     };
 *     void h;
 */
export type HLine = {
    readonly price: number;
    readonly color: string | null;
    readonly lineWidth: number;
    readonly lineStyle: LineStyle;
    readonly z: number;
    readonly seq: number;
};

/**
 * Inverse of {@link priceToY}: map a y pixel coordinate back to a
 * world price. Useful for interactive overlays (Phase 4+); included
 * now so the renderer ships with the full coordinate pair.
 *
 * @since 0.1
 * @stable
 * @example
 *     const p = yToPrice(50, { xMin: 0, xMax: 1, yMin: 100, yMax: 110, pxWidth: 1, pxHeight: 100 });
 *     // p === 105
 *     void p;
 */
export function yToPrice(y: number, viewport: Viewport): number {
    const normalised = (viewport.pxHeight - y) / viewport.pxHeight;
    return viewport.yMin + normalised * (viewport.yMax - viewport.yMin);
}
