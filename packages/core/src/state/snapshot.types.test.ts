// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { expectTypeOf } from "expect-type";
import { describe, it } from "vitest";

import type { JsonValue } from "../types.js";
import type { RunnerSnapshot, StateSnapshot, StateStoreKey, StreamSnapshot } from "./snapshot.js";

const streamSnapshot: StreamSnapshot = {
    interval: "1D",
    headIndex: 2,
    filled: 3,
    buffers: {
        time: [1_700_000_000_000, 1_700_000_060_000, null],
        open: [100, 101, null],
        high: [102, 103, null],
        low: [99, 100, null],
        close: [101, 102, null],
        volume: [10, 20, null],
    },
};

const runnerSnapshot: RunnerSnapshot = {
    slots: { "script.ts:1:1#0": { previous: 101, seen: true } },
};

const snapshot: StateSnapshot = {
    lastBarTime: 1_700_000_060_000,
    streams: { main: streamSnapshot },
    savedAt: 1_700_000_120_000,
    snapshotVersion: 1,
    primary: runnerSnapshot,
};

const fullSnapshot: StateSnapshot = {
    ...snapshot,
    siblings: { slow: { slots: { "slot:state": { committed: 1, tentative: 1 } } } },
    dependencies: { fast: { slots: { "dep:fast/slot:state": { committed: 2, tentative: 2 } } } },
};

const key: StateStoreKey = {
    scriptHash: "abc",
    compilerVersion: "0.5.0",
    apiVersion: 1,
    capabilitiesHash: "def",
    symbol: "BTCUSD",
    mainInterval: "1m",
    requestedIntervals: ["1D"],
};

describe("snapshot type surface", () => {
    it("keeps StateSnapshot structurally JSON-clean", () => {
        expectTypeOf(snapshot).toMatchTypeOf<JsonValue>();
        expectTypeOf(snapshot.primary.slots).toMatchTypeOf<Readonly<Record<string, JsonValue>>>();
        expectTypeOf(snapshot.streams.main).toEqualTypeOf<StreamSnapshot>();
    });

    it("keeps RunnerSnapshot structurally JSON-clean", () => {
        expectTypeOf(runnerSnapshot).toMatchTypeOf<JsonValue>();
        expectTypeOf(runnerSnapshot.slots).toMatchTypeOf<Readonly<Record<string, JsonValue>>>();
    });

    it("accepts the structured shape with all runner sections", () => {
        expectTypeOf(fullSnapshot).toMatchTypeOf<StateSnapshot>();
        expectTypeOf(fullSnapshot.siblings).toMatchTypeOf<
            Readonly<Record<string, RunnerSnapshot>> | undefined
        >();
        expectTypeOf(fullSnapshot.dependencies).toMatchTypeOf<
            Readonly<Record<string, RunnerSnapshot>> | undefined
        >();
    });

    it("pins literal wire versions", () => {
        const invalidSnapshot = {
            lastBarTime: 1,
            streams: {},
            savedAt: 2,
            // @ts-expect-error snapshotVersion 1 is the only supported wire version.
            snapshotVersion: 0,
            primary: { slots: {} },
        } satisfies StateSnapshot;

        const invalidKey = {
            scriptHash: "abc",
            compilerVersion: "0.5.0",
            // @ts-expect-error apiVersion 1 is the only supported script header version.
            apiVersion: 2,
            capabilitiesHash: "def",
            symbol: "BTCUSD",
            mainInterval: "1m",
            requestedIntervals: [],
        } satisfies StateStoreKey;

        void invalidSnapshot;
        void invalidKey;
    });

    it("rejects unknown stream buffer fields", () => {
        const invalidStream = {
            interval: "1D",
            headIndex: 0,
            filled: 0,
            buffers: {
                time: [],
                open: [],
                high: [],
                low: [],
                close: [],
                volume: [],
                // @ts-expect-error StreamSnapshot buffers are limited to canonical OHLCV keys.
                bogus: [],
            },
        } satisfies StreamSnapshot;

        void invalidStream;
    });

    it("accepts readonly literal snapshots", () => {
        const readonlyStream = {
            interval: "1D",
            headIndex: 0,
            filled: 1,
            buffers: {
                time: [1_700_000_000_000],
                open: [100],
                high: [101],
                low: [99],
                close: [100.5],
                volume: [10],
            },
        } as const satisfies StreamSnapshot;

        const readonlySnapshot = {
            lastBarTime: 1_700_000_000_000,
            streams: { main: readonlyStream },
            savedAt: 1_700_000_060_000,
            snapshotVersion: 1,
            primary: { slots: { "script.ts:1:1#0": { current: 100.5 } } },
        } as const satisfies StateSnapshot;

        const readonlyKey = {
            ...key,
            requestedIntervals: ["1D", "1W"],
        } as const satisfies StateStoreKey;

        expectTypeOf(readonlySnapshot).toMatchTypeOf<StateSnapshot>();
        expectTypeOf(readonlyKey).toMatchTypeOf<StateStoreKey>();
    });
});
