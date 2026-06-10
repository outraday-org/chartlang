// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";

/**
 * Bucket lower-timeframe bars by main-bar containment.
 *
 * For each main bar `m[i]`, collects every LTF bar whose open time falls in
 * `[m[i].time, m[i + 1].time)`. The final main bar has no successor and
 * absorbs every LTF bar with `time >= m[i].time`, exposing the in-progress
 * half-bucket. Inputs must be sorted ascending by `time`.
 *
 * @formula Two-pointer walk over ascending main and LTF bars.
 * @warmup Empty main input returns `[]`; empty LTF input returns one empty
 * bucket per main bar.
 * @since 0.6
 * @stable
 * @example
 *     bucketLtfBarsByMainContainment(
 *         [{ time: 0 } as Bar, { time: 60_000 } as Bar],
 *         [{ time: 0 } as Bar, { time: 30_000 } as Bar],
 *     );
 */
export function bucketLtfBarsByMainContainment(
    mainBars: ReadonlyArray<Bar>,
    ltfBars: ReadonlyArray<Bar>,
): ReadonlyArray<ReadonlyArray<Bar>> {
    if (mainBars.length === 0) return [];
    const buckets: Bar[][] = Array.from({ length: mainBars.length }, () => []);

    let mainIndex = 0;
    let ltfIndex = 0;
    while (ltfIndex < ltfBars.length && ltfBars[ltfIndex].time < mainBars[0].time) {
        ltfIndex += 1;
    }

    while (ltfIndex < ltfBars.length) {
        const ltf = ltfBars[ltfIndex];
        while (mainIndex + 1 < mainBars.length && mainBars[mainIndex + 1].time <= ltf.time) {
            mainIndex += 1;
        }
        buckets[mainIndex].push(ltf);
        ltfIndex += 1;
    }

    return buckets;
}
