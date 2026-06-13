// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { JsonValue } from "../types.js";

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
 * @stable
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
 * Per-runner persistence section. Carries one runner's `state.*`
 * (and primary-only TA) slot map keyed by `${slotIdPrefix}${slotId}:state`
 * (PLAN.md §5.5 + Task 5). `slots` is `JsonValue` so the snapshot
 * round-trips through `JSON.stringify` and structured-clone.
 *
 * Used inside {@link StateSnapshot} for `primary`,
 * `siblings[exportName]`, and `dependencies[localId]` sections —
 * one section per runner mounted by a `CompiledScriptBundle`.
 *
 * @since 0.7
 * @stable
 * @example
 *     const r: RunnerSnapshot = {
 *         slots: { "x:state": { committed: 1, tentative: 1 } },
 *     };
 *     void r;
 */
export type RunnerSnapshot = Readonly<{
    slots: Readonly<Record<string, JsonValue>>;
}>;

/**
 * Canonical persistent-store snapshot.
 *
 * Written on `dispose()` and on every `kind: "close"` event when stale for
 * at least 60 seconds (PLAN.md §6.9). Each runner's `state.*` payload is
 * keyed by the compiler-injected slot id with the runner's
 * `slotIdPrefix` prepended (PLAN.md §5.5 + Task 5). Primary-runner TA
 * slots live in `primary.slots` alongside `state.*` slots (the bundle's
 * deps + siblings share the primary's mainStream, so TA slots have no
 * per-runner section).
 *
 * `snapshotVersion: 1` is the only currently-supported wire version.
 * The 0.7 widening is additive — the runtime validator accepts both the
 * legacy flat `slots:` shape (loaded as primary-only) and the structured
 * `primary` / `siblings?` / `dependencies?` shape (always written going
 * forward).
 *
 * @since 0.5 — widened to per-runner sections in 0.7
 * @stable
 * @example
 *     const s: StateSnapshot = {
 *         lastBarTime: 1_700_000_000_000,
 *         streams: {},
 *         savedAt: 1_700_000_060_000,
 *         snapshotVersion: 1,
 *         primary: { slots: {} },
 *     };
 *     void s;
 */
export type StateSnapshot = Readonly<{
    lastBarTime: number;
    streams: Readonly<Record<string, StreamSnapshot>>;
    savedAt: number;
    snapshotVersion: 1;
    primary: RunnerSnapshot;
    siblings?: Readonly<Record<string, RunnerSnapshot>>;
    dependencies?: Readonly<Record<string, RunnerSnapshot>>;
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
 * @stable
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
