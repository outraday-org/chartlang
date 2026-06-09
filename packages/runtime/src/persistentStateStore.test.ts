// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { StateSnapshot, StateStoreKey } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { inMemoryPersistentStateStore } from "./persistentStateStore";

const key: StateStoreKey = {
    scriptHash: "script",
    compilerVersion: "0.5.0",
    apiVersion: 1,
    capabilitiesHash: "caps",
    symbol: "AAPL",
    mainInterval: "1m",
    requestedIntervals: [],
};

const snapshot: StateSnapshot = {
    lastBarTime: 1_700_000_000_000,
    streams: {
        "1m": {
            interval: "1m",
            headIndex: 1,
            filled: 2,
            buffers: {
                time: [1, 2],
                open: [10, 11],
                high: [12, 13],
                low: [9, 10],
                close: [11, 12],
                volume: [100, 101],
            },
        },
        "1D": {
            interval: "1D",
            headIndex: -1,
            filled: 0,
            buffers: { time: [], open: [], high: [], low: [], close: [], volume: [] },
        },
    },
    slots: {},
    savedAt: 1_700_000_060_000,
    snapshotVersion: 1,
};

describe("inMemoryPersistentStateStore", () => {
    it("loads null before the first save", async () => {
        const store = inMemoryPersistentStateStore({ key });
        expect(await store.load()).toBeNull();
    });

    it("returns the last saved snapshot and preserves the frozen key", async () => {
        const store = inMemoryPersistentStateStore({ key });
        await store.save(snapshot);
        expect(await store.load()).toEqual(snapshot);
        expect(Object.isFrozen(store)).toBe(true);
        expect(store.key).toBe(key);
    });

    it("clear resets the saved snapshot to null", async () => {
        const store = inMemoryPersistentStateStore({ key });
        await store.save(snapshot);
        await store.clear();
        expect(await store.load()).toBeNull();
    });
});
