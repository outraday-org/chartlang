// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import "fake-indexeddb/auto";

import type { StateSnapshot, StateStoreKey, StreamSnapshot } from "@invinite-org/chartlang-core";
import { describe, expect, it } from "vitest";

import { idbStateStore } from "./idbStateStore.js";

// THRESHOLD_MS bounds one save + load for a representative 5,000-bar snapshot
// under `fake-indexeddb`. The shim is pure JS and lacks native browser IDB's
// storage engine optimisations, so this is a CPU-bound wall-clock guardrail.
// In isolation the save+load lands near 16ms; under the workspace `pnpm test`
// load (665 test files in parallel) the pure-JS shim spikes to ~80ms as it
// contends for CPU. 150ms keeps the gate green under that contention while
// still catching a ~9× regression.
const THRESHOLD_MS = 150;

// BUNDLE_THRESHOLD_MS extends the same guardrail to a bundle snapshot
// carrying 3 deps + 2 siblings on top of the 5,000-bar primary stream. The
// structured shape is roughly twice as large as the flat shape; pad the
// budget proportionally and keep the same ~9× regression-detection margin.
const BUNDLE_THRESHOLD_MS = 200;

function key(): StateStoreKey {
    return {
        scriptHash: "threshold-script",
        compilerVersion: "0.5.0",
        apiVersion: 1,
        capabilitiesHash: "threshold-capabilities",
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
        savedAt: Date.now(),
        snapshotVersion: 1,
        primary: { slots: { counter: 5_000 } },
    };
}

function bundleSnapshot(): StateSnapshot {
    const slots = (id: string): Readonly<Record<string, number>> => ({
        [`${id}/counter:state`]: 5_000,
        [`${id}/lookback:state`]: 4_999,
    });
    return {
        ...snapshot(),
        siblings: {
            slow: { slots: slots("export:slow") },
            medium: { slots: slots("export:medium") },
        },
        dependencies: {
            fast: { slots: slots("dep:fast") },
            base: { slots: slots("dep:base") },
            ema: { slots: slots("dep:ema") },
        },
    };
}

describe("idbStateStore threshold", () => {
    it(`saves and loads a 5,000-bar snapshot under ${THRESHOLD_MS}ms`, async () => {
        const store = idbStateStore({
            dbName: `chartlang-idb-threshold-${Date.now()}-${Math.random()}`,
            key: key(),
        });
        const snap = snapshot();

        const start = performance.now();
        await store.save(snap);
        await store.load();
        const elapsed = performance.now() - start;

        expect(elapsed).toBeLessThan(THRESHOLD_MS);
    });

    it(`saves and loads a 5,000-bar dep-bundle snapshot under ${BUNDLE_THRESHOLD_MS}ms`, async () => {
        const store = idbStateStore({
            dbName: `chartlang-idb-bundle-threshold-${Date.now()}-${Math.random()}`,
            key: key(),
        });
        const snap = bundleSnapshot();

        const start = performance.now();
        await store.save(snap);
        await store.load();
        const elapsed = performance.now() - start;

        expect(elapsed).toBeLessThan(BUNDLE_THRESHOLD_MS);
    });
});
