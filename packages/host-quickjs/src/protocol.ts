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

import type { QuickJsCompiledScript, QuickJsHostLimits } from "./types.js";

/**
 * Messages the host posts into the QuickJS runtime. JSON-clean by
 * construction — every payload survives the QuickJS membrane (Task 7)
 * without bespoke transferables.
 *
 * Mirrors `@invinite-org/chartlang-host-worker`'s `HostToWorker` frame
 * fields. The limits payload is QuickJS-flavoured (`maxStepMs`) because this
 * host enforces a real interrupt budget rather than the worker host's
 * measurement-only `maxCpuMsPerStep`.
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
    | { readonly kind: "dispose" };

/**
 * Messages the QuickJS runtime posts back to the host. This mirrors
 * `@invinite-org/chartlang-host-worker`'s `WorkerToHost` union
 * byte-for-byte so drain, load, overshoot, and fatal handling can be shared.
 *
 * `loaded` is the load-complete ack only. `ack` is the empty-success reply
 * used by push / dispose; the host treats it the same as `loaded` today but
 * keeping the discriminator distinct lets future log / diagnostic-bearing
 * acks evolve without breaking the load contract.
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
    | { readonly kind: "step-overshoot"; readonly observedMs: number }
    | { readonly kind: "fatal"; readonly message: string };
