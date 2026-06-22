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
};
