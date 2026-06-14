// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/lib/smma-of-float64.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. The math is the reference, the code
// style is not.

/**
 * Smoothed Moving Average (Wilder's RMA) over a `Float64Array` input.
 * Walks past any leading-NaN prefix, seeds with the simple mean of
 * the next `length` finite values, then runs the recurrence
 * `out[i] = (out[i − 1] * (length − 1) + source[i]) / length` —
 * equivalent to an EMA with `α = 1 / length`. A mid-stream NaN holds
 * the prior value forward (continuous output past gaps), matching
 * the recurrence-MA convention shared with {@link emaFloat64}.
 *
 * Warmup `[0, length − 2]` is `NaN`; `out[length − 1]` is the first
 * defined value.
 *
 * @formula  α = 1 / length ;
 *           out[i] = (out[i − 1] * (length − 1) + source[i]) / length
 * @warmup   length − 1
 * @since 0.2
 * @stable
 * @example
 *     // import { smmaFloat64 } from "./smmaFloat64";
 *     // const out = smmaFloat64(new Float64Array([1, 2, 3, 4]), 3);
 */
export function smmaFloat64(source: Float64Array, length: number): Float64Array {
    const n = source.length;
    const out = new Float64Array(n);
    out.fill(Number.NaN);
    if (length <= 0 || n === 0) return out;

    let firstValidIdx = -1;
    for (let i = 0; i < n; i += 1) {
        if (Number.isFinite(source[i])) {
            firstValidIdx = i;
            break;
        }
    }
    if (firstValidIdx < 0 || n - firstValidIdx < length) return out;

    let seedSum = 0;
    for (let i = firstValidIdx; i < firstValidIdx + length; i += 1) {
        seedSum += source[i];
    }
    const seedIdx = firstValidIdx + length - 1;
    out[seedIdx] = seedSum / length;

    for (let i = seedIdx + 1; i < n; i += 1) {
        const v = source[i];
        if (!Number.isFinite(v)) {
            out[i] = out[i - 1];
            continue;
        }
        out[i] = (out[i - 1] * (length - 1) + v) / length;
    }
    return out;
}
