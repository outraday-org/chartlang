// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";

import { bucketLtfBarsByMainContainment } from "./bucketLtfBarsByMainContainment";

type Bucketed = ReadonlyArray<ReadonlyArray<Bar>>;
type CacheEntry = {
    readonly mainLength: number;
    readonly ltfLength: number;
    readonly buckets: Bucketed;
};

const CACHE = new WeakMap<ReadonlyArray<Bar>, WeakMap<ReadonlyArray<Bar>, CacheEntry>>();

/**
 * Return cached LTF buckets, computing them on cache miss.
 *
 * @since 0.6
 * @stable
 * @example
 *     const buckets = getOrBucket([], []);
 *     void buckets;
 */
export function getOrBucket(mainBars: ReadonlyArray<Bar>, ltfBars: ReadonlyArray<Bar>): Bucketed {
    let byLtf = CACHE.get(mainBars);
    if (byLtf === undefined) {
        byLtf = new WeakMap();
        CACHE.set(mainBars, byLtf);
    }

    const cached = byLtf.get(ltfBars);
    if (
        cached !== undefined &&
        cached.mainLength === mainBars.length &&
        cached.ltfLength === ltfBars.length
    ) {
        return cached.buckets;
    }

    const buckets = bucketLtfBarsByMainContainment(mainBars, ltfBars);
    byLtf.set(ltfBars, { mainLength: mainBars.length, ltfLength: ltfBars.length, buckets });
    return buckets;
}
