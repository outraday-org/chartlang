// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/lib/donchian-mid.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. The math is the reference, the code
// style is not.

/**
 * Donchian midpoint over a trailing `length`-bar window of `high` /
 * `low` Float64Arrays: `(max(high) + min(low)) / 2`. Warmup slots
 * `[0, length - 2]` are `NaN`; a NaN inside the window propagates
 * `NaN` at that slot only. Mismatched input lengths return an
 * all-NaN buffer. Consumed by `ta.donchian` (channel midpoint) and
 * `ta.ichimoku` (Tenkan / Kijun / Senkou B raw).
 *
 * O(length) per slot — the per-bar scan is fine for the consumer
 * primitives, which keep their own incremental state.
 *
 * @formula  mid[i] = (max(high[i - length + 1 ..= i]) + min(low[i - length + 1 ..= i])) / 2
 * @warmup   length - 1
 * @since 0.2
 * @stable
 * @example
 *     // import { donchianMid } from "./donchianMid";
 *     // const mid = donchianMid(highs, lows, 20);
 */
export function donchianMid(high: Float64Array, low: Float64Array, length: number): Float64Array {
    const n = high.length;
    const out = new Float64Array(n);
    out.fill(Number.NaN);
    if (length <= 0 || n === 0 || n < length || low.length !== n) return out;

    for (let i = length - 1; i < n; i += 1) {
        let highest = high[i];
        let lowest = low[i];
        let windowFinite = Number.isFinite(highest) && Number.isFinite(lowest);
        if (windowFinite) {
            for (let j = i - length + 1; j < i; j += 1) {
                const h = high[j];
                const l = low[j];
                if (!Number.isFinite(h) || !Number.isFinite(l)) {
                    windowFinite = false;
                    break;
                }
                if (h > highest) highest = h;
                if (l < lowest) lowest = l;
            }
        }
        if (windowFinite) out[i] = (highest + lowest) / 2;
    }
    return out;
}
