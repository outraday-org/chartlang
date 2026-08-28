// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/lib/ema-of-float64.ts
//   (commit d2d1043c1b039f66d2f3674526d303d31cf2f1e0, © Invinite).
// Re-licensed MIT for chartlang. The math is the reference, the code
// style is not.

/**
 * EMA over a `Float64Array` input. The first finite source value seeds the
 * recurrence, then each later finite value applies
 * `out[i] = src[i] * k + previous * (1 − k)` with
 * `k = 2 / (length + 1)`. A missing source bar emits `NaN` without changing
 * `previous`, so the next finite bar resumes from the last finite EMA. The
 * incremental `ta.ema` primitive and the property tests share this contract.
 *
 * Leading `NaN` values remain `NaN`; the first finite input is also the first
 * finite output. A non-positive or non-integer length yields all `NaN`.
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
    if (!Number.isInteger(length) || length <= 0 || n === 0) return out;
    const k = 2 / (length + 1);
    let previous = Number.NaN;
    for (let i = 0; i < n; i += 1) {
        const v = input[i];
        if (!Number.isFinite(v)) {
            continue;
        }
        previous = Number.isFinite(previous) ? v * k + previous * (1 - k) : v;
        out[i] = previous;
    }
    return out;
}
