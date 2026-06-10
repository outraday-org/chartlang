// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import "fake-indexeddb/auto";

import type { StateSnapshot, StateStoreKey } from "@invinite-org/chartlang-core";
import { afterEach, describe, expect, it } from "vitest";

import * as idbEntry from "./idb.js";
import { idbStateStore } from "./idbStateStore.js";

const originalIndexedDb = globalThis.indexedDB;

type MutableRequest<T> = {
    error: unknown;
    result: T;
    onblocked: (() => void) | null;
    onerror: (() => void) | null;
    onsuccess: (() => void) | null;
    onupgradeneeded: (() => void) | null;
};

type MutableTransaction = {
    error: unknown;
    onabort: (() => void) | null;
    oncomplete: (() => void) | null;
    onerror: (() => void) | null;
    objectStore(): {
        delete(_key: string): MutableRequest<undefined>;
        get(_key: string): MutableRequest<undefined>;
        index(_name: string): { openCursor(): MutableRequest<undefined> };
        openCursor(): MutableRequest<undefined>;
        put(_value: unknown): MutableRequest<undefined>;
    };
};

function key(id: string): StateStoreKey {
    return {
        scriptHash: `script-${id}`,
        compilerVersion: "0.5.0",
        apiVersion: 1,
        capabilitiesHash: "capabilities",
        symbol: "BTCUSD",
        mainInterval: "1m",
        requestedIntervals: ["5m", "1D"],
    };
}

function snapshot(savedAt: number, payload = "payload"): StateSnapshot {
    return {
        lastBarTime: savedAt - 1_000,
        streams: {
            "1m": {
                interval: "1m",
                headIndex: 2,
                filled: 3,
                buffers: {
                    time: [1, 2, 3],
                    open: [10, 11, 12],
                    high: [11, 12, 13],
                    low: [9, 10, 11],
                    close: [10.5, 11.5, 12.5],
                    volume: [100, 110, 120],
                },
            },
        },
        slots: { payload },
        savedAt,
        snapshotVersion: 1,
    };
}

function dbName(name: string): string {
    return `chartlang-idb-state-store-${name}-${Date.now()}-${Math.random()}`;
}

function estimateBytes(snap: StateSnapshot): number {
    return JSON.stringify(snap).length * 2;
}

function stringifyKeyForTest(value: StateStoreKey): string {
    return JSON.stringify({
        scriptHash: value.scriptHash,
        compilerVersion: value.compilerVersion,
        apiVersion: value.apiVersion,
        capabilitiesHash: value.capabilitiesHash,
        symbol: value.symbol,
        mainInterval: value.mainInterval,
        requestedIntervals: value.requestedIntervals.join(","),
    });
}

async function putRawRecord(dbNameValue: string, value: unknown): Promise<void> {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(dbNameValue, 1);
        request.onupgradeneeded = () => {
            const store = request.result.createObjectStore("chartlangSnapshots", {
                keyPath: "keyString",
            });
            store.createIndex("savedAt", "savedAt");
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("chartlangSnapshots", "readwrite");
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
        tx.oncomplete = () => resolve();
        tx.objectStore("chartlangSnapshots").put(value);
    });
    db.close();
}

function installTransactionFailure(kind: "abort" | "error", error: unknown): void {
    const tx: MutableTransaction = {
        error,
        onabort: null,
        oncomplete: null,
        onerror: null,
        objectStore() {
            return {
                delete() {
                    const request: MutableRequest<undefined> = {
                        error: null,
                        result: undefined,
                        onblocked: null,
                        onerror: null,
                        onsuccess: null,
                        onupgradeneeded: null,
                    };
                    setTimeout(() => {
                        if (request.onsuccess !== null) request.onsuccess();
                        if (kind === "abort" && tx.onabort !== null) tx.onabort();
                        if (kind === "error" && tx.onerror !== null) tx.onerror();
                    }, 0);
                    return request;
                },
                get() {
                    const request: MutableRequest<undefined> = {
                        error: null,
                        result: undefined,
                        onblocked: null,
                        onerror: null,
                        onsuccess: null,
                        onupgradeneeded: null,
                    };
                    return request;
                },
                index() {
                    return {
                        openCursor() {
                            const request: MutableRequest<undefined> = {
                                error: null,
                                result: undefined,
                                onblocked: null,
                                onerror: null,
                                onsuccess: null,
                                onupgradeneeded: null,
                            };
                            return request;
                        },
                    };
                },
                openCursor() {
                    const request: MutableRequest<undefined> = {
                        error: null,
                        result: undefined,
                        onblocked: null,
                        onerror: null,
                        onsuccess: null,
                        onupgradeneeded: null,
                    };
                    return request;
                },
                put() {
                    const request: MutableRequest<undefined> = {
                        error: null,
                        result: undefined,
                        onblocked: null,
                        onerror: null,
                        onsuccess: null,
                        onupgradeneeded: null,
                    };
                    return request;
                },
            };
        },
    };
    const openRequest: MutableRequest<{ transaction(): MutableTransaction }> = {
        error: null,
        result: {
            transaction() {
                return tx;
            },
        },
        onblocked: null,
        onerror: null,
        onsuccess: null,
        onupgradeneeded: null,
    };
    Object.defineProperty(globalThis, "indexedDB", {
        configurable: true,
        value: {
            open() {
                setTimeout(() => {
                    if (openRequest.onsuccess !== null) openRequest.onsuccess();
                }, 0);
                return openRequest;
            },
        },
    });
}

function installDeleteRequestFailure(error: unknown): void {
    const tx: MutableTransaction = {
        error: null,
        onabort: null,
        oncomplete: null,
        onerror: null,
        objectStore() {
            return {
                delete() {
                    const request: MutableRequest<undefined> = {
                        error,
                        result: undefined,
                        onblocked: null,
                        onerror: null,
                        onsuccess: null,
                        onupgradeneeded: null,
                    };
                    setTimeout(() => {
                        if (request.onerror !== null) request.onerror();
                    }, 0);
                    return request;
                },
                get() {
                    const request: MutableRequest<undefined> = {
                        error: null,
                        result: undefined,
                        onblocked: null,
                        onerror: null,
                        onsuccess: null,
                        onupgradeneeded: null,
                    };
                    return request;
                },
                index() {
                    return {
                        openCursor() {
                            const request: MutableRequest<undefined> = {
                                error: null,
                                result: undefined,
                                onblocked: null,
                                onerror: null,
                                onsuccess: null,
                                onupgradeneeded: null,
                            };
                            return request;
                        },
                    };
                },
                openCursor() {
                    const request: MutableRequest<undefined> = {
                        error: null,
                        result: undefined,
                        onblocked: null,
                        onerror: null,
                        onsuccess: null,
                        onupgradeneeded: null,
                    };
                    return request;
                },
                put() {
                    const request: MutableRequest<undefined> = {
                        error: null,
                        result: undefined,
                        onblocked: null,
                        onerror: null,
                        onsuccess: null,
                        onupgradeneeded: null,
                    };
                    return request;
                },
            };
        },
    };
    const openRequest: MutableRequest<{ transaction(): MutableTransaction }> = {
        error: null,
        result: {
            transaction() {
                return tx;
            },
        },
        onblocked: null,
        onerror: null,
        onsuccess: null,
        onupgradeneeded: null,
    };
    Object.defineProperty(globalThis, "indexedDB", {
        configurable: true,
        value: {
            open() {
                setTimeout(() => {
                    if (openRequest.onsuccess !== null) openRequest.onsuccess();
                }, 0);
                return openRequest;
            },
        },
    });
}

afterEach(() => {
    Object.defineProperty(globalThis, "indexedDB", {
        configurable: true,
        value: originalIndexedDb,
    });
});

describe("idbStateStore", () => {
    it("re-exports from the idb subpath entry", () => {
        expect(idbEntry.idbStateStore).toBe(idbStateStore);
    });

    it("uses the default database name when dbName is omitted", async () => {
        const store = idbStateStore({ key: key(`default-${Date.now()}-${Math.random()}`) });
        const snap = snapshot(1_000);
        await store.save(snap);
        await expect(store.load()).resolves.toEqual(snap);
    });

    it("returns null for a fresh key", async () => {
        const store = idbStateStore({ dbName: dbName("fresh"), key: key("fresh") });
        await expect(store.load()).resolves.toBeNull();
    });

    it("round-trips a saved snapshot", async () => {
        const store = idbStateStore({ dbName: dbName("round-trip"), key: key("round-trip") });
        const snap = snapshot(1_000);
        await store.save(snap);
        await expect(store.load()).resolves.toEqual(snap);
    });

    it("keeps the last write for a key", async () => {
        const store = idbStateStore({ dbName: dbName("last-write"), key: key("last-write") });
        const first = snapshot(1_000, "first");
        const second = snapshot(2_000, "second");
        await store.save(first);
        await store.save(second);
        await expect(store.load()).resolves.toEqual(second);
    });

    it("evicts the cached connection on versionchange so a later upgrade is not blocked", async () => {
        const name = dbName("versionchange");
        const store = idbStateStore({ dbName: name, key: key("vc") });
        await store.save(snapshot(1_000));

        // A second connection opening at a higher version fires `versionchange`
        // on the cached v1 connection. The store's handler must close it;
        // otherwise this upgrade stays blocked forever.
        const upgraded = await new Promise<boolean>((resolve, reject) => {
            const request = globalThis.indexedDB.open(name, 2);
            request.onblocked = () => {
                reject(new Error("versionchange handler did not close the cached connection"));
            };
            request.onsuccess = () => {
                request.result.close();
                resolve(true);
            };
            request.onerror = () => reject(request.error);
        });
        expect(upgraded).toBe(true);
    });

    it("clears only the configured key", async () => {
        const name = dbName("clear");
        const first = idbStateStore({ dbName: name, key: key("clear-a") });
        const second = idbStateStore({ dbName: name, key: key("clear-b") });
        const firstSnap = snapshot(1_000, "first");
        const secondSnap = snapshot(2_000, "second");
        await first.save(firstSnap);
        await second.save(secondSnap);

        await first.clear();

        await expect(first.load()).resolves.toBeNull();
        await expect(second.load()).resolves.toEqual(secondSnap);
    });

    it("isolates distinct StateStoreKey records", async () => {
        const name = dbName("isolation");
        const first = idbStateStore({ dbName: name, key: key("isolation-a") });
        const second = idbStateStore({ dbName: name, key: key("isolation-b") });
        const firstSnap = snapshot(1_000, "first");
        await first.save(firstSnap);

        await expect(first.load()).resolves.toEqual(firstSnap);
        await expect(second.load()).resolves.toBeNull();
    });

    it("treats malformed records for the key as absent", async () => {
        const name = dbName("malformed");
        const storeKey = key("malformed");
        const store = idbStateStore({ dbName: name, key: storeKey });
        await putRawRecord(name, {
            keyString: stringifyKeyForTest(storeKey),
            bytesEstimate: "nope",
            savedAt: 1_000,
            snapshot: snapshot(1_000),
        });

        await expect(store.load()).resolves.toBeNull();
    });

    it("ignores malformed records while scanning for eviction candidates", async () => {
        const name = dbName("malformed-cursor");
        await putRawRecord(name, {
            keyString: 123,
            bytesEstimate: 10,
            savedAt: 1_000,
            snapshot: snapshot(1_000),
        });
        await putRawRecord(name, {
            keyString: "bad-saved-at",
            bytesEstimate: 10,
            savedAt: "nope",
            snapshot: snapshot(2_000),
        });
        await putRawRecord(name, {
            keyString: "missing-snapshot",
            bytesEstimate: 10,
            savedAt: 3_000,
        });
        const store = idbStateStore({ dbName: name, key: key("malformed-cursor") });
        const snap = snapshot(4_000);

        await store.save(snap);

        await expect(store.load()).resolves.toEqual(snap);
    });

    it("evicts oldest snapshots by savedAt when the cap is exceeded", async () => {
        const name = dbName("eviction");
        const payload = "x".repeat(320);
        const firstSnap = snapshot(1_000, payload);
        const secondSnap = snapshot(2_000, payload);
        const thirdSnap = snapshot(3_000, payload);
        const capBytes = estimateBytes(thirdSnap) + 10;
        const first = idbStateStore({ dbName: name, key: key("eviction-a"), capBytes });
        const second = idbStateStore({ dbName: name, key: key("eviction-b"), capBytes });
        const third = idbStateStore({ dbName: name, key: key("eviction-c"), capBytes });

        await first.save(firstSnap);
        await second.save(secondSnap);
        await third.save(thirdSnap);

        await expect(first.load()).resolves.toBeNull();
        await expect(second.load()).resolves.toBeNull();
        await expect(third.load()).resolves.toEqual(thirdSnap);
    });

    it("handles simultaneous saves without corrupting the record", async () => {
        const store = idbStateStore({ dbName: dbName("concurrent"), key: key("concurrent") });
        const snapshots = Array.from({ length: 5 }, (_, index) =>
            snapshot(1_000 + index, `payload-${index}`),
        );

        await Promise.all(snapshots.map((snap) => store.save(snap)));

        const loaded = await store.load();
        expect(snapshots).toContainEqual(loaded);
    });

    it("rejects load and save when opening IndexedDB fails", async () => {
        const request: MutableRequest<undefined> = {
            error: new Error("async open failed"),
            result: undefined,
            onblocked: null,
            onerror: null,
            onsuccess: null,
            onupgradeneeded: null,
        };
        Object.defineProperty(globalThis, "indexedDB", {
            configurable: true,
            value: {
                open() {
                    setTimeout(() => {
                        if (request.onerror !== null) request.onerror();
                    }, 0);
                    return request;
                },
            },
        });

        const failingLoad = idbStateStore({
            dbName: dbName("open-failure-load"),
            key: key("load"),
        });
        const failingSave = idbStateStore({
            dbName: dbName("open-failure-save"),
            key: key("save"),
        });

        await expect(failingLoad.load()).rejects.toThrow("async open failed");
        await expect(failingSave.save(snapshot(1_000))).rejects.toThrow("async open failed");
    });

    it("rejects when IndexedDB is unavailable", async () => {
        Object.defineProperty(globalThis, "indexedDB", {
            configurable: true,
            value: undefined,
        });

        const store = idbStateStore({ dbName: dbName("unavailable"), key: key("unavailable") });

        await expect(store.load()).rejects.toThrow("indexedDB is not available");
    });

    it("rejects when IndexedDB open throws synchronously", async () => {
        Object.defineProperty(globalThis, "indexedDB", {
            configurable: true,
            value: {
                open() {
                    throw new Error("sync open failed");
                },
            },
        });

        const store = idbStateStore({ dbName: dbName("sync-open"), key: key("sync-open") });

        await expect(store.load()).rejects.toThrow("sync open failed");
    });

    it("rejects when opening IndexedDB is blocked", async () => {
        const request: MutableRequest<undefined> = {
            error: null,
            result: undefined,
            onblocked: null,
            onerror: null,
            onsuccess: null,
            onupgradeneeded: null,
        };
        Object.defineProperty(globalThis, "indexedDB", {
            configurable: true,
            value: {
                open() {
                    setTimeout(() => {
                        if (request.onblocked !== null) request.onblocked();
                    }, 0);
                    return request;
                },
            },
        });

        const store = idbStateStore({ dbName: dbName("blocked-open"), key: key("blocked") });

        await expect(store.load()).rejects.toThrow("indexedDB.open blocked");
    });

    it("preserves non-Error open failure messages", async () => {
        const request: MutableRequest<undefined> = {
            error: "string open failed",
            result: undefined,
            onblocked: null,
            onerror: null,
            onsuccess: null,
            onupgradeneeded: null,
        };
        Object.defineProperty(globalThis, "indexedDB", {
            configurable: true,
            value: {
                open() {
                    setTimeout(() => {
                        if (request.onerror !== null) request.onerror();
                    }, 0);
                    return request;
                },
            },
        });

        const store = idbStateStore({ dbName: dbName("string-open-failure"), key: key("string") });

        await expect(store.load()).rejects.toThrow("string open failed");
    });

    it("uses a fallback message for unknown open failures", async () => {
        const request: MutableRequest<undefined> = {
            error: undefined,
            result: undefined,
            onblocked: null,
            onerror: null,
            onsuccess: null,
            onupgradeneeded: null,
        };
        Object.defineProperty(globalThis, "indexedDB", {
            configurable: true,
            value: {
                open() {
                    setTimeout(() => {
                        if (request.onerror !== null) request.onerror();
                    }, 0);
                    return request;
                },
            },
        });

        const store = idbStateStore({
            dbName: dbName("unknown-open-failure"),
            key: key("unknown"),
        });

        await expect(store.load()).rejects.toThrow("indexedDB.open failed");
    });

    it("rejects when a save cursor fails", async () => {
        const cursorRequest: MutableRequest<undefined> = {
            error: new DOMException("cursor failed"),
            result: undefined,
            onblocked: null,
            onerror: null,
            onsuccess: null,
            onupgradeneeded: null,
        };
        const tx: {
            error: unknown;
            onabort: (() => void) | null;
            oncomplete: (() => void) | null;
            onerror: (() => void) | null;
            objectStore(): { index(_name: string): { openCursor(): MutableRequest<undefined> } };
        } = {
            error: null,
            onabort: null,
            oncomplete: null,
            onerror: null,
            objectStore() {
                return {
                    index() {
                        return {
                            openCursor() {
                                setTimeout(() => {
                                    if (cursorRequest.onerror !== null) cursorRequest.onerror();
                                }, 0);
                                return cursorRequest;
                            },
                        };
                    },
                };
            },
        };
        const openRequest: MutableRequest<{ transaction(): typeof tx }> = {
            error: null,
            result: {
                transaction() {
                    return tx;
                },
            },
            onblocked: null,
            onerror: null,
            onsuccess: null,
            onupgradeneeded: null,
        };
        Object.defineProperty(globalThis, "indexedDB", {
            configurable: true,
            value: {
                open() {
                    setTimeout(() => {
                        if (openRequest.onsuccess !== null) openRequest.onsuccess();
                    }, 0);
                    return openRequest;
                },
            },
        });

        const store = idbStateStore({ dbName: dbName("cursor-failure"), key: key("cursor") });

        await expect(store.save(snapshot(1_000))).rejects.toThrow("cursor failed");
    });

    it("rejects when a transaction aborts", async () => {
        installTransactionFailure("abort", new Error("transaction aborted"));
        const store = idbStateStore({ dbName: dbName("tx-abort"), key: key("tx-abort") });

        await expect(store.clear()).rejects.toThrow("transaction aborted");
    });

    it("rejects when a transaction errors", async () => {
        installTransactionFailure("error", new Error("transaction errored"));
        const store = idbStateStore({ dbName: dbName("tx-error"), key: key("tx-error") });

        await expect(store.clear()).rejects.toThrow("transaction errored");
    });

    it("rejects when an IDB request errors", async () => {
        installDeleteRequestFailure(new Error("delete failed"));
        const store = idbStateStore({ dbName: dbName("delete-error"), key: key("delete-error") });

        await expect(store.clear()).rejects.toThrow("delete failed");
    });
});
