// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/lib/compute-ma-of-float64.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.

import { computeEmaOfFloat64 } from "./emaFloat64";
import type { MaTypeNoVolume } from "./maTypes";
import { computeSmaOfFloat64 } from "./smaFloat64";
import { smmaFloat64 } from "./smmaFloat64";
import { wmaFloat64 } from "./wmaFloat64";

/**
 * Chained-MA dispatcher over a `Float64Array` input. Routes by
 * `MaTypeNoVolume` to the matching per-kind core — never re-implements
 * the math. Consumed by chained MAs (MACD signal-of-MACD, PPO /
 * PVO signal-of-oscillator, RSI smoothing-MA over RSI) and by every
 * primitive that exposes an `maType` opt over a derived Float64 source
 * (BB middle override, Keltner middle, Envelope middle, Chop
 * denominator, Donchian midpoint).
 *
 * `"vwma"` is excluded at the type level: VWMA needs a parallel
 * volume array and derived Float64 chain inputs carry no matching
 * volume stream. Volume-aware callers route through {@link computeMa}.
 *
 * @formula  kind switch over MaTypeNoVolume → delegates to
 *           {sma,ema,wma,smma}Float64(source, length)
 * @since 0.2
 * @stable
 * @example
 *     // import { computeMaOfFloat64 } from "./computeMaOfFloat64";
 *     // const sig = computeMaOfFloat64("ema", macdLine, 9);
 */
export function computeMaOfFloat64(
    kind: MaTypeNoVolume,
    source: Float64Array,
    length: number,
): Float64Array {
    switch (kind) {
        case "sma":
            return computeSmaOfFloat64(source, length);
        case "ema":
            return computeEmaOfFloat64(source, length);
        case "wma":
            return wmaFloat64(source, length);
        case "smma":
            return smmaFloat64(source, length);
    }
}
