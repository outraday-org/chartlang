// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { StateSnapshot, StateStoreKey } from "@invinite-org/chartlang-core";

/**
 * Cross-mount snapshot store per PLAN §6.9. Sits beside the Phase-1
 * slot `StateStore`: primitives still read/write slot state through
 * the slot store; the persistent store captures and restores the
 * whole snapshot on mount/dispose boundaries.
 *
 * Implementations include {@link inMemoryPersistentStateStore} for
 * tests, `idbStateStore` for browsers, and caller-supplied stores for
 * servers.
 *
 * @since 0.5
 * @stable
 * @example
 *     // import type { PersistentStateStore }
 *     //     from "@invinite-org/chartlang-runtime";
 *     // const store: PersistentStateStore = inMemoryPersistentStateStore({ key });
 */
export type PersistentStateStore = {
    readonly key: StateStoreKey;
    load(): Promise<StateSnapshot | null>;
    save(snapshot: StateSnapshot): Promise<void>;
    clear(): Promise<void>;
};

/**
 * In-process persistent store with one last-write-wins snapshot.
 *
 * @since 0.5
 * @stable
 * @example
 *     // import { inMemoryPersistentStateStore }
 *     //     from "@invinite-org/chartlang-runtime";
 *     // const store = inMemoryPersistentStateStore({ key });
 *     // await store.save(snapshot);
 *     // await store.load(); // snapshot
 */
export function inMemoryPersistentStateStore(
    opts: Readonly<{ key: StateStoreKey }>,
): PersistentStateStore {
    let current: StateSnapshot | null = null;
    return Object.freeze({
        key: opts.key,
        async load(): Promise<StateSnapshot | null> {
            return current;
        },
        async save(snapshot: StateSnapshot): Promise<void> {
            current = snapshot;
        },
        async clear(): Promise<void> {
            current = null;
        },
    });
}
