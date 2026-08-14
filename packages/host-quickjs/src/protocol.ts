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

import type { QuickJsCompiledScript, QuickJsHostLimits } from "./types.js";

/**
 * Messages the host posts into the QuickJS runtime. JSON-clean by
 * construction — every payload survives the QuickJS membrane (Task 7)
 * without bespoke transferables.
 *
 * Mirrors `@invinite-org/chartlang-host-worker`'s `HostToWorker` frame
 * fields, including the snapshot verbs. The limits payload is
 * QuickJS-flavoured (`maxStepMs`) because this host enforces a real interrupt
 * budget rather than the worker host's measurement-only `maxCpuMsPerStep`,
 * and `load` carries NO `persistence` descriptor — IndexedDB does not exist
 * in this realm, so automatic persistence is a host-worker-only affordance.
 * `stateStoreKey` does mirror: the dispatcher needs it to stamp exports and
 * to refuse a foreign snapshot on import. So does `sessionCalendar` — the
 * exchange-calendar ROWS a `lookup()` interface could never cross the membrane
 * as; the runner rebuilds the lookup guest-side. No new frame kind: it is a
 * field on the existing `load`.
 *
 * @since 0.5
 * @stable
 * @example
 *     const m: HostToQuickJs = { kind: "dispose" };
 *     void m;
 */
export type HostToQuickJs =
    | {
          readonly kind: "load";
          readonly compiled: QuickJsCompiledScript;
          readonly capabilities: Capabilities;
          readonly symInfo?: AdapterSymInfo;
          readonly inputOverrides?: Readonly<Record<string, unknown>>;
          readonly plotOverrides?: Readonly<Record<string, PlotOverride>>;
          readonly externalSeriesFeeds?: ExternalSeriesFeedMap;
          readonly stateStoreKey?: StateStoreKey;
          readonly sessionCalendar?: ReadonlyArray<SessionCalendarDay>;
          readonly limits: QuickJsHostLimits;
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
 * Messages the QuickJS runtime posts back to the host. This mirrors
 * `@invinite-org/chartlang-host-worker`'s `WorkerToHost` union — every arm
 * there exists here with the same shape, so drain, load, snapshot, overshoot,
 * and fatal handling can be shared — plus the QuickJS-only `ack`.
 *
 * `loaded` is the load-complete ack only. `ack` is the empty-success reply
 * used by push / dispose; the host treats it the same as `loaded` today but
 * keeping the discriminator distinct lets future log / diagnostic-bearing
 * acks evolve without breaking the load contract.
 *
 * `snapshotError` is the TYPED refusal of a snapshot verb and is deliberately
 * distinct from `fatal`: the runner is still usable and the caller can fall
 * back to a full replay.
 *
 * @since 0.5
 * @stable
 * @example
 *     const m: QuickJsToHost = { kind: "loaded" };
 *     void m;
 */
export type QuickJsToHost =
    | { readonly kind: "loaded" }
    | { readonly kind: "ack" }
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
