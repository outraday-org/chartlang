// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { MutableArraySlot } from "../state/arraySlot.js";

/**
 * Pure, frozen Pine-parity **free-function** view over a `state.array<number>`
 * handle. Each member delegates 1:1 to the handle method of the same name —
 * there is no second implementation, so the two call styles (`win.avg()` and
 * `array.avg(win)`) can never drift. Same shape as `color` / `str` / `math`:
 * frozen, deterministic, compute-time, no slot and no capability. The NaN /
 * empty-window policy and the never-mutate-on-`sort` guarantee are documented
 * on {@link MutableArraySlot}.
 *
 * @since 1.4
 * @stable
 * @example
 *     const m = array.avg(win);
 *     void m;
 */
export const array = Object.freeze({
    sum: (a: MutableArraySlot<number>): number => a.sum(),
    avg: (a: MutableArraySlot<number>): number => a.avg(),
    min: (a: MutableArraySlot<number>): number => a.min(),
    max: (a: MutableArraySlot<number>): number => a.max(),
    range: (a: MutableArraySlot<number>): number => a.range(),
    variance: (a: MutableArraySlot<number>, biased?: boolean): number => a.variance(biased),
    stdev: (a: MutableArraySlot<number>, biased?: boolean): number => a.stdev(biased),
    median: (a: MutableArraySlot<number>): number => a.median(),
    percentile: (a: MutableArraySlot<number>, p: number): number => a.percentile(p),
    indexOf: (a: MutableArraySlot<number>, v: number): number => a.indexOf(v),
    includes: (a: MutableArraySlot<number>, v: number): boolean => a.includes(v),
    sort: (a: MutableArraySlot<number>, order?: "asc" | "desc"): ReadonlyArray<number> =>
        a.sort(order),
});

/**
 * Type of the frozen {@link array} namespace.
 *
 * @since 1.4
 * @stable
 * @example
 *     const ns: ArrayNamespace = array;
 *     void ns;
 */
export type ArrayNamespace = typeof array;
