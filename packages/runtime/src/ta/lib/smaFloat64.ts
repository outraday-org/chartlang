// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/lib/sma-of-float64.ts
//   (commit d2d1043c1b039f66d2f3674526d303d31cf2f1e0, © Invinite).
// Re-licensed MIT for chartlang. The math is the reference, the code
// style is not.

/**
 * Simple Moving Average over a `Float64Array` input. Walks past any
 * leading-NaN prefix, then runs an O(N) rolling-sum SMA over the
 * next `length` finite values. A mid-stream NaN holds the previous
 * output forward (no re-seeding). The full-recompute form lives here
 * so the runtime's `ta.sma` primitive (incremental) and the property
 * / golden tests (reference-equivalent) share a single math source.
 *
 * Warmup `[0, length − 2]` is `NaN`; `out[length − 1]` is the first
 * defined value.
 *
 * @formula  out[i] = mean(input[i − length + 1 ..= i])
 * @since 0.1
 * @stable
 * @example
 *     // import { computeSmaOfFloat64 } from "./smaFloat64";
 *     // const out = computeSmaOfFloat64(new Float64Array([1, 2, 3, 4]), 2);
 */
export function computeSmaOfFloat64(input: Float64Array, length: number): Float64Array {
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

    let runningSum = 0;
    for (let i = firstValidIdx; i < firstValidIdx + length; i += 1) {
        runningSum += input[i];
    }
    const seedIdx = firstValidIdx + length - 1;
    out[seedIdx] = runningSum / length;

    for (let i = seedIdx + 1; i < n; i += 1) {
        const incoming = input[i];
        const outgoing = input[i - length];
        if (!Number.isFinite(incoming) || !Number.isFinite(outgoing)) {
            out[i] = out[i - 1];
            continue;
        }
        runningSum += incoming - outgoing;
        out[i] = runningSum / length;
    }
    return out;
}
