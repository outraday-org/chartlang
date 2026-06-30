// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// Ported from ../invinite/src/components/trading-chart/indicators/lib/align-htf-series-cache.ts
//   @ 3234c8c0c3f9880d9d1e3a3ee63ebd55ddd535f4.
// Translated, not transcribed -- Series<T> shape, JSDoc, runtime context.
// See packages/runtime/src/ta/CLAUDE.md for the port convention.

import type { Bar } from "@invinite-org/chartlang-core";

import * as kernel from "./alignHtfSeriesToLtf.js";

type CacheEntry = {
    readonly htfLength: number;
    readonly ltfLength: number;
    readonly secondaryIsFinerThanMain: boolean;
    readonly aligned: ReadonlyArray<number>;
};

const CACHE = new WeakMap<
    ReadonlyArray<Bar>,
    WeakMap<ReadonlyArray<Bar>, WeakMap<ReadonlyArray<number>, CacheEntry>>
>();

/**
 * Return a cached HTF-to-LTF aligned series, computing it on cache miss.
 *
 * The cache keys on HTF bar-array, LTF bar-array, and HTF source-series
 * identity, validating the stored entry against both live bar lengths. Keying
 * on the source series too lets the same `(htfBars, ltfBars)` pair carry
 * distinct alignments for `close` / `high` / `low` / ... within one bar (the
 * caller reuses one bar-array identity across every source key). Appending to
 * either bar array invalidates the hit; WeakMap reachability evicts naturally.
 *
 * `secondaryIsFinerThanMain` selects the alignment direction (see the kernel).
 * Direction is a pure function of the (secondary interval, main interval) pair,
 * hence stable per `(htfBars, ltfBars)` identity within a script — a coarser
 * array can never alias a finer secondary. The flag is nonetheless validated on
 * the stored entry so a mismatch is treated as a miss (defense-in-depth, same
 * spirit as the length checks).
 *
 * @since 0.5
 * @stable
 * @internal
 * @example
 *     const aligned = getOrAlign(htfBars, htfCloses, ltfBars);
 *     void aligned;
 */
export function getOrAlign(
    htfBars: ReadonlyArray<Bar>,
    htfSeries: ReadonlyArray<number>,
    ltfBars: ReadonlyArray<Bar>,
    secondaryIsFinerThanMain = false,
): ReadonlyArray<number> {
    let byLtf = CACHE.get(htfBars);
    if (byLtf === undefined) {
        byLtf = new WeakMap();
        CACHE.set(htfBars, byLtf);
    }
    let bySeries = byLtf.get(ltfBars);
    if (bySeries === undefined) {
        bySeries = new WeakMap();
        byLtf.set(ltfBars, bySeries);
    }

    const cached = bySeries.get(htfSeries);
    if (
        cached !== undefined &&
        cached.htfLength === htfBars.length &&
        cached.ltfLength === ltfBars.length &&
        cached.secondaryIsFinerThanMain === secondaryIsFinerThanMain
    ) {
        return cached.aligned;
    }

    const aligned = kernel.alignHtfSeriesToLtf(
        htfBars,
        htfSeries,
        ltfBars,
        secondaryIsFinerThanMain,
    );
    bySeries.set(htfSeries, {
        htfLength: htfBars.length,
        ltfLength: ltfBars.length,
        secondaryIsFinerThanMain,
        aligned,
    });
    return aligned;
}
