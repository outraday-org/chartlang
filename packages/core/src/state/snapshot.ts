// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { OrderPosition } from "../order/order.js";
import type { JsonValue } from "../types.js";

/**
 * Per-stream snapshot captured during state persistence.
 *
 * Carries everything needed to rehydrate a ring buffer for one timeframe,
 * whether that stream is the main interval or a higher-timeframe secondary
 * stream.
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
 * (Task 5). `slots` is `JsonValue` so the snapshot
 * round-trips through `JSON.stringify` and structured-clone.
 *
 * Used inside {@link StateSnapshot} for `primary`,
 * `siblings[exportName]`, and `dependencies[localId]` sections —
 * one section per runner mounted by a `CompiledScriptBundle`.
 *
 * `orderPosition` is this runner's nominal `order.*` position as of the last
 * confirmed fold. It is **optional and absence means flat** — a snapshot taken
 * before the `orders` channel existed, or by a runner whose position is flat,
 * omits it — so no snapshot version bump is spent on an additive field and a
 * pre-orders payload stays loadable. It rides per runner rather than at the top
 * level because a sibling's orders ARE forwarded to the parent wire, and a
 * sibling position lost across an eviction would silently invert every later
 * signal it emits.
 *
 * @since 0.7 — `orderPosition` added in 1.12
 * @stable
 * @example
 *     const r: RunnerSnapshot = {
 *         slots: { "x:state": { committed: 1, tentative: 1 } },
 *         orderPosition: { size: 1, avgPrice: 101.5, entryBar: 3 },
 *     };
 *     void r;
 */
export type RunnerSnapshot = Readonly<{
    slots: Readonly<Record<string, JsonValue>>;
    orderPosition?: OrderPosition;
}>;

/**
 * Canonical persistent-store snapshot.
 *
 * Written on `dispose()` and on every `kind: "close"` event when stale for
 * at least 60 seconds. Each runner's `state.*` payload is
 * keyed by the compiler-injected slot id with the runner's
 * `slotIdPrefix` prepended (Task 5). Primary-runner TA
 * slots live in `primary.slots` alongside `state.*` slots (the bundle's
 * deps + siblings share the primary's mainStream, so TA slots have no
 * per-runner section).
 *
 * `barIndex` is the absolute index of the last bar folded into the
 * snapshot, counted from the runner's first bar — so a host resumes by
 * feeding bar `barIndex + 1`. It is `-1` for a snapshot captured before
 * any bar closed. Unlike a stream's `filled` count it stays exact once a
 * ring has wrapped, which is why it is carried explicitly.
 *
 * `snapshotVersion: 2` is the only currently-supported wire version;
 * version-1 payloads (which predate `barIndex`) are rejected by the
 * runtime validator and replayed from scratch. The 0.7 per-runner
 * widening is additive — the validator accepts both the legacy flat
 * `slots:` shape (loaded as primary-only) and the structured
 * `primary` / `siblings?` / `dependencies?` shape (always written going
 * forward). {@link RunnerSnapshot.orderPosition} is additive the same way and
 * keeps the version at `2`: an absent field restores the flat position.
 *
 * @since 0.5 — widened to per-runner sections in 0.7, `barIndex` added in 1.11
 * @stable
 * @example
 *     const s: StateSnapshot = {
 *         lastBarTime: 1_700_000_000_000,
 *         barIndex: 4,
 *         streams: {},
 *         savedAt: 1_700_000_060_000,
 *         snapshotVersion: 2,
 *         primary: { slots: {} },
 *     };
 *     void s;
 */
export type StateSnapshot = Readonly<{
    lastBarTime: number;
    barIndex: number;
    streams: Readonly<Record<string, StreamSnapshot>>;
    savedAt: number;
    snapshotVersion: 2;
    primary: RunnerSnapshot;
    siblings?: Readonly<Record<string, RunnerSnapshot>>;
    dependencies?: Readonly<Record<string, RunnerSnapshot>>;
}>;

/**
 * Canonical persistent-store identity tuple.
 *
 * Every field contributes to the cache key; any change invalidates the
 * snapshot. Stores treat this tuple opaquely as a string key;
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

/**
 * Canonical string form of a {@link StateStoreKey}.
 *
 * Field order is fixed here (not left to `Object.keys` insertion order) and
 * `requestedIntervals` is joined rather than nested, so two structurally equal
 * keys always stringify identically regardless of how the object literal was
 * written. Stores use it as their record id and hosts use it to compare a
 * persisted snapshot's key against the key the script is currently mounted
 * under.
 *
 * @since 1.11
 * @stable
 * @example
 *     const id = stateStoreKeyId({
 *         scriptHash: "abc",
 *         compilerVersion: "1.11.0",
 *         apiVersion: 1,
 *         capabilitiesHash: "def",
 *         symbol: "BTCUSD",
 *         mainInterval: "1m",
 *         requestedIntervals: ["1D"],
 *     });
 *     void id;
 */
export function stateStoreKeyId(key: StateStoreKey): string {
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
 * Identity comparison for two optional {@link StateStoreKey}s.
 *
 * `null` models "this host was mounted without a key". Two null keys match
 * (an unkeyed host may only exchange snapshots with itself); a null and a
 * non-null key never do. Everything else compares through
 * {@link stateStoreKeyId}, so a single differing field — including a
 * `compilerVersion` bump after a recompile — is a mismatch.
 *
 * @since 1.11
 * @stable
 * @example
 *     const same = stateStoreKeysEqual(null, null);
 *     void same;
 */
export function stateStoreKeysEqual(a: StateStoreKey | null, b: StateStoreKey | null): boolean {
    if (a === null || b === null) return a === b;
    return stateStoreKeyId(a) === stateStoreKeyId(b);
}
