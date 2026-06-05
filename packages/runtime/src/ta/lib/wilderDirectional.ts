// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/lib/wilder-directional.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. See PLAN.md §3.1 for the
// provenance contract; the math is the reference, the code style is not.

import { wilderStep } from "./wilderSmoothing";

/**
 * Wilder directional movement bundle. All four arrays have length
 * `n` (= `high.length`); warmup slots `[0, length - 1]` are `NaN`.
 *
 * `plusDm` / `minusDm` are the Wilder-smoothed per-bar directional
 * movement (divided by `length` so they read as averages — matches
 * what TradingView's `ta.dmi` plots). `plusDi` / `minusDi` are
 * `100 * smoothedPlusDm / smoothedTr` (symmetric for the minus
 * side); these are the values consumed by `adxFromDi`.
 *
 * @formula  N/A — return-bundle type for {@link wilderDirectional}
 * @since 0.2
 * @stable
 * @example
 *     // const dm: DirectionalMovement = wilderDirectional(h, l, c, 14);
 */
export type DirectionalMovement = Readonly<{
    plusDm: Float64Array;
    minusDm: Float64Array;
    plusDi: Float64Array;
    minusDi: Float64Array;
}>;

/**
 * Wilder's `+DM` / `-DM` / `+DI` / `-DI` over a `length`-bar
 * smoothing window. The per-bar raw `+DM` / `-DM` are computed from
 * consecutive high / low deltas, then smoothed via Wilder's α = 1/N
 * recurrence (reuses `wilderStep`). True Range is computed inline
 * (rather than via `lib/trSeries`) because this helper operates on
 * Float64Array inputs, not `Bar[]`.
 *
 * Warmup: `length` — one extra slot above the smoothing window so
 * the TR seed can settle. First valid slot index is `length`.
 *
 * `plusDi` / `minusDi` fall back to `0` when the smoothed TR is
 * zero (matches invinite). Any non-finite input slot inside the
 * seed window leaves the entire output `NaN` from that slot
 * onwards (Wilder recurrence cannot resume past a NaN seed).
 *
 * @formula  upMove   = high[i] - high[i-1] ;
 *           downMove = low[i-1] - low[i] ;
 *           plusDm   = upMove > downMove && upMove > 0 ? upMove : 0 ;
 *           minusDm  = downMove > upMove && downMove > 0 ? downMove : 0 ;
 *           tr[i]    = max(h - l, |h - prevClose|, |l - prevClose|) ;
 *           smoothed via wilderStep over `length`.
 * @warmup   length
 * @since 0.2
 * @stable
 * @example
 *     // import { wilderDirectional } from "./wilderDirectional";
 *     // const dm = wilderDirectional(highs, lows, closes, 14);
 */
export function wilderDirectional(
    high: Float64Array,
    low: Float64Array,
    close: Float64Array,
    length: number,
): DirectionalMovement {
    const n = high.length;
    const plusDm = new Float64Array(n);
    const minusDm = new Float64Array(n);
    const plusDi = new Float64Array(n);
    const minusDi = new Float64Array(n);
    plusDm.fill(Number.NaN);
    minusDm.fill(Number.NaN);
    plusDi.fill(Number.NaN);
    minusDi.fill(Number.NaN);

    if (n === 0 || length <= 0 || n <= length || low.length !== n || close.length !== n) {
        return { minusDi, minusDm, plusDi, plusDm };
    }

    let seedPlusDm = 0;
    let seedMinusDm = 0;
    let seedTr = high[0] - low[0];
    let seedFinite = Number.isFinite(seedTr);

    for (let i = 1; i <= length; i += 1) {
        const h = high[i];
        const l = low[i];
        const prevClose = close[i - 1];
        const prevHigh = high[i - 1];
        const prevLow = low[i - 1];

        if (
            !Number.isFinite(h) ||
            !Number.isFinite(l) ||
            !Number.isFinite(prevClose) ||
            !Number.isFinite(prevHigh) ||
            !Number.isFinite(prevLow)
        ) {
            seedFinite = false;
            break;
        }

        const a = h - l;
        const b = Math.abs(h - prevClose);
        const d = Math.abs(l - prevClose);
        const tr = Math.max(a, b, d);

        const upMove = h - prevHigh;
        const downMove = prevLow - l;
        const pDm = upMove > downMove && upMove > 0 ? upMove : 0;
        const mDm = downMove > upMove && downMove > 0 ? downMove : 0;

        seedPlusDm += pDm;
        seedMinusDm += mDm;
        seedTr += tr;
    }

    if (!seedFinite) return { minusDi, minusDm, plusDi, plusDm };

    let smoothedPlusDm = seedPlusDm;
    let smoothedMinusDm = seedMinusDm;
    let smoothedTr = seedTr;

    plusDm[length] = smoothedPlusDm / length;
    minusDm[length] = smoothedMinusDm / length;
    plusDi[length] = smoothedTr === 0 ? 0 : (100 * smoothedPlusDm) / smoothedTr;
    minusDi[length] = smoothedTr === 0 ? 0 : (100 * smoothedMinusDm) / smoothedTr;

    for (let i = length + 1; i < n; i += 1) {
        const h = high[i];
        const l = low[i];
        const prevClose = close[i - 1];
        const prevHigh = high[i - 1];
        const prevLow = low[i - 1];

        if (
            !Number.isFinite(h) ||
            !Number.isFinite(l) ||
            !Number.isFinite(prevClose) ||
            !Number.isFinite(prevHigh) ||
            !Number.isFinite(prevLow)
        ) {
            return { minusDi, minusDm, plusDi, plusDm };
        }

        const a = h - l;
        const b = Math.abs(h - prevClose);
        const d = Math.abs(l - prevClose);
        const tr = Math.max(a, b, d);

        const upMove = h - prevHigh;
        const downMove = prevLow - l;
        const pDm = upMove > downMove && upMove > 0 ? upMove : 0;
        const mDm = downMove > upMove && downMove > 0 ? downMove : 0;

        smoothedPlusDm = wilderStep(smoothedPlusDm, pDm, length);
        smoothedMinusDm = wilderStep(smoothedMinusDm, mDm, length);
        smoothedTr = wilderStep(smoothedTr, tr, length);

        plusDm[i] = smoothedPlusDm / length;
        minusDm[i] = smoothedMinusDm / length;
        plusDi[i] = smoothedTr === 0 ? 0 : (100 * smoothedPlusDm) / smoothedTr;
        minusDi[i] = smoothedTr === 0 ? 0 : (100 * smoothedMinusDm) / smoothedTr;
    }

    return { minusDi, minusDm, plusDi, plusDm };
}
