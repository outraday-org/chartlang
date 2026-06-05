// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/lib/vwma-of-float64.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.

/**
 * Volume-Weighted Moving Average over parallel `Float64Array` source +
 * volume streams. Walks past any leading-NaN source prefix, then for
 * each trailing `length`-bar window emits
 * `Σ(source[i − j] * volume[i − j]) / Σ(volume[i − j])`. A NaN volume
 * slot is treated as zero (matches invinite's `candles[i].volume ?? 0`
 * null-coalesce). A NaN source slot anywhere inside the window
 * short-circuits that bar's output to NaN; a window whose total volume
 * is `0` also emits NaN (the ratio is undefined).
 *
 * The source and volume arrays must be the same length; a mismatch
 * yields an all-NaN output. Warmup `[0, length − 2]` is `NaN`;
 * `out[length − 1]` is the first defined value.
 *
 * @formula  out[i] = (Σ_{j=0..N-1} source[i − j] * volume[i − j])
 *                   / (Σ_{j=0..N-1} volume[i − j])
 *                  ;  NaN when the denominator is 0.
 * @warmup   length − 1
 * @since 0.2
 * @stable
 * @example
 *     // import { vwmaFloat64 } from "./vwmaFloat64";
 *     // const src = new Float64Array([10, 11, 12, 13]);
 *     // const vol = new Float64Array([100, 200, 150, 50]);
 *     // const out = vwmaFloat64(src, vol, 3);
 */
export function vwmaFloat64(
    source: Float64Array,
    volume: Float64Array,
    length: number,
): Float64Array {
    const n = source.length;
    const out = new Float64Array(n);
    out.fill(Number.NaN);
    if (length <= 0 || n === 0 || volume.length !== n) return out;

    let firstValidIdx = -1;
    for (let i = 0; i < n; i += 1) {
        if (Number.isFinite(source[i])) {
            firstValidIdx = i;
            break;
        }
    }
    if (firstValidIdx < 0 || n - firstValidIdx < length) return out;

    for (let i = firstValidIdx + length - 1; i < n; i += 1) {
        let pvSum = 0;
        let volSum = 0;
        let allFinite = true;
        for (let j = 0; j < length; j += 1) {
            const value = source[i - j];
            if (!Number.isFinite(value)) {
                allFinite = false;
                break;
            }
            const rawVol = volume[i - j];
            const v = Number.isFinite(rawVol) ? rawVol : 0;
            pvSum += value * v;
            volSum += v;
        }
        if (!allFinite) continue;
        out[i] = volSum > 0 ? pvSum / volSum : Number.NaN;
    }
    return out;
}
