// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar, CompiledScriptObject, ScriptManifest } from "@invinite-org/chartlang-core";
import type { CandleEvent, RunnerEmissions } from "@invinite-org/chartlang-adapter-kit";

/**
 * Resource caps a `ScriptHost` reports to its consumer. Phase-1 `host-worker`
 * enforces `maxCpuMsPerStep` via measurement-only watchdog inside the worker
 * boot; `maxHeapBytes` is advisory (no browser API exists for reliable
 * per-worker heap caps — Phase 5's QuickJS host adds real limits).
 * `maxRingBufferBars` is forwarded for runtime sizing decisions.
 *
 * @since 0.1
 * @experimental
 * @example
 *     const limits: HostLimits = {
 *         maxHeapBytes: 64 * 1024 * 1024,
 *         maxCpuMsPerStep: 50,
 *         maxRingBufferBars: 5_000,
 *     };
 */
export type HostLimits = {
    readonly maxHeapBytes: number;
    readonly maxCpuMsPerStep: number;
    readonly maxRingBufferBars: number;
};

/**
 * The minimal compiled-script shape the host streams across the postMessage
 * boundary. Mirrors `@invinite-org/chartlang-compiler`'s `CompiledScript`
 * without naming it — keeps `host-worker` free of a compiler dependency while
 * still pinning the wire contract (Phase 1 walking skeleton).
 *
 * @since 0.1
 * @experimental
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
 * @experimental
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
 * @since 0.1
 * @experimental
 * @example
 *     const ch = new MessageChannel();
 *     const worker: WorkerLike = ch.port1;
 *     void worker;
 */
export type WorkerLike = {
    addEventListener(type: "message", listener: (ev: MessageEvent<unknown>) => void): void;
    postMessage(msg: unknown): void;
    terminate?(): void;
};

/**
 * The runtime-level surface a worker boot stands up around a compiled script.
 * Re-declared here so the boot module doesn't pull `createScriptRunner`'s
 * typings through `@invinite-org/chartlang-runtime`'s barrel during dynamic
 * import resolution.
 *
 * @since 0.1
 * @experimental
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
    drain(): RunnerEmissions;
    dispose(): void;
};

/**
 * The default ESM-export shape the worker boot expects from a dynamically
 * imported compiled module. Matches `@invinite-org/chartlang-compiler`'s
 * bundled output (`export default defineIndicator(...)`).
 *
 * @since 0.1
 * @experimental
 * @example
 *     const m: CompiledModuleExport = {
 *         default: { manifest: {} as ScriptManifest, compute: () => {} },
 *     };
 *     void m;
 */
export type CompiledModuleExport = {
    readonly default: CompiledScriptObject;
};
