// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { expectTypeOf } from "expect-type";
import { describe, it } from "vitest";

import type { JsonValue } from "../types";
import type { StateSnapshot, StateStoreKey, StreamSnapshot } from "./snapshot";

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

const snapshot: StateSnapshot = {
    lastBarTime: 1_700_000_060_000,
    streams: { main: streamSnapshot },
    slots: { "script.ts:1:1#0": { previous: 101, seen: true } },
    savedAt: 1_700_000_120_000,
    snapshotVersion: 1,
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
        expectTypeOf(snapshot.slots).toMatchTypeOf<Readonly<Record<string, JsonValue>>>();
        expectTypeOf(snapshot.streams.main).toEqualTypeOf<StreamSnapshot>();
    });

    it("pins literal wire versions", () => {
        const invalidSnapshot = {
            lastBarTime: 1,
            streams: {},
            slots: {},
            savedAt: 2,
            // @ts-expect-error snapshotVersion 1 is the only supported wire version.
            snapshotVersion: 0,
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
            slots: { "script.ts:1:1#0": { current: 100.5 } },
            savedAt: 1_700_000_060_000,
            snapshotVersion: 1,
        } as const satisfies StateSnapshot;

        const readonlyKey = {
            ...key,
            requestedIntervals: ["1D", "1W"],
        } as const satisfies StateStoreKey;

        expectTypeOf(readonlySnapshot).toMatchTypeOf<StateSnapshot>();
        expectTypeOf(readonlyKey).toMatchTypeOf<StateStoreKey>();
    });
});
