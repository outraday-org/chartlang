// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * Script-facing handle on a persistent, bounded **FIFO collection** —
 * Pine's `var array<…>` with capacity eviction. Unlike {@link MutableSlot}
 * (one value's history) or a `Series` (bar-indexed history), this is a
 * **collection** you push many values into: `push` appends (evicting the
 * oldest once `capacity` is reached), `get(n)` reads the `n`-th element from
 * the newest (`n = 0`), `last()` is the newest, `size` is the current filled
 * count, `capacity` is the fixed bound, and `clear()` empties it.
 *
 * The collection persists across bars with `state.*` committed/tentative
 * semantics: pushes during a tick are tentative and discarded if a later
 * tick replaces the head bar; on bar close they commit. `capacity` is a
 * required compile-time numeric literal so the store is bounded and
 * snapshot-clean.
 *
 * Out-of-range `get(n)` returns the element type's empty value (`NaN` for
 * `number`); it never throws. This is **not** number-coercible — there is no
 * `+a` / `valueOf`; it is a collection, not a value.
 *
 * **Numeric reductions** (`sum`/`avg`/`min`/`max`/`range`/`variance`/`stdev`/
 * `median`/`percentile`) **skip NaN** elements, matching the `ta.*` weighted-
 * window convention; an empty or all-NaN window returns `NaN`, never `0`.
 * `sort()` returns a fresh sorted **copy** — it never mutates the ring (the
 * FIFO must keep insertion order for eviction). The reductions are only
 * meaningful for the v1 `number` element type, so their return types are
 * unconditional `number`. The runtime bodies live on the installed handle
 * (see the runtime store); this interface declares only their shape.
 *
 * @since 1.3
 * @stable
 * @example
 *     function rollingMean(a: MutableArraySlot<number>, x: number): number {
 *         a.push(x);
 *         let sum = 0;
 *         for (let i = 0; i < a.size; i++) sum += a.get(i);
 *         return sum / a.size;
 *     }
 */
export type MutableArraySlot<T> = {
    push(value: T): void;
    get(n: number): T;
    last(): T;
    clear(): void;
    readonly size: number;
    readonly capacity: number;

    /** Σ of non-NaN elements; NaN if the window is empty / all-NaN. @since 1.4 */
    sum(): number;
    /** Mean of non-NaN elements; NaN if empty / all-NaN. @since 1.4 */
    avg(): number;
    /** Min of non-NaN elements; NaN if empty / all-NaN. @since 1.4 */
    min(): number;
    /** Max of non-NaN elements; NaN if empty / all-NaN. @since 1.4 */
    max(): number;
    /** max − min over non-NaN elements; NaN if empty / all-NaN. @since 1.4 */
    range(): number;
    /** Variance; population by default, sample when `biased === false`. @since 1.4 */
    variance(biased?: boolean): number;
    /** Standard deviation; population by default, sample when `biased === false`. @since 1.4 */
    stdev(biased?: boolean): number;
    /** Median of non-NaN elements (linear interpolation at the midpoint). @since 1.4 */
    median(): number;
    /** p-th percentile, `p ∈ [0,100]`, linear interpolation. @since 1.4 */
    percentile(p: number): number;
    /** First index (0 = newest) of `value`, or -1. @since 1.4 */
    indexOf(value: T): number;
    /** Whether `value` is present. @since 1.4 */
    includes(value: T): boolean;
    /** Fresh sorted COPY, ascending by default (never mutates the ring). @since 1.4 */
    sort(order?: "asc" | "desc"): ReadonlyArray<T>;
};
