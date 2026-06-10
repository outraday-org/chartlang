// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import "fake-indexeddb/auto";

import type { StateSnapshot, StateStoreKey, StreamSnapshot } from "@invinite-org/chartlang-core";
import { bench, describe } from "vitest";

import { idbStateStore } from "./idbStateStore.js";

function key(): StateStoreKey {
    return {
        scriptHash: "bench-script",
        compilerVersion: "0.5.0",
        apiVersion: 1,
        capabilitiesHash: "bench-capabilities",
        symbol: "BTCUSD",
        mainInterval: "1m",
        requestedIntervals: [],
    };
}

function stream(): StreamSnapshot {
    return {
        interval: "1m",
        headIndex: 4_999,
        filled: 5_000,
        buffers: {
            time: Array.from({ length: 5_000 }, (_, index) => index),
            open: Array.from({ length: 5_000 }, (_, index) => 100 + index),
            high: Array.from({ length: 5_000 }, (_, index) => 101 + index),
            low: Array.from({ length: 5_000 }, (_, index) => 99 + index),
            close: Array.from({ length: 5_000 }, (_, index) => 100.5 + index),
            volume: Array.from({ length: 5_000 }, (_, index) => 1_000 + index),
        },
    };
}

function snapshot(): StateSnapshot {
    return {
        lastBarTime: 5_000,
        streams: { "1m": stream() },
        slots: { counter: 5_000 },
        savedAt: Date.now(),
        snapshotVersion: 1,
    };
}

describe("idbStateStore", () => {
    bench("save + load 5,000-bar snapshot", async () => {
        const store = idbStateStore({
            dbName: `chartlang-idb-bench-${Date.now()}-${Math.random()}`,
            key: key(),
        });
        const snap = snapshot();
        await store.save(snap);
        await store.load();
    });
});
