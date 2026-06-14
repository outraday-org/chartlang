// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from invinite/src/components/trading-chart/indicators/lib/directionalState.ts
//   (commit 078f41fe2569d659d5aba726da8bcb5d3e2ced02, © Invinite).
// Re-licensed MIT for chartlang. The math is the reference, the code
// style is not.

import { wilderStep } from "./wilderSmoothing.js";

/**
 * Incremental Wilder-directional state shared by `ta.dmi` and
 * `ta.adx`. Tracks the seed-window accumulators + the smoothed
 * running values, plus the "previous-previous" snapshots the tick
 * replay needs to recompute the head against the prior closed bar.
 *
 * @formula  N/A — record type for {@link initDirectionalState}
 * @since 0.2
 * @stable
 * @example
 *     // const s: DirectionalState = initDirectionalState(14);
 */
export type DirectionalState = {
    readonly length: number;
    /** Number of CLOSED bars seen so far (counts every close-side step). */
    barCount: number;
    prevHigh: number;
    prevLow: number;
    prevClose: number;
    /** `prevHigh` / `prevLow` / `prevClose` as of the bar before the
     * current bar — frozen by the prior close-side advance so tick
     * replay can recompute against the previous closed state. */
    prevPrevHigh: number;
    prevPrevLow: number;
    prevPrevClose: number;
    seedPlusDm: number;
    seedMinusDm: number;
    seedTr: number;
    smoothedPlusDm: number;
    smoothedMinusDm: number;
    smoothedTr: number;
    /** Smoothed state captured at the prior close — used by tick replay. */
    prevClosedSmoothedPlusDm: number;
    prevClosedSmoothedMinusDm: number;
    prevClosedSmoothedTr: number;
    plusDi: number;
    minusDi: number;
};

/**
 * Allocate a fresh directional-state record. Shared by `ta.dmi` and
 * `ta.adx`. Exported so the ADX primitive can fold onto the same
 * recurrence without duplicating the field set.
 *
 * @formula  N/A — state constructor (zero / NaN initializers)
 * @since 0.2
 * @stable
 * @example
 *     // const s = initDirectionalState(14);
 */
export function initDirectionalState(length: number): DirectionalState {
    return {
        length,
        barCount: 0,
        prevHigh: Number.NaN,
        prevLow: Number.NaN,
        prevClose: Number.NaN,
        prevPrevHigh: Number.NaN,
        prevPrevLow: Number.NaN,
        prevPrevClose: Number.NaN,
        seedPlusDm: 0,
        seedMinusDm: 0,
        seedTr: 0,
        smoothedPlusDm: Number.NaN,
        smoothedMinusDm: Number.NaN,
        smoothedTr: Number.NaN,
        prevClosedSmoothedPlusDm: Number.NaN,
        prevClosedSmoothedMinusDm: Number.NaN,
        prevClosedSmoothedTr: Number.NaN,
        plusDi: Number.NaN,
        minusDi: Number.NaN,
    };
}

function trueRange(high: number, low: number, prevClose: number): number {
    // Defensive: `trueRange` is only called from bar 1 onwards (bar 0
    // accumulates `high - low` inline via `seedTr += high - low`), and
    // by then `prevClose` has been set to a finite value by the prior
    // close-side advance. NaN-prevClose fallback kept for symmetry.
    /* c8 ignore next */
    if (!Number.isFinite(prevClose)) return high - low;
    return Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
}

function rawDirectionalMovement(
    high: number,
    low: number,
    prevHigh: number,
    prevLow: number,
): { pDm: number; mDm: number } {
    const upMove = high - prevHigh;
    const downMove = prevLow - low;
    const pDm = upMove > downMove && upMove > 0 ? upMove : 0;
    const mDm = downMove > upMove && downMove > 0 ? downMove : 0;
    return { pDm, mDm };
}

/**
 * Fold the new closed bar into the directional state. Mutates
 * `dirState` in place and returns the freshly computed `+DI` /
 * `-DI` pair (NaN until the seed window completes). Shared by
 * `ta.dmi` and `ta.adx`. The returned pair is also written back
 * to `dirState.plusDi` / `dirState.minusDi` for the consumer's
 * downstream DX computation.
 *
 * @formula  See {@link wilderDirectional} (lib/) for the per-step
 *           +DM / -DM / TR formulas; this routine inlines the same
 *           recurrence in a single-pass mutable form.
 * @warmup   length + 1 (first defined DI at barCount === length + 1)
 * @since 0.2
 * @stable
 * @example
 *     // const { plusDi, minusDi } = advanceDirectionalClose(s, h, l, c);
 */
export function advanceDirectionalClose(
    dirState: DirectionalState,
    high: number,
    low: number,
    close: number,
): { plusDi: number; minusDi: number } {
    const { length } = dirState;

    if (!Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close)) {
        // Hold prior values forward, do not advance the seed / smoothed
        // state. Matches `atr.ts`'s NaN-input semantics — the recurrence
        // cannot resume past a NaN, so we keep the last known values.
        return { plusDi: dirState.plusDi, minusDi: dirState.minusDi };
    }

    dirState.barCount += 1;

    if (dirState.barCount === 1) {
        // First bar: seed prev-* snapshots and accumulate the bar-0
        // range as the initial TR contribution. Matches the reference
        // `lib/wilderDirectional` whose `seedTr` starts at
        // `high[0] - low[0]`. No DM yet (no prevHigh).
        dirState.prevPrevHigh = dirState.prevHigh;
        dirState.prevPrevLow = dirState.prevLow;
        dirState.prevPrevClose = dirState.prevClose;
        dirState.prevHigh = high;
        dirState.prevLow = low;
        dirState.prevClose = close;
        dirState.seedTr += high - low;
        return { plusDi: Number.NaN, minusDi: Number.NaN };
    }

    const tr = trueRange(high, low, dirState.prevClose);
    const { pDm, mDm } = rawDirectionalMovement(high, low, dirState.prevHigh, dirState.prevLow);

    // Capture prev-prev BEFORE overwriting prev (tick replay needs the
    // bar-before-current snapshot).
    dirState.prevPrevHigh = dirState.prevHigh;
    dirState.prevPrevLow = dirState.prevLow;
    dirState.prevPrevClose = dirState.prevClose;
    dirState.prevHigh = high;
    dirState.prevLow = low;
    dirState.prevClose = close;

    if (dirState.barCount <= length) {
        // Seed window: barCount in [2, length] inclusive accumulate
        // pDm + mDm + tr; barCount === length + 1 completes the seed
        // and emits the first defined DI pair.
        dirState.seedPlusDm += pDm;
        dirState.seedMinusDm += mDm;
        dirState.seedTr += tr;
        return { plusDi: Number.NaN, minusDi: Number.NaN };
    }

    if (dirState.barCount === length + 1) {
        // Seed completes at the (length + 1)-th close — first defined
        // slot is bar index `length` (zero-based; matches the
        // full-recompute reference). Capture the pre-completion seed
        // sums on `prevClosedSmoothed*` so tick replay can substitute
        // the head bar's contribution.
        dirState.prevClosedSmoothedPlusDm = dirState.seedPlusDm;
        dirState.prevClosedSmoothedMinusDm = dirState.seedMinusDm;
        dirState.prevClosedSmoothedTr = dirState.seedTr;
        dirState.seedPlusDm += pDm;
        dirState.seedMinusDm += mDm;
        dirState.seedTr += tr;
        dirState.smoothedPlusDm = dirState.seedPlusDm;
        dirState.smoothedMinusDm = dirState.seedMinusDm;
        dirState.smoothedTr = dirState.seedTr;
        const tr0 = dirState.smoothedTr;
        const plusDi = tr0 === 0 ? 0 : (100 * dirState.smoothedPlusDm) / tr0;
        const minusDi = tr0 === 0 ? 0 : (100 * dirState.smoothedMinusDm) / tr0;
        dirState.plusDi = plusDi;
        dirState.minusDi = minusDi;
        return { plusDi, minusDi };
    }

    // Post-seed: Wilder-smooth +DM / -DM / TR.
    dirState.prevClosedSmoothedPlusDm = dirState.smoothedPlusDm;
    dirState.prevClosedSmoothedMinusDm = dirState.smoothedMinusDm;
    dirState.prevClosedSmoothedTr = dirState.smoothedTr;
    dirState.smoothedPlusDm = wilderStep(dirState.smoothedPlusDm, pDm, length);
    dirState.smoothedMinusDm = wilderStep(dirState.smoothedMinusDm, mDm, length);
    dirState.smoothedTr = wilderStep(dirState.smoothedTr, tr, length);
    const tr1 = dirState.smoothedTr;
    const plusDi = tr1 === 0 ? 0 : (100 * dirState.smoothedPlusDm) / tr1;
    const minusDi = tr1 === 0 ? 0 : (100 * dirState.smoothedMinusDm) / tr1;
    dirState.plusDi = plusDi;
    dirState.minusDi = minusDi;
    return { plusDi, minusDi };
}

/**
 * Replay the latest TR / DM / DI against the FROZEN prior-closed
 * smoothed state. Does NOT mutate `dirState` (the consumer's
 * close-side advance owns mutation). Returns the head DI pair the
 * primitive should write to its output buffer.
 *
 * @formula  Same recurrence as {@link advanceDirectionalClose}, but
 *           applied against `prevClosedSmoothed*` snapshots so the
 *           current bar can be replaced rather than appended.
 * @since 0.2
 * @stable
 * @example
 *     // const di = tickDirectional(s, h, l, c);
 */
export function tickDirectional(
    dirState: DirectionalState,
    high: number,
    low: number,
    close: number,
): { plusDi: number; minusDi: number } {
    if (dirState.barCount < dirState.length + 1) {
        return { plusDi: Number.NaN, minusDi: Number.NaN };
    }
    if (!Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close)) {
        return { plusDi: dirState.plusDi, minusDi: dirState.minusDi };
    }
    // Tick replay reads against the bar-before-current (prevPrevHigh /
    // prevPrevLow / prevPrevClose) — the values captured at the prior
    // close. The current closed bar's contribution to the smoothed
    // state has already been folded; we reverse-undo it by reading off
    // `prevClosedSmoothed*` and applying one fresh Wilder step.
    const tr = trueRange(high, low, dirState.prevPrevClose);
    const { pDm, mDm } = rawDirectionalMovement(
        high,
        low,
        dirState.prevPrevHigh,
        dirState.prevPrevLow,
    );

    if (dirState.barCount === dirState.length + 1) {
        // We just seeded on the current close; the
        // `prevClosedSmoothed*` snapshots are the seed sums BEFORE
        // this close's contribution. Re-seed with the tick's
        // contribution substituted.
        const seedPlusDm = dirState.prevClosedSmoothedPlusDm + pDm;
        const seedMinusDm = dirState.prevClosedSmoothedMinusDm + mDm;
        const seedTr = dirState.prevClosedSmoothedTr + tr;
        // Defensive: seedTr === 0 only on a perfectly-flat seed window
        // (every bar high === low === prev close). Real data never hits it.
        const plusDi = /* c8 ignore next */ seedTr === 0 ? 0 : (100 * seedPlusDm) / seedTr;
        const minusDi = /* c8 ignore next */ seedTr === 0 ? 0 : (100 * seedMinusDm) / seedTr;
        return { plusDi, minusDi };
    }
    const plusDmSm = wilderStep(dirState.prevClosedSmoothedPlusDm, pDm, dirState.length);
    const minusDmSm = wilderStep(dirState.prevClosedSmoothedMinusDm, mDm, dirState.length);
    const trSm = wilderStep(dirState.prevClosedSmoothedTr, tr, dirState.length);
    const plusDi = /* c8 ignore next */ trSm === 0 ? 0 : (100 * plusDmSm) / trSm;
    const minusDi = /* c8 ignore next */ trSm === 0 ? 0 : (100 * minusDmSm) / trSm;
    return { plusDi, minusDi };
}
