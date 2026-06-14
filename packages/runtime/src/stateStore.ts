// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * Per-runner slot store the runtime hands stateful primitives. Phase 1
 * ships only the in-memory default — `inMemoryStateStore()` — keyed
 * by `${slotIdPrefix ?? ""}${slotId}:state` where the slot id is the
 * compiler-assigned id and the prefix is the active
 * `RuntimeContext.slotIdPrefix` (`""` for primary, `dep:<localId>/`
 * for deps, `export:<exportName>/` for siblings — see Task 5). Phase 5
 * layers a `PersistentStateStore` sub-interface on top with snapshot
 * `load` / `save` / `clear` methods. Implementations
 * (IDB-backed for browsers, caller-supplied for servers) satisfy the
 * Phase-5 sub-interface; the Phase-1 surface stays stable and
 * additive.
 *
 * @since 0.1
 * @example
 *     // import { inMemoryStateStore } from "@invinite-org/chartlang-runtime";
 *     // const store = inMemoryStateStore();
 *     // store.set<{ count: number }>("ta:ema:slot#0", { count: 1 });
 *     // store.has("ta:ema:slot#0"); // true
 *     // store.get<{ count: number }>("ta:ema:slot#0"); // { count: 1 }
 */
export type StateStore = {
    get<T>(slotId: string): T | undefined;
    set<T>(slotId: string, value: T): void;
    has(slotId: string): boolean;
    clear(): void;
};

/**
 * Default Phase-1 `StateStore` — a process-local `Map<string, unknown>`
 * with last-write-wins semantics. Used by the CLI, the conformance
 * suite, and the host-worker until Phase 5 wires the IDB backing.
 *
 * @since 0.1
 * @example
 *     // import { inMemoryStateStore } from "@invinite-org/chartlang-runtime";
 *     // const store = inMemoryStateStore();
 *     // store.set("slot#0", 42);
 *     // store.get<number>("slot#0"); // 42
 *     // store.clear();
 *     // store.has("slot#0"); // false
 */
export function inMemoryStateStore(): StateStore {
    const store = new Map<string, unknown>();
    return {
        get<T>(id: string): T | undefined {
            return store.get(id) as T | undefined;
        },
        set<T>(id: string, value: T): void {
            store.set(id, value);
        },
        has(id: string): boolean {
            return store.has(id);
        },
        clear(): void {
            store.clear();
        },
    };
}
