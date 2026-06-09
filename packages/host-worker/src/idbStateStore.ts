// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { StateSnapshot, StateStoreKey } from "@invinite-org/chartlang-core";
import type { PersistentStateStore } from "@invinite-org/chartlang-runtime";

const DEFAULT_DB_NAME = "chartlang";
const DEFAULT_CAP_BYTES = 50 * 1024 * 1024;
const OBJECT_STORE = "chartlangSnapshots";
const SAVED_AT_INDEX = "savedAt";

type StoredRecord = Readonly<{
    keyString: string;
    snapshot: StateSnapshot;
    bytesEstimate: number;
    savedAt: number;
}>;

const dbPromises = new Map<string, Promise<IDBDatabase>>();

/**
 * IDB-backed {@link PersistentStateStore}. One record per `StateStoreKey`,
 * capped at `capBytes` total with oldest-first eviction by `snapshot.savedAt`.
 * Reads on mount, writes on dispose + 60s cadence; the cadence is enforced by
 * the runtime, not the store. Identity-safe: `load()` returns `null` for any
 * non-matching key, and `clear()` deletes only this key's record.
 *
 * @since 0.5
 * @experimental
 * @example
 *     // import { idbStateStore } from "@invinite-org/chartlang-host-worker/idb";
 *     // const store = idbStateStore({ dbName: "chartlang", key });
 *     // await store.save(snapshot);
 */
export function idbStateStore(
    opts: Readonly<{
        key: StateStoreKey;
        dbName?: string;
        capBytes?: number;
    }>,
): PersistentStateStore {
    const dbName = opts.dbName ?? DEFAULT_DB_NAME;
    const capBytes = opts.capBytes ?? DEFAULT_CAP_BYTES;
    const keyString = stringifyKey(opts.key);

    return Object.freeze({
        key: opts.key,
        async load(): Promise<StateSnapshot | null> {
            const db = await openDb(dbName);
            const tx = db.transaction(OBJECT_STORE, "readonly");
            const done = transactionDone(tx);
            const value = await requestToPromise<unknown>(
                tx.objectStore(OBJECT_STORE).get(keyString),
            );
            await done;
            return isStoredRecord(value) ? value.snapshot : null;
        },
        async save(snapshot: StateSnapshot): Promise<void> {
            const db = await openDb(dbName);
            const tx = db.transaction(OBJECT_STORE, "readwrite");
            const done = transactionDone(tx);
            const store = tx.objectStore(OBJECT_STORE);
            const records = await readAllRecords(store);
            const nextBytes = estimateSnapshotBytes(snapshot);
            await evictUntilUnderCap(store, records, keyString, nextBytes, capBytes);
            await requestToPromise(
                store.put({
                    keyString,
                    snapshot,
                    bytesEstimate: nextBytes,
                    savedAt: snapshot.savedAt,
                }),
            );
            await done;
        },
        async clear(): Promise<void> {
            const db = await openDb(dbName);
            const tx = db.transaction(OBJECT_STORE, "readwrite");
            const done = transactionDone(tx);
            await requestToPromise(tx.objectStore(OBJECT_STORE).delete(keyString));
            await done;
        },
    });
}

/**
 * Stable cache-key serialisation for PLAN.md §6.9 `StateStoreKey`.
 *
 * @internal
 */
function stringifyKey(key: StateStoreKey): string {
    return JSON.stringify({
        scriptHash: key.scriptHash,
        compilerVersion: key.compilerVersion,
        apiVersion: key.apiVersion,
        capabilitiesHash: key.capabilitiesHash,
        symbol: key.symbol,
        mainInterval: key.mainInterval,
        requestedIntervals: key.requestedIntervals.join(","),
    });
}

/**
 * Lazy singleton IDB connection per database name.
 *
 * @internal
 */
function openDb(dbName: string): Promise<IDBDatabase> {
    const existing = dbPromises.get(dbName);
    if (existing !== undefined) return existing;

    const promise = new Promise<IDBDatabase>((resolve, reject) => {
        if (globalThis.indexedDB === undefined) {
            reject(new Error("indexedDB is not available"));
            return;
        }

        let request: IDBOpenDBRequest;
        try {
            request = globalThis.indexedDB.open(dbName, 1);
        } catch (error) {
            reject(toError(error, "indexedDB.open failed"));
            return;
        }

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(OBJECT_STORE)) {
                const store = db.createObjectStore(OBJECT_STORE, { keyPath: "keyString" });
                store.createIndex(SAVED_AT_INDEX, "savedAt");
            }
        };
        request.onerror = () => {
            reject(toError(request.error, "indexedDB.open failed"));
        };
        request.onblocked = () => {
            reject(new Error(`indexedDB.open blocked for database "${dbName}"`));
        };
        request.onsuccess = () => {
            const db = request.result;
            // Drop the cached promise if the connection is closed or another
            // tab requests a version upgrade, so the next openDb() reopens a
            // valid connection instead of reusing a dead IDBDatabase.
            const evict = (): void => {
                if (dbPromises.get(dbName) === promise) dbPromises.delete(dbName);
            };
            db.onclose = evict;
            db.onversionchange = () => {
                db.close();
                evict();
            };
            resolve(db);
        };
    });

    promise.catch(() => {
        if (dbPromises.get(dbName) === promise) dbPromises.delete(dbName);
    });
    dbPromises.set(dbName, promise);
    return promise;
}

/**
 * Promise wrapper for one IDB request.
 *
 * @internal
 */
function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        request.onerror = () => {
            reject(toError(request.error, "IndexedDB request failed"));
        };
        request.onsuccess = () => {
            resolve(request.result);
        };
    });
}

/**
 * Resolves only when the whole IDB transaction completes.
 *
 * @internal
 */
function transactionDone(tx: IDBTransaction): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        tx.onabort = () => {
            reject(toError(tx.error, "IndexedDB transaction aborted"));
        };
        tx.onerror = () => {
            reject(toError(tx.error, "IndexedDB transaction failed"));
        };
        tx.oncomplete = () => {
            resolve();
        };
    });
}

/**
 * Reads all well-formed snapshot records from the store.
 *
 * @internal
 */
function readAllRecords(store: IDBObjectStore): Promise<ReadonlyArray<StoredRecord>> {
    return new Promise<ReadonlyArray<StoredRecord>>((resolve, reject) => {
        const records: StoredRecord[] = [];
        const request = store.index(SAVED_AT_INDEX).openCursor();
        request.onerror = () => {
            reject(toError(request.error, "IndexedDB cursor failed"));
        };
        request.onsuccess = () => {
            const cursor = request.result;
            if (cursor === null) {
                resolve(records);
                return;
            }
            if (isStoredRecord(cursor.value)) records.push(cursor.value);
            cursor.continue();
        };
    });
}

/**
 * Evicts savedAt-ascending records until the pending write fits the cap.
 *
 * @internal
 */
async function evictUntilUnderCap(
    store: IDBObjectStore,
    records: ReadonlyArray<StoredRecord>,
    keyString: string,
    nextBytes: number,
    capBytes: number,
): Promise<void> {
    let total = 0;
    const candidates: StoredRecord[] = [];
    for (const record of records) {
        if (record.keyString === keyString) continue;
        total += record.bytesEstimate;
        candidates.push(record);
    }
    candidates.sort((a, b) => a.savedAt - b.savedAt);

    for (const record of candidates) {
        if (total + nextBytes <= capBytes) return;
        await requestToPromise(store.delete(record.keyString));
        total -= record.bytesEstimate;
    }
}

/**
 * UTF-16 byte estimate used for best-effort cap accounting.
 *
 * @internal
 */
function estimateSnapshotBytes(snapshot: StateSnapshot): number {
    return JSON.stringify(snapshot).length * 2;
}

/**
 * Narrows records read from IDB's untyped structured-clone surface.
 *
 * @internal
 */
function isStoredRecord(value: unknown): value is StoredRecord {
    if (typeof value !== "object" || value === null) return false;
    if (!("keyString" in value) || typeof value.keyString !== "string") return false;
    if (!("bytesEstimate" in value) || typeof value.bytesEstimate !== "number") return false;
    if (!("savedAt" in value) || typeof value.savedAt !== "number") return false;
    if (!("snapshot" in value)) return false;
    return true;
}

/**
 * Preserves underlying IDB messages on rejection paths.
 *
 * @internal
 */
function toError(value: unknown, fallback: string): Error {
    if (value instanceof DOMException) return new Error(value.message);
    if (value instanceof Error) return value;
    if (typeof value === "string") return new Error(value);
    return new Error(fallback);
}
