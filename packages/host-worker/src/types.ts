// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    CandleEvent,
    ExternalSeriesFeedMap,
    PlotOverride,
    RunnerEmissions,
} from "@invinite-org/chartlang-adapter-kit";
import type {
    Bar,
    ScriptManifest,
    StateSnapshot,
    StateStoreKey,
} from "@invinite-org/chartlang-core";

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
 * A captured runner state plus the {@link StateStoreKey} identity it is valid
 * for. Produced by `ScriptHost.exportSnapshot()` and consumed unchanged by
 * `ScriptHost.importSnapshot()`.
 *
 * The key travels bound to the payload on purpose: a consumer that persists a
 * snapshot across an eviction cannot accidentally store one without the other,
 * and the receiving host can refuse a snapshot captured under a different
 * script hash / compiler version / symbol / interval set. `key` is `null` when
 * the exporting host was constructed without a `stateStoreKey` — a null-keyed
 * snapshot is only importable into a null-keyed host.
 *
 * The whole envelope is JSON-clean, so it survives `structuredClone`,
 * `JSON.stringify`, and a Durable-Object storage round trip.
 *
 * @since 1.5
 * @stable
 * @example
 *     declare const host: ScriptHost;
 *     const exported: HostSnapshot | null = await host.exportSnapshot();
 *     void exported;
 */
export type HostSnapshot = Readonly<{
    key: StateStoreKey | null;
    snapshot: StateSnapshot;
}>;

/**
 * Opt-in automatic persistence for the shipped worker boot.
 *
 * `kind: "idb"` makes the boot build the packaged `idbStateStore` around the
 * `load` frame's `stateStoreKey` — the store cannot be constructed before that
 * frame arrives, which is why this is a JSON descriptor on the wire rather
 * than a store instance passed to `createWorkerBoot`. The boot then saves on
 * the runtime's own cadence and warm-starts once, on the first candle event it
 * can read a bar time from.
 *
 * Independent of the manual `exportSnapshot` / `importSnapshot` verbs: a
 * consumer that manages its own storage (a server-side host, a Durable Object)
 * uses the verbs and omits this.
 *
 * @since 1.5
 * @stable
 * @example
 *     const persistence: WorkerPersistence = { kind: "idb", dbName: "chartlang" };
 *     void persistence;
 */
export type WorkerPersistence = Readonly<{
    kind: "idb";
    dbName?: string;
    capBytes?: number;
}>;

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
    /**
     * Live-swap the complete external-series feed map keyed by
     * `input.externalSeries(...)` descriptor name. Omitted keys clear any
     * previous feed and resolve to `NaN` values on subsequent computes.
     *
     * @since 1.9
     */
    setExternalSeries(feeds: ExternalSeriesFeedMap): void;
    drain(): Promise<RunnerEmissions>;
    /**
     * Capture the runner's whole state — OHLCV rings, `ta.*` accumulators,
     * every `state.*` slot family, sibling + dependency sections — as a
     * JSON-clean {@link HostSnapshot}.
     *
     * Resolves `null` only when the capture itself fails validation (state
     * that is not JSON-clean). Rejects with a `SnapshotError` when called
     * before `load()`.
     *
     * @since 1.5
     */
    exportSnapshot(): Promise<HostSnapshot | null>;
    /**
     * Restore a {@link HostSnapshot} into a freshly loaded runner.
     *
     * Legal only AFTER `load()` and BEFORE the first `push()`; the returned
     * `barIndex` is the last bar folded into the restored state, so the caller
     * resumes by pushing bar `barIndex + 1` (skipping already-folded bars is
     * the caller's job). Rejects with a `SnapshotError` — never a `fatal` —
     * when called out of order, when `snapshot.key` does not match the host's
     * own `stateStoreKey`, or when the payload fails validation.
     *
     * @since 1.5
     */
    importSnapshot(exported: HostSnapshot): Promise<{ barIndex: number }>;
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
    warmStart(currentMainBarTime: number): Promise<void>;
    drain(): RunnerEmissions;
    setPlotOverrides(overrides: Readonly<Record<string, PlotOverride>>): void;
    setExternalSeries(feeds: ExternalSeriesFeedMap): void;
    exportSnapshot(): StateSnapshot | null;
    importSnapshot(snapshot: StateSnapshot): { barIndex: number };
    dispose(): Promise<void>;
};
