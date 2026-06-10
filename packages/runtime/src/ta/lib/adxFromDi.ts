// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/lib/adx-from-di.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.

import { wilderStep } from "./wilderSmoothing.js";

/**
 * Wilder ADX from a pre-computed `+DI` / `-DI` pair. Computes
 * `DX = 100 * |+DI - -DI| / (+DI + -DI)` per bar (falls back to `0`
 * when both DIs are zero), then Wilder-smooths `DX` over `length`
 * via the shared `wilderStep`.
 *
 * Warmup: `2 * length - 1`. Slots `[0, length - 1]` carry the DI
 * warmup (callers feed NaN there); slots `[length, 2*length - 2]`
 * accumulate the ADX seed sum; `out[2*length - 1]` is the first
 * defined ADX value (mean of the first `length` DX samples).
 *
 * Mismatched input lengths or `length <= 0` yields an all-NaN
 * buffer. Any non-finite DI in the seed window leaves the output
 * NaN past the warmup — the Wilder recurrence cannot resume past
 * a NaN seed.
 *
 * @formula  dx[i]  = 100 * |+DI - -DI| / (+DI + -DI) ;
 *           seed   = mean(dx[length .. 2*length - 1]) ;
 *           out[i] = wilderStep(out[i-1], dx[i], length) ;
 *           outputs are clamped to [0, 100]
 * @warmup   2 * length - 1
 * @since 0.2
 * @stable
 * @example
 *     // import { adxFromDi } from "./adxFromDi";
 *     // const adx = adxFromDi(plusDi, minusDi, 14);
 */
export function adxFromDi(
    plusDi: Float64Array,
    minusDi: Float64Array,
    length: number,
): Float64Array {
    const n = plusDi.length;
    const out = new Float64Array(n);
    out.fill(Number.NaN);
    if (length <= 0 || n === 0 || minusDi.length !== n || n < 2 * length) {
        return out;
    }

    const dx = new Float64Array(n);
    dx.fill(Number.NaN);
    for (let i = 0; i < n; i += 1) {
        const p = plusDi[i];
        const m = minusDi[i];
        if (!Number.isFinite(p) || !Number.isFinite(m)) continue;
        const sum = p + m;
        dx[i] = sum === 0 ? 0 : (100 * Math.abs(p - m)) / sum;
    }

    const firstSeedIdx = 2 * length - 1;
    let seedSum = 0;
    for (let i = length; i <= firstSeedIdx; i += 1) {
        const v = dx[i];
        if (!Number.isFinite(v)) return out;
        seedSum += v;
    }
    // dx is bounded by [0, 100] in exact arithmetic, but the seed mean
    // and the Wilder recurrence can overshoot 100 by a few ulps — clamp.
    out[firstSeedIdx] = Math.min(100, seedSum / length);

    for (let i = firstSeedIdx + 1; i < n; i += 1) {
        const v = dx[i];
        if (!Number.isFinite(v)) return out;
        out[i] = Math.min(100, wilderStep(out[i - 1], v, length));
    }

    return out;
}
