// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    CandleEvent,
    PlotOverride,
    RunnerEmissions,
} from "@invinite-org/chartlang-adapter-kit";
import type { Bar, CompiledScriptObject, ScriptManifest } from "@invinite-org/chartlang-core";

/**
 * Resource caps a `ScriptHost` reports to its consumer. Phase-1 `host-worker`
 * enforces `maxCpuMsPerStep` via measurement-only watchdog inside the worker
 * boot; `maxHeapBytes` is advisory (no browser API exists for reliable
 * per-worker heap caps — Phase 5's QuickJS host adds real limits).
 * `maxRingBufferBars` is forwarded for runtime sizing decisions.
 *
 * `maxLoadTimeoutMs` bounds how long `host.load()` is allowed to wait for the
 * worker's `loaded` reply before rejecting with a descriptive timeout error.
 * A silently-dead worker (failed module fetch, exception during boot, OS-level
 * crash) would otherwise leave `load()` pending forever.
 *
 * @since 0.1
 * @stable
 * @example
 *     const limits: HostLimits = {
 *         maxHeapBytes: 64 * 1024 * 1024,
 *         maxCpuMsPerStep: 50,
 *         maxRingBufferBars: 5_000,
 *         maxLoadTimeoutMs: 30_000,
 *     };
 */
export type HostLimits = {
    readonly maxHeapBytes: number;
    readonly maxCpuMsPerStep: number;
    readonly maxRingBufferBars: number;
    readonly maxLoadTimeoutMs: number;
};

/**
 * The minimal compiled-script shape the host streams across the postMessage
 * boundary. Mirrors `@invinite-org/chartlang-compiler`'s `CompiledScript`
 * without naming it — keeps `host-worker` free of a compiler dependency while
 * still pinning the wire contract (Phase 1 walking skeleton).
 *
 * @since 0.1
 * @stable
 * @example
 *     const cs: HostCompiledScript = {
 *         moduleSource: "export default { manifest: {...}, compute: () => {} };",
 *         manifest: {
 *             apiVersion: 1,
 *             kind: "indicator",
 *             name: "demo",
 *             inputs: {},
 *             capabilities: ["indicators"],
 *             requestedIntervals: [],
 *             userPickableInterval: false,
 *             seriesCapacities: {},
 *             maxLookback: 0,
 *         },
 *     };
 */
export type HostCompiledScript = {
    readonly moduleSource: string;
    readonly manifest: ScriptManifest;
};

/**
 * Host-side lifecycle handle the worker host returns. Mirrors PLAN §8.1 — the
 * Phase-1 Web Worker host owns the only declaration; Phase-5's QuickJS host
 * re-uses the same shape. Methods cross the worker boundary via structured
 * clones; `dispose` terminates the worker.
 *
 * @since 0.1
 * @stable
 * @example
 *     declare const host: ScriptHost;
 *     await host.load({
 *         moduleSource: "export default { manifest: m, compute: () => {} };",
 *         manifest: m,
 *     });
 *     await host.push({ kind: "history", bars: [] });
 *     const emissions = await host.drain();
 *     host.dispose();
 *     void emissions;
 */
export type ScriptHost = {
    load(compiled: HostCompiledScript): Promise<void>;
    push(event: CandleEvent): Promise<void>;
    /**
     * Live-swap the per-slot presentation overrides keyed by
     * `PlotEmission.slotId`. Presentation-only — no recompute; the next
     * `drain` reflects the new map. @since 0.8
     */
    setPlotOverrides(overrides: Readonly<Record<string, PlotOverride>>): void;
    drain(): Promise<RunnerEmissions>;
    dispose(): void;
    readonly limits: HostLimits;
};

/**
 * Duck-typed slice of the browser `Worker` / `MessagePort` surface the host
 * needs. Tests supply a `MessageChannel` port; production supplies a real
 * `Worker`. `terminate` is optional because `MessagePort` doesn't expose it —
 * the host feature-detects before calling.
 *
 * The `addEventListener("error", ...)` overload models the browser `Worker`'s
 * boot/runtime failure channel. `MessagePort`-backed fakes accept the
 * subscription but never fire it; the host unconditionally subscribes and
 * relies on the boundary's natural no-op.
 *
 * @since 0.1
 * @stable
 * @example
 *     const ch = new MessageChannel();
 *     const worker: WorkerLike = ch.port1;
 *     void worker;
 */
export type WorkerLike = {
    addEventListener(type: "message", listener: (ev: MessageEvent<unknown>) => void): void;
    addEventListener(type: "error", listener: (ev: WorkerErrorEvent) => void): void;
    postMessage(msg: unknown): void;
    terminate?(): void;
};

/**
 * The minimum subset of `ErrorEvent` the host reads when a real `Worker`
 * fails to boot or crashes. Defined locally because `MessagePort` doesn't
 * dispatch `ErrorEvent` and we don't want to drag a DOM-typed alias through
 * the worker boundary.
 *
 * @since 0.1
 * @stable
 * @example
 *     const ev: WorkerErrorEvent = { message: "boot failed" };
 *     void ev;
 */
export type WorkerErrorEvent = {
    readonly message?: string;
    readonly filename?: string;
    readonly error?: unknown;
};

/**
 * The runtime-level surface a worker boot stands up around a compiled script.
 * Re-declared here so the boot module doesn't pull `createScriptRunner`'s
 * typings through `@invinite-org/chartlang-runtime`'s barrel during dynamic
 * import resolution.
 *
 * @since 0.1
 * @stable
 * @example
 *     // declare const r: ScriptRunnerHandle;
 *     // await r.onBarClose({ time: 0, open: 1, high: 1, low: 1, close: 1, volume: 0, symbol: "", interval: "" });
 *     declare const r: ScriptRunnerHandle;
 *     void r;
 */
export type ScriptRunnerHandle = {
    onHistory(bars: ReadonlyArray<Bar>): Promise<void>;
    onBarClose(bar: Bar): Promise<void>;
    onBarTick(bar: Bar): Promise<void>;
    push(event: CandleEvent): Promise<void>;
    drain(): RunnerEmissions;
    setPlotOverrides(overrides: Readonly<Record<string, PlotOverride>>): void;
    dispose(): Promise<void>;
};

/**
 * The default ESM-export shape the worker boot expects from a dynamically
 * imported compiled module. Matches `@invinite-org/chartlang-compiler`'s
 * bundled output:
 *
 * - **Single-script** files export `default` + `__manifest:
 *   ScriptManifest` (and may omit `__manifest`).
 * - **Multi-export / composition** files (§22.10) additionally export
 *   one named const per drawn sibling (`mod[exportName]`), an array
 *   `__manifest: ReadonlyArray<ScriptManifest>`, and (when the default
 *   manifest carries `dependencies`) `__dependencies` carrying every
 *   private-dep compiled object.
 *
 * The `[exportName: string]: unknown` index signature keeps sibling
 * reads narrow without forcing every host caller to assert types — the
 * host walks `mod[exportName]` with the local
 * `isCompiledScriptObject` guard before forwarding.
 *
 * @since 0.1 — widened in 0.7 for indicator-composition bundles.
 * @stable
 * @example
 *     const m: CompiledModuleExport = {
 *         default: { manifest: {} as ScriptManifest, compute: () => {} },
 *     };
 *     void m;
 */
export type CompiledModuleExport = {
    readonly default: CompiledScriptObject;
    /**
     * Sidecar manifest. Single object for back-compat single-script
     * bundles; array of `ScriptManifest` (default first) for
     * multi-export composition bundles.
     *
     * @since 0.7
     */
    readonly __manifest?: ScriptManifest | ReadonlyArray<ScriptManifest>;
    /**
     * Inlined private deps a multi-export bundle exposes for host
     * mounting. Each entry's `compiled` is the `defineIndicator(...)`
     * return value bound to a module-local `const <localId>` in the
     * consumer's source.
     *
     * @since 0.7
     */
    readonly __dependencies?: ReadonlyArray<{
        readonly localId: string;
        readonly compiled: CompiledScriptObject;
        /**
         * Merged `.withInputs({...})` overrides the consumer applied
         * to its alias binding. Forwarded to the runtime so the
         * `DepRunner` evaluates the producer's `compute` with the
         * consumer-supplied inputs instead of the producer's
         * manifest defaults. Omitted for direct
         * `defineIndicator(...)` private deps that don't apply
         * overrides.
         *
         * @since 0.7
         */
        readonly inputOverrides?: Readonly<Record<string, unknown>>;
    }>;
    readonly [exportName: string]: unknown;
};
