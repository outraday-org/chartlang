// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/lib/apply-offset.ts
//   (commit d2d1043c1b039f66d2f3674526d303d31cf2f1e0, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.

/**
 * TradingView-parity bar-shift helper. `offset === 0` returns the
 * same array reference so callers can keep a no-shift call in the
 * fast path without an allocation. Positive `offset` shifts forward
 * in time (output[i] = values[i − offset], NaN where out of range);
 * negative shifts backward.
 *
 * Phase 1 always passes `offset = 0` — the helper exists so Phase 4's
 * universal `opts.offset` (§9.1) is a zero-line wire-up.
 *
 * @formula  out[i] = values[i − offset] (NaN when i − offset ∉ [0, n))
 * @since 0.1
 * @stable
 * @example
 *     // import { applyOffsetToSeries } from "./applyOffset";
 *     // const shifted = applyOffsetToSeries(values, 2);
 */
export function applyOffsetToSeries(values: Float64Array, offset: number): Float64Array {
    if (offset === 0 || values.length === 0) return values;
    const n = values.length;
    const out = new Float64Array(n);
    out.fill(Number.NaN);
    for (let i = 0; i < n; i += 1) {
        const src = i - offset;
        if (src >= 0 && src < n) out[i] = values[src];
    }
    return out;
}
