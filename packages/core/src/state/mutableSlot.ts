// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * Script-facing handle on a persistent cross-bar slot, Pine's `var` /
 * `varip` equivalent. Reads return the active step value; writes follow
 * the runtime's committed/tentative slot semantics.
 *
 * Intentionally minimal: no `.history()`, no `.previous()`, no indexing.
 * Scripts that need the previous bar's value store it in a second slot or
 * use `ta.*` series-indexing primitives.
 *
 * @since 0.4
 * @stable
 * @example
 *     const slot: MutableSlot<number> = {
 *         get value() {
 *             return 0;
 *         },
 *         set value(_next: number) {},
 *     };
 *     slot.value = 1;
 */
export type MutableSlot<T> = {
    get value(): T;
    set value(v: T);
};
