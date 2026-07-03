// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * Strict-monotonic test over the trailing `length` first-differences of a
 * `Float64Array` window. Returns `true` iff each of the last `length`
 * consecutive steps carries the required sign — `dir === 1` demands every
 * step strictly positive (rising), `dir === -1` every step strictly
 * negative (falling). Equality breaks the run (non-strict is neither
 * rising nor falling). Any non-finite value inside the examined
 * `length + 1` slots, a `length < 1`, or a window shorter than
 * `length + 1` short-circuits to `false` — the boolean-series convention
 * `ta.crossover` uses (`NaN` never bubbles through a boolean series).
 *
 * Pure `Float64Array`-in reference: the incremental `ta.rising` /
 * `ta.falling` primitives call it once per bar over a reusable window, and
 * their property tests call it as the brute-force oracle.
 *
 * @formula  out = ⋀_{k=1..length} sign(window[i−k+1] − window[i−k]) === dir
 * @since 1.8
 * @stable
 * @example
 *     // import { monotonic } from "./monotonic";
 *     // monotonic(new Float64Array([1, 2, 3]), 2, 1);  // true (rising)
 *     // monotonic(new Float64Array([3, 2, 1]), 2, -1); // true (falling)
 */
export function monotonic(window: Float64Array, length: number, dir: 1 | -1): boolean {
    if (length < 1 || window.length < length + 1) return false;
    const start = window.length - length - 1;
    for (let i = start; i < window.length - 1; i += 1) {
        const a = window[i];
        const b = window[i + 1];
        if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
        const delta = b - a;
        if (dir === 1 ? delta <= 0 : delta >= 0) return false;
    }
    return true;
}
