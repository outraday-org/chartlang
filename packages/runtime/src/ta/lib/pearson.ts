// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/lib/pearson.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.

/**
 * Rolling Pearson correlation coefficient between two equal-length
 * series over each trailing `length`-bar window. Output values lie
 * in `[-1, +1]` (clamped to guard against floating-point overshoot);
 * `+1` is perfect positive correlation, `-1` perfect anti-correlation,
 * `0` no linear relationship.
 *
 * Warmup `[0, length - 2]` is `NaN`. Any non-finite slot inside the
 * window, or a window whose variance on either side is zero (a flat
 * window — correlation undefined), yields `NaN`. Mismatched input
 * lengths or `length < 2` returns an all-NaN buffer.
 *
 * Invinite's `pearson.ts` correlates a series against the bar index
 * (Trend Strength Index formula). This generalisation takes two
 * arbitrary series so the same helper backs `ta.trendStrengthIndex`
 * (pass `b = [0, 1, ..., n-1]`) and Phase-5's `correlationCoeff`
 * (pass a secondary symbol's close).
 *
 * @formula  meanA = Σa/N ; meanB = Σb/N ;
 *           num   = Σ((a - meanA) * (b - meanB)) ;
 *           den   = sqrt(Σ(a - meanA)² * Σ(b - meanB)²) ;
 *           r     = clamp(num / den, -1, 1)
 * @warmup   length - 1
 * @since 0.2
 * @stable
 * @example
 *     // import { pearson } from "./pearson";
 *     // const r = pearson(seriesA, seriesB, 20);
 */
export function pearson(a: Float64Array, b: Float64Array, length: number): Float64Array {
    const n = a.length;
    const out = new Float64Array(n);
    out.fill(Number.NaN);
    if (length < 2 || n === 0 || b.length !== n || n < length) return out;

    for (let i = length - 1; i < n; i += 1) {
        const startIdx = i - length + 1;
        let sumA = 0;
        let sumB = 0;
        let windowFinite = true;
        for (let j = 0; j < length; j += 1) {
            const av = a[startIdx + j];
            const bv = b[startIdx + j];
            if (!Number.isFinite(av) || !Number.isFinite(bv)) {
                windowFinite = false;
                break;
            }
            sumA += av;
            sumB += bv;
        }
        if (!windowFinite) continue;

        const meanA = sumA / length;
        const meanB = sumB / length;
        let sumAB = 0;
        let sumAA = 0;
        let sumBB = 0;
        for (let j = 0; j < length; j += 1) {
            const dA = a[startIdx + j] - meanA;
            const dB = b[startIdx + j] - meanB;
            sumAB += dA * dB;
            sumAA += dA * dA;
            sumBB += dB * dB;
        }
        if (sumAA === 0 || sumBB === 0) continue;

        const r = sumAB / Math.sqrt(sumAA * sumBB);
        out[i] = r < -1 ? -1 : r > 1 ? 1 : r;
    }
    return out;
}
