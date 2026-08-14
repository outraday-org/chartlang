// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    AdapterSymInfo,
    CandleEvent,
    Capabilities,
    ExternalSeriesFeedMap,
    PlotOverride,
    RunnerEmissions,
} from "@invinite-org/chartlang-adapter-kit";

import type {
    SessionCalendarDay,
    StateSnapshot,
    StateStoreKey,
} from "@invinite-org/chartlang-core";

import type { HostCompiledScript, HostLimits, WorkerPersistence } from "./types.js";

/**
 * Messages the main thread posts into the worker. JSON-clean by construction
 * — every payload survives `structuredClone` without bespoke transferables.
 *
 * - `load` carries the compiled bundle, the adapter's `Capabilities`, and the
 *   host's `HostLimits`. Optional `inputOverrides` / `plotOverrides` and
 *   external-series feeds are already resolved on the host side because
 *   callbacks cannot cross the worker boundary.
 * - `candleEvent` is fire-and-forget — the worker only replies on overshoot
 *   or fatal.
 * - `setPlotOverrides` swaps the live presentation-override map.
 * - `setExternalSeries` swaps the live external-series feed map.
 * - `drain` carries a host-issued `nonce`; the matching reply echoes it.
 * - `exportSnapshot` / `importSnapshot` carry a `nonce` on the same
 *   convention as `drain`; each is answered by exactly one of `snapshot` /
 *   `snapshotImported` / `snapshotError`.
 * - `dispose` has no reply.
 *
 * `load`'s optional `stateStoreKey` is the identity every snapshot this
 * worker exports is stamped with and every snapshot it imports is checked
 * against; `persistence` opts the boot into the packaged IDB store built
 * around that key.
 *
 * `load`'s optional `sessionCalendar` carries exchange-calendar ROWS, not a
 * built calendar: an object with a `lookup()` method cannot be posted into a
 * worker, so the rows travel and the runner builds the interface on the far
 * side. It is a field on the EXISTING `load` frame — the calendar deliberately
 * gets no frame kind of its own.
 *
 * @since 0.1
 * @stable
 * @example
 *     const m: HostToWorker = { kind: "dispose" };
 *     void m;
 */
export type HostToWorker =
    | {
          readonly kind: "load";
          readonly compiled: HostCompiledScript;
          readonly capabilities: Capabilities;
          readonly symInfo?: AdapterSymInfo;
          readonly inputOverrides?: Readonly<Record<string, unknown>>;
          readonly plotOverrides?: Readonly<Record<string, PlotOverride>>;
          readonly externalSeriesFeeds?: ExternalSeriesFeedMap;
          readonly stateStoreKey?: StateStoreKey;
          readonly persistence?: WorkerPersistence;
          readonly sessionCalendar?: ReadonlyArray<SessionCalendarDay>;
          readonly limits: HostLimits;
      }
    | { readonly kind: "candleEvent"; readonly event: CandleEvent }
    | {
          readonly kind: "setPlotOverrides";
          readonly overrides: Readonly<Record<string, PlotOverride>>;
      }
    | {
          readonly kind: "setExternalSeries";
          readonly feeds: ExternalSeriesFeedMap;
      }
    | { readonly kind: "drain"; readonly nonce: number }
    | { readonly kind: "exportSnapshot"; readonly nonce: number }
    | {
          readonly kind: "importSnapshot";
          readonly nonce: number;
          readonly snapshot: StateSnapshot;
          readonly key: StateStoreKey | null;
      }
    | { readonly kind: "dispose" };

/**
 * Messages the worker posts back to the main thread.
 *
 * - `loaded` / `loadError` close the `load` round-trip.
 * - `emissions` carries the matching `nonce` from the `drain` request.
 * - `step-overshoot` is fire-and-forget — Phase-1 enforcement is
 *   measurement, not preemption. The host surfaces overshoots via
 *   `onWorkerError`; Phase 5's QuickJS host adds real interrupt-based
 *   preemption.
 * - `snapshot` answers `exportSnapshot`; its payload is `null` when the
 *   capture failed validation, and `key` echoes the identity the worker was
 *   loaded under.
 * - `snapshotImported` answers a successful `importSnapshot` with the last
 *   bar index folded into the restored state.
 * - `snapshotError` is the TYPED refusal of either snapshot verb (called
 *   before `load`, called after the first push, key mismatch, malformed
 *   payload). It is deliberately not `fatal`: the runner is still alive and
 *   the caller can fall back to a full replay instead of tearing the worker
 *   down.
 * - `fatal` reports any uncaught error inside the boot's message handler.
 *
 * @since 0.1
 * @stable
 * @example
 *     const m: WorkerToHost = { kind: "loaded" };
 *     void m;
 */
export type WorkerToHost =
    | { readonly kind: "loaded" }
    | { readonly kind: "loadError"; readonly message: string }
    | {
          readonly kind: "emissions";
          readonly nonce: number;
          readonly emissions: RunnerEmissions;
      }
    | {
          readonly kind: "snapshot";
          readonly nonce: number;
          readonly snapshot: StateSnapshot | null;
          readonly key: StateStoreKey | null;
      }
    | { readonly kind: "snapshotImported"; readonly nonce: number; readonly barIndex: number }
    | { readonly kind: "snapshotError"; readonly nonce: number; readonly message: string }
    | { readonly kind: "step-overshoot"; readonly observedMs: number }
    | { readonly kind: "fatal"; readonly message: string };
