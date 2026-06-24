// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";

/**
 * The bull / bear / (optional) doji palette of a Pine `plotcandle`
 * `candle-override`. `doji` (open === close) falls back to `bull` when
 * absent — the same default the canvas2d reference adapter applies.
 *
 * @since 1.7
 * @stable
 * @example
 *     const style: CandleOverridePalette = { bull: "#0f0", bear: "#f00" };
 *     void style;
 */
export type CandleOverridePalette = {
    readonly bull: string;
    readonly bear: string;
    readonly doji?: string;
};

/**
 * Resolve a `candle-override` body colour by the bar's own direction:
 * `close > open` ⇒ `bull`, `close < open` ⇒ `bear`, `close === open` (a
 * doji) ⇒ `doji ?? bull`. Mirrors the canvas2d reference adapter's
 * `drawCandleOverride` direction logic so the two adapters tint identically;
 * the uPlot adapter threads the result into the candle paint as a per-bar
 * `ProjectedCandle.color` (body + wick), exactly like a `barcolor` tint.
 *
 * @since 1.7
 * @stable
 * @example
 *     declare const bar: import("@invinite-org/chartlang-core").Bar;
 *     const color = resolveCandleOverrideColor(bar, { bull: "#0f0", bear: "#f00" });
 *     void color;
 */
export function resolveCandleOverrideColor(bar: Bar, palette: CandleOverridePalette): string {
    if (bar.close > bar.open) return palette.bull;
    if (bar.close < bar.open) return palette.bear;
    return palette.doji ?? palette.bull;
}
