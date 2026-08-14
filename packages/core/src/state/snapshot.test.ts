// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { describe, expect, it } from "vitest";

import * as snapshotModule from "./snapshot.js";
import { stateStoreKeyId, stateStoreKeysEqual } from "./snapshot.js";
import type { RunnerSnapshot, StateSnapshot, StateStoreKey, StreamSnapshot } from "./snapshot.js";

function key(overrides: Partial<StateStoreKey> = {}): StateStoreKey {
    return {
        scriptHash: "abc",
        compilerVersion: "1.11.0",
        apiVersion: 1,
        capabilitiesHash: "def",
        symbol: "BTCUSD",
        mainInterval: "1m",
        requestedIntervals: ["1D"],
        ...overrides,
    };
}

describe("state snapshot type module", () => {
    it("carries only the key helpers as runtime surface", () => {
        let snapshot: StateSnapshot | undefined;
        let storeKey: StateStoreKey | undefined;
        let stream: StreamSnapshot | undefined;
        let runner: RunnerSnapshot | undefined;

        expect(Object.keys(snapshotModule).sort()).toEqual([
            "stateStoreKeyId",
            "stateStoreKeysEqual",
        ]);
        expect(snapshot).toBeUndefined();
        expect(storeKey).toBeUndefined();
        expect(stream).toBeUndefined();
        expect(runner).toBeUndefined();
    });
});

describe("stateStoreKeyId", () => {
    it("is insensitive to literal field order", () => {
        const reordered: StateStoreKey = {
            requestedIntervals: ["1D"],
            mainInterval: "1m",
            symbol: "BTCUSD",
            capabilitiesHash: "def",
            apiVersion: 1,
            compilerVersion: "1.11.0",
            scriptHash: "abc",
        };
        expect(stateStoreKeyId(reordered)).toBe(stateStoreKeyId(key()));
    });

    it("flattens requestedIntervals into a joined string", () => {
        expect(stateStoreKeyId(key({ requestedIntervals: ["1D", "1W"] }))).toContain('"1D,1W"');
    });

    it("changes when any single field changes", () => {
        const baseline = stateStoreKeyId(key());
        expect(stateStoreKeyId(key({ scriptHash: "zzz" }))).not.toBe(baseline);
        expect(stateStoreKeyId(key({ compilerVersion: "1.12.0" }))).not.toBe(baseline);
        expect(stateStoreKeyId(key({ capabilitiesHash: "ghi" }))).not.toBe(baseline);
        expect(stateStoreKeyId(key({ symbol: "ETHUSD" }))).not.toBe(baseline);
        expect(stateStoreKeyId(key({ mainInterval: "5m" }))).not.toBe(baseline);
        expect(stateStoreKeyId(key({ requestedIntervals: [] }))).not.toBe(baseline);
    });
});

describe("stateStoreKeysEqual", () => {
    it("treats two absent keys as a match", () => {
        expect(stateStoreKeysEqual(null, null)).toBe(true);
    });

    it("never matches an absent key against a present one", () => {
        expect(stateStoreKeysEqual(null, key())).toBe(false);
        expect(stateStoreKeysEqual(key(), null)).toBe(false);
    });

    it("matches structurally equal keys", () => {
        expect(stateStoreKeysEqual(key(), key())).toBe(true);
    });

    it("rejects a recompiled script's key", () => {
        expect(stateStoreKeysEqual(key(), key({ compilerVersion: "1.12.0" }))).toBe(false);
    });
});
