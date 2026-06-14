// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/lib/wma-of-float64.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. The math is the reference, the code
// style is not.

/**
 * Weighted Moving Average over a `Float64Array` input. Walks past any
 * leading-NaN prefix, then runs a linearly-weighted mean over each
 * trailing `length`-bar window with weights `(1, 2, …, N)` and
 * denominator `N(N + 1) / 2`. A NaN anywhere inside a window
 * short-circuits that bar's output to NaN — full-recompute weighted
 * windows cannot meaningfully forward-fill a gap.
 *
 * Warmup `[0, length − 2]` is `NaN`; `out[length − 1]` is the first
 * defined value.
 *
 * @formula  denom = N(N + 1) / 2 ;
 *           out[i] = (Σ_{j=0..N-1} input[i − j] * (N − j)) / denom
 * @warmup   length − 1
 * @since 0.2
 * @stable
 * @example
 *     // import { wmaFloat64 } from "./wmaFloat64";
 *     // const out = wmaFloat64(new Float64Array([1, 2, 3, 4]), 3);
 */
export function wmaFloat64(source: Float64Array, length: number): Float64Array {
    const n = source.length;
    const out = new Float64Array(n);
    out.fill(Number.NaN);
    if (length <= 0 || n === 0) return out;

    const denom = (length * (length + 1)) / 2;

    let firstValidIdx = -1;
    for (let i = 0; i < n; i += 1) {
        if (Number.isFinite(source[i])) {
            firstValidIdx = i;
            break;
        }
    }
    if (firstValidIdx < 0 || n - firstValidIdx < length) return out;

    for (let i = firstValidIdx + length - 1; i < n; i += 1) {
        let sum = 0;
        let allFinite = true;
        for (let j = 0; j < length; j += 1) {
            const v = source[i - j];
            if (!Number.isFinite(v)) {
                allFinite = false;
                break;
            }
            sum += v * (length - j);
        }
        if (!allFinite) continue;
        out[i] = sum / denom;
    }
    return out;
}
