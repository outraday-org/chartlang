// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { JsonValue } from "../types";

/**
 * Per-stream snapshot captured during state persistence.
 *
 * Carries everything needed to rehydrate a ring buffer for one timeframe,
 * whether that stream is the main interval or a higher-timeframe secondary
 * stream (PLAN.md §6.1, §6.9).
 *
 * `buffers` is keyed by the canonical OHLCV field names; each value is a
 * JSON-clean array of `number | null`, where `null` preserves NaN holes
 * through `JSON.stringify`. `headIndex` and `filled` mirror the ring-buffer's
 * internal state at snapshot time.
 *
 * @since 0.5
 * @experimental
 * @example
 *     const s: StreamSnapshot = {
 *         interval: "1D",
 *         headIndex: 4999,
 *         filled: 5000,
 *         buffers: { time: [], open: [], high: [], low: [], close: [], volume: [] },
 *     };
 *     void s;
 */
export type StreamSnapshot = Readonly<{
    interval: string;
    headIndex: number;
    filled: number;
    buffers: Readonly<{
        time: ReadonlyArray<number | null>;
        open: ReadonlyArray<number | null>;
        high: ReadonlyArray<number | null>;
        low: ReadonlyArray<number | null>;
        close: ReadonlyArray<number | null>;
        volume: ReadonlyArray<number | null>;
    }>;
}>;

/**
 * Canonical persistent-store snapshot.
 *
 * Written on `dispose()` and on every `kind: "close"` event when stale for
 * at least 60 seconds (PLAN.md §6.9). `slots` carries every stateful
 * primitive's per-callsite payload keyed by the compiler-injected slot id
 * (PLAN.md §5.5). Each value is `JsonValue`; primitive authors with non-JSON
 * internal state register serialisation hooks in the runtime layer.
 *
 * `snapshotVersion: 1` is the only currently-supported wire version. A future
 * schema change must bump this literal so the runtime can drop snapshots with
 * mismatched versions on load.
 *
 * @since 0.5
 * @experimental
 * @example
 *     const s: StateSnapshot = {
 *         lastBarTime: 1_700_000_000_000,
 *         streams: {},
 *         slots: {},
 *         savedAt: 1_700_000_060_000,
 *         snapshotVersion: 1,
 *     };
 *     void s;
 */
export type StateSnapshot = Readonly<{
    lastBarTime: number;
    streams: Readonly<Record<string, StreamSnapshot>>;
    slots: Readonly<Record<string, JsonValue>>;
    savedAt: number;
    snapshotVersion: 1;
}>;

/**
 * Canonical persistent-store identity tuple.
 *
 * Every field contributes to the cache key; any change invalidates the
 * snapshot (PLAN.md §6.9). Stores treat this tuple opaquely as a string key;
 * the typical implementation is `JSON.stringify(key)` with sorted fields.
 *
 * - `scriptHash` is the SHA-256 digest of the compiled `moduleSource`.
 * - `compilerVersion` is the package version of `@invinite-org/chartlang-compiler`.
 * - `apiVersion` is the script header pin, currently `1`.
 * - `capabilitiesHash` is the SHA-256 digest of normalised adapter capabilities.
 * - `symbol` is the adapter's loaded ticker.
 * - `mainInterval` is the primary stream interval.
 * - `requestedIntervals` is the frozen array of secondary stream intervals.
 *
 * @since 0.5
 * @experimental
 * @example
 *     const k: StateStoreKey = {
 *         scriptHash: "abc",
 *         compilerVersion: "0.5.0",
 *         apiVersion: 1,
 *         capabilitiesHash: "def",
 *         symbol: "BTCUSD",
 *         mainInterval: "1m",
 *         requestedIntervals: [],
 *     };
 *     void k;
 */
export type StateStoreKey = Readonly<{
    scriptHash: string;
    compilerVersion: string;
    apiVersion: 1;
    capabilitiesHash: string;
    symbol: string;
    mainInterval: string;
    requestedIntervals: ReadonlyArray<string>;
}>;
