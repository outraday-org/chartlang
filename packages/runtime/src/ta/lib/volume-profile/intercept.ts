// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// Ported from ../invinite/src/components/trading-chart/indicators/lib/volume-profile/intercept.ts
//   @ 3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4.
// Translated, not transcribed — ReadonlyArray<number> inputs, JSDoc, runtime.
// See packages/runtime/src/ta/CLAUDE.md for the port convention.

import type { VolumeProfileBar } from "./types";

/**
 * Find the first future bar whose `[low, high]` range intercepts
 * `price`, or the rightmost bar when no intercept exists.
 *
 * @formula PLAN §10.1.1 — right-extension line ends at first bar
 *          containing the reference price, else chart right edge.
 * @since 0.5
 * @internal
 * @stable
 * @example
 *     // const idx = findInterceptIndex(bars, 10, 100);
 */
export function findInterceptIndex(
    bars: ReadonlyArray<Pick<VolumeProfileBar, "high" | "low">>,
    fromIdx: number,
    price: number,
): number {
    const n = bars.length;
    if (n === 0) return -1;
    if (!Number.isFinite(price)) return n - 1;

    for (let i = Math.max(0, fromIdx + 1); i < n; i += 1) {
        const bar = bars[i];
        if (bar.low <= price && bar.high >= price) return i;
    }

    return n - 1;
}
