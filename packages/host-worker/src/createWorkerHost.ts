// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    AdapterSymInfo,
    Capabilities,
    PlotOverride,
    RunnerEmissions,
} from "@invinite-org/chartlang-adapter-kit";

import { defaultWorkerFactory } from "./defaultWorkerFactory.js";
import { DEFAULT_LIMITS } from "./limits.js";
import type { HostToWorker, WorkerToHost } from "./protocol.js";
import type { HostLimits, ScriptHost, WorkerErrorEvent, WorkerLike } from "./types.js";

/**
 * Constructor options for {@link createWorkerHost}.
 *
 * - `capabilities` — the adapter's declared capability bag. Bolted onto every
 *   `load` postMessage; the worker boot never falls back to a default.
 * - `symInfo` — optional adapter-supplied metadata for runtime `syminfo.*`.
 * - `resolveInputs` — optional adapter callback. The host resolves it during
 *   `load()` and sends the plain override record to the worker.
 * - `resolvePlotOverrides` — optional adapter callback for the initial per-slot
 *   presentation overrides. Resolved during `load()`; the plain record is sent
 *   to the worker beside `inputOverrides`.
 * - `workerLike` — injection seam for tests. Production callers omit it; the
 *   host then constructs a real `Worker` via {@link defaultWorkerFactory}.
 * - `limits` — partial `HostLimits` overrides; missing fields fall through to
 *   {@link DEFAULT_LIMITS}.
 * - `onWorkerError` — called when the worker posts `step-overshoot` or
 *   `fatal`. The host does not synthesize diagnostics into the next
 *   `drain()` — Phase 1 keeps overshoot surfacing on the adapter.
 *
 * @since 0.1
 * @stable
 * @example
 *     const opts: CreateWorkerHostOpts = {
 *         capabilities: {} as Capabilities,
 *     };
 *     void opts;
 */
export type CreateWorkerHostOpts = {
    readonly capabilities: Capabilities;
    readonly symInfo?: AdapterSymInfo;
    readonly resolveInputs?: (scriptId: string) => Readonly<Record<string, unknown>>;
    readonly resolvePlotOverrides?: (scriptId: string) => Readonly<Record<string, PlotOverride>>;
    readonly workerLike?: WorkerLike;
    readonly limits?: Partial<HostLimits>;
    readonly onWorkerError?: (message: string) => void;
};

function hasTerminate(w: WorkerLike): w is WorkerLike & { terminate: () => void } {
    return typeof w.terminate === "function";
}

function describeWorkerError(ev: WorkerErrorEvent): string {
    if (typeof ev.message === "string" && ev.message.length > 0) return ev.message;
    if (ev.error instanceof Error && ev.error.message.length > 0) return ev.error.message;
    if (typeof ev.error === "string" && ev.error.length > 0) return ev.error;
    return "unknown worker error";
}

/**
 * Build a browser-default `ScriptHost` around a Web Worker. The host
 * round-trips `load` / `push` / `drain` / `dispose` calls across the worker
 * boundary via structured-clone-safe postMessage frames defined in
 * {@link HostToWorker} / {@link WorkerToHost}.
 *
 * The host owns the `nonce` counter for `drain` correlation, the in-flight
 * `load` promise, and the in-flight drain registry. `dispose` posts the
 * tear-down message, calls `terminate()` when the underlying `WorkerLike`
 * supports it, and clears the pending-drain map.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { createWorkerHost } from "@invinite-org/chartlang-host-worker";
 *     // const host = createWorkerHost({ capabilities });
 *     const fn: typeof createWorkerHost = createWorkerHost;
 *     void fn;
 */
export function createWorkerHost(opts: CreateWorkerHostOpts): ScriptHost {
    const limits: HostLimits = Object.freeze({ ...DEFAULT_LIMITS, ...opts.limits });
    // The `defaultWorkerFactory` branch is browser-only — tests always inject
    // `workerLike`. Excluded from coverage to keep the production-only
    // `new Worker(...)` path uncounted, consistent with the file-level
    // exclusion of `defaultWorkerFactory.ts` itself.
    /* v8 ignore next */
    const worker: WorkerLike = opts.workerLike ?? defaultWorkerFactory();

    let nonceCounter = 0;
    const pendingDrains = new Map<number, (e: RunnerEmissions) => void>();
    let loadedResolve: (() => void) | null = null;
    let loadedReject: ((err: Error) => void) | null = null;
    let loadTimeoutHandle: ReturnType<typeof setTimeout> | null = null;
    // Latches the first worker-level error so a subsequent `load()` call
    // refuses to wait on a dead worker (no `loaded` reply will ever arrive).
    let fatalError: string | null = null;

    function clearLoadTimeout(): void {
        if (loadTimeoutHandle !== null) {
            clearTimeout(loadTimeoutHandle);
            loadTimeoutHandle = null;
        }
    }

    function failLoad(err: Error): void {
        clearLoadTimeout();
        loadedReject?.(err);
        loadedResolve = null;
        loadedReject = null;
    }

    worker.addEventListener("message", (ev: MessageEvent<unknown>) => {
        const msg = ev.data as WorkerToHost;
        switch (msg.kind) {
            case "loaded": {
                clearLoadTimeout();
                loadedResolve?.();
                loadedResolve = null;
                loadedReject = null;
                break;
            }
            case "loadError": {
                failLoad(new Error(msg.message));
                break;
            }
            case "emissions": {
                const resolve = pendingDrains.get(msg.nonce);
                if (resolve !== undefined) {
                    pendingDrains.delete(msg.nonce);
                    resolve(msg.emissions);
                }
                break;
            }
            case "step-overshoot": {
                opts.onWorkerError?.(`step overshoot ${msg.observedMs.toFixed(2)}ms`);
                break;
            }
            case "fatal": {
                opts.onWorkerError?.(msg.message);
                break;
            }
        }
    });

    // The error channel is fed by browser `Worker`'s `onerror` event.
    // `MessagePort`-backed fakes accept the subscription silently and never
    // fire it, which is the right behaviour: a port doesn't have its own
    // boot/error channel. The cast narrows `addEventListener`'s overload
    // signature to the error variant.
    const addErrorListener = worker.addEventListener as (
        type: "error",
        listener: (ev: WorkerErrorEvent) => void,
    ) => void;
    addErrorListener("error", (ev) => {
        const description = describeWorkerError(ev);
        fatalError = description;
        const message = `worker failed to boot: ${description}`;
        failLoad(new Error(message));
        opts.onWorkerError?.(message);
    });

    return Object.freeze<ScriptHost>({
        load(compiled) {
            return new Promise<void>((resolve, reject) => {
                if (fatalError !== null) {
                    reject(new Error(`worker failed to boot: ${fatalError}`));
                    return;
                }
                if (loadedResolve !== null) {
                    reject(new Error("load() already in flight"));
                    return;
                }
                loadedResolve = resolve;
                loadedReject = reject;
                loadTimeoutHandle = setTimeout(() => {
                    failLoad(
                        new Error(
                            `worker load() timed out after ${limits.maxLoadTimeoutMs}ms — worker never replied with 'loaded'`,
                        ),
                    );
                }, limits.maxLoadTimeoutMs);
                const frame: HostToWorker = {
                    kind: "load",
                    compiled: {
                        moduleSource: compiled.moduleSource,
                        manifest: compiled.manifest,
                    },
                    capabilities: opts.capabilities,
                    ...(opts.symInfo !== undefined ? { symInfo: opts.symInfo } : {}),
                    ...(opts.resolveInputs !== undefined
                        ? { inputOverrides: opts.resolveInputs(compiled.manifest.name) }
                        : {}),
                    ...(opts.resolvePlotOverrides !== undefined
                        ? { plotOverrides: opts.resolvePlotOverrides(compiled.manifest.name) }
                        : {}),
                    limits,
                };
                worker.postMessage(frame);
            });
        },
        push(event) {
            const frame: HostToWorker = { kind: "candleEvent", event };
            worker.postMessage(frame);
            return Promise.resolve();
        },
        setPlotOverrides(overrides) {
            const frame: HostToWorker = { kind: "setPlotOverrides", overrides };
            worker.postMessage(frame);
        },
        drain() {
            const n = nonceCounter;
            nonceCounter += 1;
            return new Promise<RunnerEmissions>((resolve) => {
                pendingDrains.set(n, resolve);
                const frame: HostToWorker = { kind: "drain", nonce: n };
                worker.postMessage(frame);
            });
        },
        dispose() {
            const frame: HostToWorker = { kind: "dispose" };
            worker.postMessage(frame);
            if (hasTerminate(worker)) {
                worker.terminate();
            }
            clearLoadTimeout();
            pendingDrains.clear();
        },
        limits,
    });
}
