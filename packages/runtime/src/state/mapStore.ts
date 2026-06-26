// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { MutableMapSlot } from "@invinite-org/chartlang-core";

/**
 * The v1 `state.map` key type: `string | number` are the only
 * deterministically-hashable, snapshot-cloneable keys (object keys would break
 * the structural-clone snapshot/restore and the host transferable boundary).
 *
 * @since 1.4
 * @stable
 * @example
 *     const k: MapKey = 42;
 *     void k;
 */
export type MapKey = string | number;

/**
 * Runtime slot behind a script-facing `state.map(capacity)` handle. The
 * keyed-collection sibling of {@link ArrayStateSlot} — where the array slot is a
 * bounded FIFO of two `Float64RingBuffer`s, this is a bounded **key→value**
 * store of two `Map<MapKey, number>`s: `tentativeMap` holds the live,
 * author-facing writes; `committedMap` is the bar-close snapshot a tick rolls
 * back to.
 *
 * The committed/tentative discipline mirrors `state.array`: writes during a tick
 * mutate the tentative map; a head-bar-replacing tick resets it from committed
 * (in-progress writes discarded); a bar close commits tentative into committed.
 * Unlike the array's in-place typed-array `copyFrom` memcpy, a `Map` has no
 * fast-copy, so commit/tick reassign the field to a `new Map(source)` ordered
 * clone (`O(size)`, bounded because `capacity` is a required compile-time
 * literal). The clone preserves insertion order — exactly the FIFO eviction
 * order. The two map fields are therefore mutable (the one deliberate divergence
 * from `ArrayStateSlot`'s readonly rings); the handle reads `slot.tentativeMap`
 * fresh on every call so the reassignment is transparent to handle identity.
 *
 * @since 1.4
 * @stable
 * @example
 *     const slot = new MapStore(4);
 *     slot.handle.set(1, 10);
 *     slot.onBarClose();
 *     slot.handle.get(1); // 10
 */
export class MapStore {
    committedMap: Map<MapKey, number>;
    tentativeMap: Map<MapKey, number>;
    readonly handle: MutableMapSlot<MapKey, number>;

    constructor(public readonly capacity: number) {
        this.committedMap = new Map();
        this.tentativeMap = new Map();
        this.handle = buildMapHandle(this);
    }

    /** Commit the tentative map into the committed map (bar close). */
    onBarClose(): void {
        this.committedMap = new Map(this.tentativeMap);
    }

    /** Roll the tentative map back to the committed map (head-replacing tick). */
    onBarTick(): void {
        this.tentativeMap = new Map(this.committedMap);
    }
}

/**
 * Build the identity-stable {@link MutableMapSlot} handle over a {@link MapStore}.
 * All author-facing reads and writes route through the **tentative** map
 * (mirroring `ArrayStateSlot`'s tentative-ring routing); the committed map is the
 * rollback source. A plain object with getters — no `Proxy` — because the handle
 * has a fixed method set and is deliberately not number-coercible.
 *
 * Eviction is insertion-order FIFO: `set` of an **existing** key updates in
 * place without changing its insertion age (JS `Map` semantics); `set` of a
 * **new** key once `size === capacity` evicts the oldest-inserted key (the first
 * `keys()` entry) before inserting. `get` returns `undefined` for an absent key
 * (distinct from a stored `0`). `keyAt(index)` walks `keys()` to the
 * insertion-order index (`0` = oldest), returning `undefined` out of range.
 *
 * @since 1.4
 * @stable
 * @example
 *     // const handle = buildMapHandle(new MapStore(4));
 *     // handle.set("a", 1);
 *     // handle.get("a"); // 1
 */
export function buildMapHandle(slot: MapStore): MutableMapSlot<MapKey, number> {
    return {
        set(key: MapKey, value: number): void {
            const store = slot.tentativeMap;
            if (store.has(key)) {
                // Update in place — JS `Map` keeps the existing insertion age.
                store.set(key, value);
                return;
            }
            if (store.size >= slot.capacity) {
                const oldest = store.keys().next();
                // `done` is only true at capacity 0 (empty store); the narrow
                // avoids a non-null assertion on `oldest.value`.
                if (!oldest.done) {
                    store.delete(oldest.value);
                }
            }
            if (store.size < slot.capacity) {
                store.set(key, value);
            }
        },
        get(key: MapKey): number | undefined {
            return slot.tentativeMap.get(key);
        },
        has(key: MapKey): boolean {
            return slot.tentativeMap.has(key);
        },
        delete(key: MapKey): boolean {
            return slot.tentativeMap.delete(key);
        },
        clear(): void {
            slot.tentativeMap.clear();
        },
        get size(): number {
            return slot.tentativeMap.size;
        },
        keyAt(index: number): MapKey | undefined {
            if (index < 0) return undefined;
            // Walk insertion order to the index; falling off the end (an
            // out-of-range high index) returns `undefined`.
            let i = 0;
            for (const key of slot.tentativeMap.keys()) {
                if (i === index) return key;
                i += 1;
            }
            return undefined;
        },
    };
}

/**
 * Allocate a fresh {@link MapStore} — both maps empty (`size === 0`). Unlike
 * `state.float(init)` there is no seed value: an empty collection starts empty.
 *
 * @since 1.4
 * @stable
 * @example
 *     // const slot = createMapStore(20);
 *     // slot.handle.size; // 0
 */
export function createMapStore(capacity: number): MapStore {
    return new MapStore(capacity);
}

/**
 * Rebuild a {@link MapStore} from already-restored maps (snapshot path). The
 * handle identity is recreated — acceptable, same as `state.array` /
 * `state.series` / `ta.*` restore. Both maps are cloned so the caller's maps are
 * never aliased into the live slot.
 *
 * @since 1.4
 * @stable
 * @example
 *     // const slot = restoreMapStore(4, committedMap, tentativeMap);
 *     // slot.handle.size;
 */
export function restoreMapStore(
    capacity: number,
    committedMap: Map<MapKey, number>,
    tentativeMap: Map<MapKey, number>,
): MapStore {
    const slot = new MapStore(capacity);
    slot.committedMap = new Map(committedMap);
    slot.tentativeMap = new Map(tentativeMap);
    return slot;
}
