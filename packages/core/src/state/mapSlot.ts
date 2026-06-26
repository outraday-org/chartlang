// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * Script-facing handle on a persistent, bounded **keyed collection** —
 * Pine's `map<K, V>` with capacity eviction. Unlike {@link MutableArraySlot}
 * (a FIFO of many values) this is a key→value store: `set` inserts/updates,
 * `get` returns `undefined` for an absent key (distinct from a stored `0`),
 * `has`/`delete` test/remove a key, `size` is the current entry count
 * (`≤ capacity`), and `clear()` empties it.
 *
 * The collection persists across bars with `state.*` committed/tentative
 * semantics: writes during a tick are tentative and discarded if a later tick
 * replaces the head bar; on bar close they commit. `capacity` is a required
 * compile-time numeric literal so the store is bounded and snapshot-clean.
 * Inserting a **new** key once `size === capacity` evicts the oldest-inserted
 * key (insertion-order FIFO); re-`set`ting an existing key updates in place
 * without changing its insertion age.
 *
 * Keys are `string | number` — the only deterministically-hashable,
 * snapshot-cloneable key types (object keys would break the structural-clone
 * snapshot/restore and the host transferable boundary). The v1 value type is
 * `number`. This is **not** number-coercible — there is no `+m` / `valueOf`;
 * it is a collection, not a value.
 *
 * Iteration in v1 is bounded indexing, not iterators: `keyAt(i)` reads the
 * `i`-th key in insertion order (`0` = oldest) and `size` bounds the walk, so
 * a `for (let i = 0; i < m.size; i++)` loop is the accepted bounded-loop shape
 * (an iterator + `for...of` would trip the compiler's `unbounded-loop` ban).
 * `keys()`/`values()`/`entries()` iterators are **deferred** to a follow-up.
 *
 * @since 1.4
 * @stable
 * @example
 *     function bump(m: MutableMapSlot<number, number>, k: number): void {
 *         m.set(k, (m.get(k) ?? 0) + 1);
 *     }
 */
export type MutableMapSlot<K extends string | number, V> = {
    set(key: K, value: V): void;
    get(key: K): V | undefined;
    has(key: K): boolean;
    delete(key: K): boolean;
    clear(): void;
    readonly size: number;
    /** The `index`-th key in insertion order (0 = oldest); `undefined` out of range. @since 1.4 */
    keyAt(index: number): K | undefined;
};
