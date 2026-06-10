// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/lib/tr-series.ts
//   (commit d2d1043c1b039f66d2f3674526d303d31cf2f1e0, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.

import type { Bar } from "@invinite-org/chartlang-core";

/**
 * True Range at bar `i` of a Bar array. For bar 0 (no prev close)
 * reduces to `high - low`. Phase 1's incremental `ta.atr` does the
 * same math one bar at a time inside its slot state; this helper
 * exists so the property test can reference-equivalent the
 * incremental output against a full recompute.
 *
 * @formula  TR_i = max(high − low, |high − prev_close|, |low − prev_close|)
 * @since 0.1
 * @stable
 * @example
 *     // import { trueRangeAt } from "./trSeries";
 *     // const tr = trueRangeAt(bars, 5);
 */
export function trueRangeAt(bars: ReadonlyArray<Bar>, i: number): number {
    const c = bars[i];
    if (i === 0) return c.high - c.low;
    const prevClose = bars[i - 1].close;
    const a = c.high - c.low;
    const b = Math.abs(c.high - prevClose);
    const d = Math.abs(c.low - prevClose);
    return Math.max(a, b, d);
}

/**
 * Per-bar True Range series of length `bars.length`. Used by `ta.atr`
 * property tests and any future TR-derived primitive.
 *
 * @formula  tr[i] = trueRangeAt(bars, i) for i ∈ [0, n)
 * @since 0.1
 * @stable
 * @example
 *     // import { computeTrSeries } from "./trSeries";
 *     // const tr = computeTrSeries(bars);
 */
export function computeTrSeries(bars: ReadonlyArray<Bar>): Float64Array {
    const n = bars.length;
    const tr = new Float64Array(n);
    for (let i = 0; i < n; i += 1) tr[i] = trueRangeAt(bars, i);
    return tr;
}

/**
 * Wilder ATR over a `Bar` array, returned alongside the TR sidecar.
 * Warmup `[0, length − 2]` is `NaN`; `atr[length − 1]` is the simple
 * mean of the first `length` TR values; subsequent slots use the
 * Wilder recurrence `atr[i] = (atr[i − 1] * (length − 1) + tr[i]) /
 * length`. Acts as the property-test reference for the incremental
 * `ta.atr` primitive.
 *
 * @formula  see wilderSmoothing.ts and computeTrSeries above.
 * @since 0.1
 * @stable
 * @example
 *     // import { computeAtrSeries } from "./trSeries";
 *     // const { atr, tr } = computeAtrSeries(bars, 14);
 */
export function computeAtrSeries(
    bars: ReadonlyArray<Bar>,
    length: number,
): { atr: Float64Array; tr: Float64Array } {
    const n = bars.length;
    const atr = new Float64Array(n);
    atr.fill(Number.NaN);
    const tr = computeTrSeries(bars);
    if (n === 0 || length <= 0 || n < length) return { atr, tr };
    let seedSum = 0;
    for (let i = 0; i < length; i += 1) seedSum += tr[i];
    atr[length - 1] = seedSum / length;
    for (let i = length; i < n; i += 1) {
        atr[i] = (atr[i - 1] * (length - 1) + tr[i]) / length;
    }
    return { atr, tr };
}
