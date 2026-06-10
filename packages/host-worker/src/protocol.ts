// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    AdapterSymInfo,
    CandleEvent,
    Capabilities,
    RunnerEmissions,
} from "@invinite-org/chartlang-adapter-kit";

import type { HostCompiledScript, HostLimits } from "./types.js";

/**
 * Messages the main thread posts into the worker. JSON-clean by construction
 * — every payload survives `structuredClone` without bespoke transferables.
 *
 * - `load` carries the compiled bundle, the adapter's `Capabilities`, and the
 *   host's `HostLimits`. Optional `inputOverrides` is already resolved on the
 *   host side because callbacks cannot cross the worker boundary.
 * - `candleEvent` is fire-and-forget — the worker only replies on overshoot
 *   or fatal.
 * - `drain` carries a host-issued `nonce`; the matching reply echoes it.
 * - `dispose` has no reply.
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
          readonly limits: HostLimits;
      }
    | { readonly kind: "candleEvent"; readonly event: CandleEvent }
    | { readonly kind: "drain"; readonly nonce: number }
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
    | { readonly kind: "step-overshoot"; readonly observedMs: number }
    | { readonly kind: "fatal"; readonly message: string };
