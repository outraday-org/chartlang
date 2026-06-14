// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/lib/ema-of-float64.ts
//   (commit d2d1043c1b039f66d2f3674526d303d31cf2f1e0, © Invinite).
// Re-licensed MIT for chartlang. The math is the reference, the code
// style is not.

/**
 * EMA over a `Float64Array` input. Walks past any leading-NaN prefix,
 * seeds with the simple mean of the next `length` finite values, then
 * runs the recurrence `out[i] = src[i] * k + out[i − 1] * (1 − k)`
 * with `k = 2 / (length + 1)`. A mid-stream NaN holds the previous
 * value forward — keeps the output continuous past gaps. The
 * incremental `ta.ema` primitive and the property tests share this
 * helper as their reference.
 *
 * Warmup `[0, length − 2]` is `NaN`; `out[length − 1]` is the first
 * defined value.
 *
 * @formula  k = 2 / (length + 1) ;
 *           out[i] = input[i] * k + out[i − 1] * (1 − k)
 * @since 0.1
 * @stable
 * @example
 *     // import { computeEmaOfFloat64 } from "./emaFloat64";
 *     // const out = computeEmaOfFloat64(new Float64Array([1, 2, 3, 4]), 2);
 */
export function computeEmaOfFloat64(input: Float64Array, length: number): Float64Array {
    const n = input.length;
    const out = new Float64Array(n);
    out.fill(Number.NaN);
    if (length <= 0 || n === 0) return out;

    let firstValidIdx = -1;
    for (let i = 0; i < n; i += 1) {
        if (Number.isFinite(input[i])) {
            firstValidIdx = i;
            break;
        }
    }
    if (firstValidIdx < 0 || n - firstValidIdx < length) return out;

    let seedSum = 0;
    for (let i = firstValidIdx; i < firstValidIdx + length; i += 1) {
        seedSum += input[i];
    }
    const seedIdx = firstValidIdx + length - 1;
    out[seedIdx] = seedSum / length;

    const k = 2 / (length + 1);
    for (let i = seedIdx + 1; i < n; i += 1) {
        const v = input[i];
        if (!Number.isFinite(v)) {
            out[i] = out[i - 1];
            continue;
        }
        out[i] = v * k + out[i - 1] * (1 - k);
    }
    return out;
}
