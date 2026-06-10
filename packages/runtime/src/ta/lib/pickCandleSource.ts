// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/lib/pick-candle-source.ts
//   (commit d2d1043c1b039f66d2f3674526d303d31cf2f1e0, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.
// Structural choice: the chartlang runtime pre-computes the four
// derived sources on `BarView` per close (`hl2` / `hlc3` / `ohlc4` /
// `hlcc4`), so this helper is a plain field read — invinite computed
// the derived values inline because its `ChartCandle` shape carries
// only the raw OHLC fields.

import type { Bar } from "@invinite-org/chartlang-core";

import type { SourceField } from "./readSourceField.js";

/**
 * Read one of the eight canonical source values off a `Bar`. The
 * four derived fields (`hl2` / `hlc3` / `ohlc4` / `hlcc4`) live on
 * the chartlang `Bar` type as readable scalars — the runtime fills
 * them per close in `onBarClose` / `onBarTick`.
 *
 * @formula  hl2 = (high + low) / 2 ; hlc3 = (high + low + close) / 3 ;
 *           ohlc4 = (open + high + low + close) / 4 ;
 *           hlcc4 = (high + low + close + close) / 4
 * @since 0.1
 * @stable
 * @example
 *     // import { pickCandleSource } from "./pickCandleSource";
 *     // const px = pickCandleSource(bar, "hl2");
 */
export function pickCandleSource(
    bar: Bar | (Bar & { hl2: number; hlc3: number; ohlc4: number; hlcc4: number }),
    source: SourceField,
): number {
    switch (source) {
        case "close":
        case "high":
        case "low":
        case "open":
            return bar[source];
        case "hl2":
            return (bar.high + bar.low) / 2;
        case "hlc3":
            return (bar.high + bar.low + bar.close) / 3;
        case "ohlc4":
            return (bar.open + bar.high + bar.low + bar.close) / 4;
        case "hlcc4":
            return (bar.high + bar.low + bar.close + bar.close) / 4;
    }
}
