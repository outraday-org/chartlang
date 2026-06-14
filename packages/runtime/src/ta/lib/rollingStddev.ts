// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/lib/rolling-stddev.ts
//   (commit d2d1043c1b039f66d2f3674526d303d31cf2f1e0, © Invinite).
// Re-licensed MIT for chartlang. The math is the reference, the code
// style is not.

/**
 * Rolling standard deviation over each trailing `length`-bar window
 * of a `Float64Array` input. The default `biased = true` matches
 * invinite's BB math (population stddev, denominator `length`). Set
 * `biased = false` for sample stddev (denominator `length − 1`,
 * matches `StdevOpts.biased = false` from core).
 *
 * Warmup `[0, length − 2]` is `NaN`; any NaN inside the window
 * yields `NaN` (no fill-forward — std dev of a partially defined
 * window is undefined). Provides the full-recompute reference the
 * `ta.stdev` primitive's property test asserts against.
 *
 * @formula  μ = mean(input[i − length + 1 ..= i]) ;
 *           σ = sqrt(Σ(x − μ)² / N), N = length (biased) or length − 1 (sample)
 * @since 0.1
 * @stable
 * @example
 *     // import { computeRollingStdDev } from "./rollingStddev";
 *     // const std = computeRollingStdDev(new Float64Array([1, 2, 3, 4]), 3);
 */
export function computeRollingStdDev(
    input: Float64Array,
    length: number,
    biased = true,
): Float64Array {
    const n = input.length;
    const out = new Float64Array(n);
    out.fill(Number.NaN);
    if (length <= 0 || n === 0) return out;
    const denominator = biased ? length : length - 1;
    if (denominator <= 0) return out;

    for (let i = length - 1; i < n; i += 1) {
        let sum = 0;
        let allFinite = true;
        for (let j = i - length + 1; j <= i; j += 1) {
            const v = input[j];
            if (!Number.isFinite(v)) {
                allFinite = false;
                break;
            }
            sum += v;
        }
        if (!allFinite) continue;
        const mean = sum / length;
        let sumSq = 0;
        for (let j = i - length + 1; j <= i; j += 1) {
            const d = input[j] - mean;
            sumSq += d * d;
        }
        out[i] = Math.sqrt(sumSq / denominator);
    }
    return out;
}
