// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    AdapterSymInfo,
    Capabilities,
    RunnerEmissions,
} from "@invinite-org/chartlang-adapter-kit";

import { defaultWorkerFactory } from "./defaultWorkerFactory";
import { DEFAULT_LIMITS } from "./limits";
import type { HostToWorker, WorkerToHost } from "./protocol";
import type { HostLimits, ScriptHost, WorkerLike } from "./types";

/**
 * Constructor options for {@link createWorkerHost}.
 *
 * - `capabilities` — the adapter's declared capability bag. Bolted onto every
 *   `load` postMessage; the worker boot never falls back to a default.
 * - `symInfo` — optional adapter-supplied metadata for runtime `syminfo.*`.
 * - `resolveInputs` — optional adapter callback. The host resolves it during
 *   `load()` and sends the plain override record to the worker.
 * - `workerLike` — injection seam for tests. Production callers omit it; the
 *   host then constructs a real `Worker` via {@link defaultWorkerFactory}.
 * - `limits` — partial `HostLimits` overrides; missing fields fall through to
 *   {@link DEFAULT_LIMITS}.
 * - `onWorkerError` — called when the worker posts `step-overshoot` or
 *   `fatal`. The host does not synthesize diagnostics into the next
 *   `drain()` — Phase 1 keeps overshoot surfacing on the adapter.
 *
 * @since 0.1
 * @experimental
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
    readonly workerLike?: WorkerLike;
    readonly limits?: Partial<HostLimits>;
    readonly onWorkerError?: (message: string) => void;
};

function hasTerminate(w: WorkerLike): w is WorkerLike & { terminate: () => void } {
    return typeof w.terminate === "function";
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
 * @experimental
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

    worker.addEventListener("message", (ev: MessageEvent<unknown>) => {
        const msg = ev.data as WorkerToHost;
        switch (msg.kind) {
            case "loaded": {
                loadedResolve?.();
                loadedResolve = null;
                loadedReject = null;
                break;
            }
            case "loadError": {
                loadedReject?.(new Error(msg.message));
                loadedResolve = null;
                loadedReject = null;
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

    return Object.freeze<ScriptHost>({
        load(compiled) {
            return new Promise<void>((resolve, reject) => {
                if (loadedResolve !== null) {
                    reject(new Error("load() already in flight"));
                    return;
                }
                loadedResolve = resolve;
                loadedReject = reject;
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
            pendingDrains.clear();
        },
        limits,
    });
}
