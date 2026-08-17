// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    AdapterSymInfo,
    Capabilities,
    ExternalSeriesFeedMap,
    LogEmission,
    PlotOverride,
    RunnerEmissions,
    RuntimeDiagnostic,
} from "@invinite-org/chartlang-adapter-kit";
import { validateEmission } from "@invinite-org/chartlang-adapter-kit";
import type { SessionCalendarDay, StateStoreKey } from "@invinite-org/chartlang-core";
import { SnapshotError } from "@invinite-org/chartlang-core";
import type { HostSnapshot } from "@invinite-org/chartlang-host-worker";
import { getQuickJS } from "quickjs-emscripten";

// The dispatcher bundle is inlined as a build-time string constant (generated
// by `scripts/buildDispatcher.ts`) rather than read from disk, so this module
// has no `node:fs` / `node:path` / `node:url` imports and loads in any runtime
// — Cloudflare Durable Object, browser, or Node.
import { DISPATCHER_SOURCE } from "./dispatcherSource.generated.js";
import { QuickJsStepAbortedError } from "./errors.js";
import { DEFAULT_QUICKJS_LIMITS } from "./limits.js";
import type { HostToQuickJs, QuickJsToHost } from "./protocol.js";
import type {
    QuickJsContextLike,
    QuickJsHandleLike,
    QuickJsHostLimits,
    QuickJsLike,
    QuickJsRuntimeLike,
    ScriptHost,
} from "./types.js";

/**
 * Constructor options for {@link createQuickJsHost}.
 *
 * @since 0.5
 * @stable
 * @example
 *     import { createQuickJsHost } from "@invinite-org/chartlang-host-quickjs";
 *
 *     const host = createQuickJsHost({ capabilities });
 *     await host.load(compiled);
 *     for (const bar of bars.slice(0, 10)) {
 *         await host.push({ kind: "close", bar });
 *     }
 *     const emissions = await host.drain();
 *     host.dispose();
 *     void emissions;
 */
export type CreateQuickJsHostOpts = Readonly<{
    capabilities: Capabilities;
    symInfo?: AdapterSymInfo;
    resolveInputs?: (scriptId: string) => Readonly<Record<string, unknown>>;
    resolvePlotOverrides?: (scriptId: string) => Readonly<Record<string, PlotOverride>>;
    resolveExternalSeries?: (scriptId: string) => ExternalSeriesFeedMap;
    /**
     * Snapshot identity this host runs under: stamped on every
     * `exportSnapshot()` result and required to match on every
     * `importSnapshot(...)`. Caller-supplied — the host cannot derive
     * `scriptHash` / `symbol` / `mainInterval` on its own. Omit it and the
     * host exchanges only key-less snapshots.
     *
     * @since 1.5
     */
    stateStoreKey?: StateStoreKey;
    /**
     * Exchange-calendar rows (holidays + half days) for the mounted symbol,
     * sent once on the `load` frame. The dispatcher hands them to
     * `createScriptRunner`, which builds the O(1) lookup inside the guest, so
     * a server-side alert script's `session.isOpen` is holiday-aware.
     * Consumer-supplied — chartlang ships no rows.
     *
     * @since 1.5
     */
    sessionCalendar?: ReadonlyArray<SessionCalendarDay>;
    quickJsLike?: QuickJsLike;
    limits?: Partial<QuickJsHostLimits>;
    onHostError?: (message: string) => void;
}>;

type QuickJsState = Readonly<{
    runtime: QuickJsRuntimeLike;
    context: QuickJsContextLike;
}>;

type HostLimitsView = ScriptHost["limits"];

function makeHostLimits(limits: QuickJsHostLimits, capabilities: Capabilities): HostLimitsView {
    return Object.freeze({
        maxHeapBytes: limits.maxHeapBytes,
        maxCpuMsPerStep: limits.maxStepMs,
        maxRingBufferBars: capabilities.maxLookback,
        maxLoadTimeoutMs: limits.maxLoadTimeoutMs,
    });
}

function dispose(handle: QuickJsHandleLike): void {
    handle.dispose();
}

/**
 * `executePendingJobs()` returns the number of executed jobs on success and an
 * owned result carrying the exception that STOPPED the queue on failure — an
 * interrupt (step/load budget) or an OOM. Discarding it strands every job the
 * queue had left, including the one that settles the reply promise, so the
 * caller must always ask.
 */
function isJobsErrorResult(
    result: unknown,
): result is { readonly error: unknown; readonly context?: unknown } {
    return (
        typeof result === "object" &&
        result !== null &&
        "error" in result &&
        (result as { readonly error: unknown }).error !== undefined
    );
}

function disposeIfDisposable(value: unknown): void {
    if (
        typeof value === "object" &&
        value !== null &&
        "dispose" in value &&
        typeof (value as { readonly dispose: unknown }).dispose === "function"
    ) {
        (value as { dispose(): void }).dispose();
    }
}

/**
 * A failed `executePendingJobs()` owns the QuickJS error handle, which must be
 * freed while the runtime is still alive. When the originating context is
 * already gone the failure is surfaced through a transient error context that
 * the result does NOT own — free that separately, never the live context.
 */
function disposeJobsResult(result: unknown, liveContext: QuickJsContextLike | null): void {
    const errorContext =
        isJobsErrorResult(result) &&
        typeof result.error === "object" &&
        result.error !== null &&
        "context" in result.error
            ? (result.error as { readonly context: unknown }).context
            : null;
    disposeIfDisposable(result);
    if (errorContext !== null && errorContext !== liveContext) {
        disposeIfDisposable(errorContext);
    }
}

/**
 * Upper bound on job-queue pump rounds. Only reachable if a guest job keeps
 * enqueuing successors forever; the budget interrupt normally stops that first.
 */
const MAX_JOB_PUMP_ROUNDS = 10_000;

function parseFrame(json: string): QuickJsToHost {
    return JSON.parse(json) as QuickJsToHost;
}

function stringifyFrame(frame: HostToQuickJs): string {
    return JSON.stringify(frame, (_key, value: unknown) => {
        if (value instanceof Set) {
            return [...value];
        }
        return value;
    });
}

function message(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

function partitionValidated<T extends { readonly bar: number }>(
    items: ReadonlyArray<T>,
    diagnostics: RuntimeDiagnostic[],
    slotIdOf: (item: T) => string | null,
): T[] {
    return items.filter((item) => {
        const result = validateEmission(item);
        if (result.ok) return true;
        diagnostics.push({
            kind: "diagnostic",
            severity: "warning",
            code: result.code,
            message: result.message,
            slotId: slotIdOf(item),
            bar: item.bar,
        });
        return false;
    });
}

function validateDrain(raw: RunnerEmissions): RunnerEmissions {
    const diagnostics = [...raw.diagnostics];
    const plots = partitionValidated(raw.plots, diagnostics, (p) => p.slotId);
    const alerts = partitionValidated(raw.alerts, diagnostics, (a) => a.slotId);
    const alertConditions = partitionValidated(raw.alertConditions, diagnostics, () => null);
    // An order carries a compiler-injected slot id, so its diagnostic is
    // attributable — the alert side of this set, not the null-slot side.
    const orders = partitionValidated(raw.orders, diagnostics, (o) => o.slotId);
    const logs: LogEmission[] = partitionValidated(raw.logs, diagnostics, () => null);
    return {
        plots,
        drawings: raw.drawings,
        alerts,
        alertConditions,
        orders,
        logs,
        diagnostics,
        fromBar: raw.fromBar,
        toBar: raw.toBar,
    };
}

/**
 * Awaits a guest promise as a host string.
 *
 * The awaited promise only settles once the guest `.then` callbacks run, and
 * those are QuickJS jobs — so the queue must be pumped until it is EMPTY, and a
 * pump that stopped on an exception must be surfaced rather than dropped. A
 * dropped failure leaves the settling job stranded and the `await` below never
 * returns: no error, no timeout, just a call that stands still forever.
 *
 * STATED BOUND: this guarantees no hang for a guest whose promises are settled
 * by guest jobs alone, which is what this host installs (it exposes no
 * host-side async functions). A future host that resolves a guest promise from
 * host I/O could still drain the queue with the promise unsettled; that would
 * need its own wall-clock deadline, and this loop would not see it.
 */
async function resolveStringPromise(
    context: QuickJsContextLike,
    runtime: QuickJsRuntimeLike,
    handle: QuickJsHandleLike,
): Promise<string> {
    const pending = context.resolvePromise(handle);
    for (let round = 0; ; round += 1) {
        const jobs = runtime.executePendingJobs();
        if (isJobsErrorResult(jobs)) {
            disposeJobsResult(jobs, context);
            throw new QuickJsStepAbortedError("guest job queue stopped before the reply settled");
        }
        // Absent on minimal `QuickJsRuntimeLike` implementations (test doubles,
        // embedders): one pump round then, exactly as before.
        if (runtime.hasPendingJob?.() !== true) break;
        if (round >= MAX_JOB_PUMP_ROUNDS) {
            throw new QuickJsStepAbortedError("guest job queue did not drain");
        }
    }
    const result = await pending;
    const resolved = context.unwrapResult(result);
    try {
        return context.getString(resolved);
    } finally {
        dispose(resolved);
    }
}

async function callAsyncJson(
    state: QuickJsState,
    fnName: "__chartlang_load" | "__chartlang_push",
    frame: HostToQuickJs,
): Promise<QuickJsToHost> {
    const fn = state.context.getProp(state.context.global, fnName);
    const arg = state.context.newString(stringifyFrame(frame));
    try {
        const result = state.context.callFunction(fn, state.context.undefined, arg);
        const promise = state.context.unwrapResult(result);
        try {
            return parseFrame(await resolveStringPromise(state.context, state.runtime, promise));
        } finally {
            dispose(promise);
        }
    } finally {
        dispose(arg);
        dispose(fn);
    }
}

function callSyncJson(
    state: QuickJsState,
    fnName:
        | "__chartlang_drain"
        | "__chartlang_setPlotOverrides"
        | "__chartlang_setExternalSeries"
        | "__chartlang_exportSnapshot"
        | "__chartlang_importSnapshot",
    frame: HostToQuickJs,
): QuickJsToHost {
    const fn = state.context.getProp(state.context.global, fnName);
    const arg = state.context.newString(stringifyFrame(frame));
    try {
        const result = state.context.callFunction(fn, state.context.undefined, arg);
        const value = state.context.unwrapResult(result);
        try {
            return parseFrame(state.context.getString(value));
        } finally {
            dispose(value);
        }
    } finally {
        dispose(arg);
        dispose(fn);
    }
}

function callDispose(state: QuickJsState): void {
    const fn = state.context.getProp(state.context.global, "__chartlang_dispose");
    try {
        const result = state.context.callFunction(fn, state.context.undefined);
        const value = state.context.unwrapResult(result);
        try {
            const frame = parseFrame(state.context.getString(value));
            if (frame.kind === "fatal") {
                throw new Error(frame.message);
            }
        } finally {
            dispose(value);
        }
    } finally {
        dispose(fn);
    }
}

/**
 * Constructs a QuickJS-backed `ScriptHost` for server-side / untrusted script
 * execution. The host lazily boots a QuickJS runtime on first `load()`,
 * installs the committed dispatcher bundle, and talks to the guest through
 * JSON-string frames only.
 *
 * @since 0.5
 * @stable
 * @example
 *     import { createQuickJsHost } from "@invinite-org/chartlang-host-quickjs";
 *
 *     const host = createQuickJsHost({ capabilities });
 *     await host.load(compiled);
 *     await host.push({ kind: "history", bars });
 *     const emissions = await host.drain();
 *     host.dispose();
 *     void emissions;
 */
export function createQuickJsHost(opts: CreateQuickJsHostOpts): ScriptHost {
    const limits: QuickJsHostLimits = Object.freeze({ ...DEFAULT_QUICKJS_LIMITS, ...opts.limits });
    const hostLimits = makeHostLimits(limits, opts.capabilities);
    const quickJsFactory: QuickJsLike = opts.quickJsLike ?? getQuickJS;
    let statePromise: Promise<QuickJsState> | null = null;
    let state: QuickJsState | null = null;
    // The budget the interrupt handler enforces RIGHT NOW. Carries its own
    // allowance rather than reading `maxStepMs`, because `load()` and `push()`
    // are governed by different limits — and `load()` was governed by none.
    let deadline: { readonly startedAtMs: number; readonly budgetMs: number } | null = null;
    // Set by the interrupt handler, and ONLY by it: the record that the runtime
    // was actually told to cut this call short. Armed per call by
    // `armDeadline`.
    let interrupted = false;
    let poisoned = false;
    let nonceCounter = 0;

    function armDeadline(budgetMs: number): void {
        deadline = { startedAtMs: performance.now(), budgetMs };
        interrupted = false;
    }

    function deadlineExceeded(): boolean {
        return deadline !== null && performance.now() - deadline.startedAtMs > deadline.budgetMs;
    }

    /**
     * Classifies a failure as an ABORT (the runtime cut the call short / the job
     * queue stopped) rather than an ordinary script error, by asking whether the
     * interrupt actually FIRED instead of matching on the engine's message text.
     *
     * TRAP: "the deadline has passed" is not the same question. The budget is
     * wall-clock, so a step that merely got descheduled — GC, a loaded CI box —
     * overruns it while running perfectly ordinary code; asking the deadline
     * would relabel that step's own `throw new Error("bad input")` as an abort
     * and poison a host whose `ta` state is intact. Only the interrupt truncates
     * a computation, so only the interrupt poisons. Slow-but-complete steps are
     * still reported, as a `step overshoot` host error.
     */
    function asAbort(err: unknown): QuickJsStepAbortedError | null {
        if (err instanceof QuickJsStepAbortedError) return err;
        if (interrupted) return new QuickJsStepAbortedError(message(err));
        return null;
    }

    function assertUsable(operation: string): void {
        if (poisoned) {
            throw new QuickJsStepAbortedError(
                `${operation} after an aborted step: this host is unusable, dispose and rebuild it`,
            );
        }
    }

    async function ensureState(): Promise<QuickJsState> {
        if (state !== null) return state;
        if (statePromise !== null) return statePromise;
        statePromise = Promise.resolve(quickJsFactory()).then((module) => {
            const runtime = module.newRuntime();
            runtime.setMemoryLimit(limits.maxHeapBytes);
            runtime.setInterruptHandler(() => {
                if (!deadlineExceeded()) return false;
                interrupted = true;
                return true;
            });
            const context = runtime.newContext();
            const installed = context.unwrapResult(
                context.evalCode(DISPATCHER_SOURCE, "chartlang-dispatcher.js"),
            );
            dispose(installed);
            state = Object.freeze({ runtime, context });
            return state;
        });
        return statePromise;
    }

    function postHostError(messageText: string): void {
        opts.onHostError?.(messageText);
    }

    return Object.freeze<ScriptHost>({
        async load(compiled) {
            const qjs = await ensureState();
            const frame: HostToQuickJs = {
                kind: "load",
                compiled: {
                    moduleSource: compiled.moduleSource,
                    manifest: compiled.manifest,
                },
                capabilities: opts.capabilities,
                ...(opts.symInfo === undefined ? {} : { symInfo: opts.symInfo }),
                ...(opts.resolveInputs === undefined
                    ? {}
                    : { inputOverrides: opts.resolveInputs(compiled.manifest.name) }),
                ...(opts.resolvePlotOverrides === undefined
                    ? {}
                    : { plotOverrides: opts.resolvePlotOverrides(compiled.manifest.name) }),
                ...(opts.resolveExternalSeries === undefined
                    ? {}
                    : { externalSeriesFeeds: opts.resolveExternalSeries(compiled.manifest.name) }),
                ...(opts.stateStoreKey === undefined ? {} : { stateStoreKey: opts.stateStoreKey }),
                ...(opts.sessionCalendar === undefined
                    ? {}
                    : { sessionCalendar: opts.sessionCalendar }),
                limits,
            };
            // A compiled module runs its TOP LEVEL here. Without a deadline that
            // code is not interruptible at all: a script that loops before its
            // default export wedges the whole isolate — no error, no timeout,
            // and no `Promise.race` on the caller's side can rescue a blocked
            // thread. `maxLoadTimeoutMs` had no enforcement point until now.
            armDeadline(limits.maxLoadTimeoutMs);
            let reply: QuickJsToHost;
            try {
                reply = await callAsyncJson(qjs, "__chartlang_load", frame);
            } catch (err) {
                const abort = asAbort(err);
                if (abort === null) throw err;
                poisoned = true;
                postHostError(abort.message);
                throw abort;
            } finally {
                deadline = null;
            }
            if (reply.kind === "loadError") {
                throw new Error(reply.message);
            }
            if (reply.kind === "fatal") {
                postHostError(reply.message);
                throw new Error(reply.message);
            }
        },
        async push(event) {
            if (poisoned) {
                postHostError(
                    "push after an aborted step: host is unusable, dispose and rebuild it",
                );
                return;
            }
            const qjs = await ensureState();
            const startedAt = performance.now();
            armDeadline(limits.maxStepMs);
            try {
                const reply = await callAsyncJson(qjs, "__chartlang_push", {
                    kind: "candleEvent",
                    event,
                });
                const observedMs = performance.now() - startedAt;
                if (observedMs > limits.maxStepMs) {
                    postHostError(`step overshoot ${observedMs.toFixed(2)}ms`);
                }
                if (reply.kind === "fatal") {
                    postHostError(reply.message);
                }
            } catch (err) {
                const text = message(err);
                // OOM keeps its existing semantics deliberately: the guest heap
                // is exhausted, not the computation truncated mid-bar.
                if (text.includes("out of memory") || text.includes("memory")) {
                    postHostError(`quickjs-oom: ${text}`);
                    return;
                }
                const abort = asAbort(err);
                if (abort !== null) {
                    // The step was cut mid-computation, so `ta` state is
                    // truncated. Continuing would emit silently wrong values on
                    // every later bar; refuse instead.
                    poisoned = true;
                    postHostError(abort.message);
                    return;
                }
                postHostError(text);
            } finally {
                deadline = null;
            }
        },
        setPlotOverrides(overrides) {
            const qjs = state;
            if (poisoned) {
                postHostError("setPlotOverrides after an aborted step");
                return;
            }
            if (qjs === null) {
                postHostError("setPlotOverrides before load");
                return;
            }
            const reply = callSyncJson(qjs, "__chartlang_setPlotOverrides", {
                kind: "setPlotOverrides",
                overrides,
            });
            if (reply.kind === "fatal") {
                postHostError(reply.message);
            }
        },
        setExternalSeries(feeds) {
            const qjs = state;
            if (poisoned) {
                postHostError("setExternalSeries after an aborted step");
                return;
            }
            if (qjs === null) {
                postHostError("setExternalSeries before load");
                return;
            }
            const reply = callSyncJson(qjs, "__chartlang_setExternalSeries", {
                kind: "setExternalSeries",
                feeds,
            });
            if (reply.kind === "fatal") {
                postHostError(reply.message);
            }
        },
        async drain() {
            assertUsable("drain");
            const qjs = await ensureState();
            const nonce = nonceCounter;
            nonceCounter += 1;
            // The QuickJS dispatcher's drain handler is synchronous host-side,
            // so the reply is available on the next line — no pending-reply
            // multiplexing is needed. The nonce is still echoed in the frame
            // for protocol parity with the worker host.
            const reply = callSyncJson(qjs, "__chartlang_drain", { kind: "drain", nonce });
            if (reply.kind === "emissions") {
                return validateDrain(reply.emissions);
            }
            if (reply.kind === "fatal") {
                postHostError(reply.message);
            }
            return {
                plots: [],
                drawings: [],
                alerts: [],
                alertConditions: [],
                orders: [],
                logs: [],
                diagnostics: [],
                fromBar: 0,
                toBar: 0,
            };
        },
        async exportSnapshot() {
            assertUsable("exportSnapshot");
            const qjs = await ensureState();
            const nonce = nonceCounter;
            nonceCounter += 1;
            const reply = callSyncJson(qjs, "__chartlang_exportSnapshot", {
                kind: "exportSnapshot",
                nonce,
            });
            if (reply.kind === "snapshot") {
                return reply.snapshot === null
                    ? null
                    : { key: reply.key, snapshot: reply.snapshot };
            }
            throw new SnapshotError(
                reply.kind === "snapshotError" ? reply.message : "exportSnapshot failed",
            );
        },
        async importSnapshot(exported: HostSnapshot) {
            assertUsable("importSnapshot");
            const qjs = await ensureState();
            const nonce = nonceCounter;
            nonceCounter += 1;
            const reply = callSyncJson(qjs, "__chartlang_importSnapshot", {
                kind: "importSnapshot",
                nonce,
                snapshot: exported.snapshot,
                key: exported.key,
            });
            if (reply.kind === "snapshotImported") {
                return { barIndex: reply.barIndex };
            }
            throw new SnapshotError(
                reply.kind === "snapshotError" ? reply.message : "importSnapshot failed",
            );
        },
        dispose() {
            const qjs = state;
            if (qjs !== null) {
                // Teardown must never inherit an expired budget: an armed
                // deadline interrupts the disposal drain below on its first
                // bytecode, the cleanup job never runs, and QuickJS then
                // asserts on a non-empty `gc_obj_list`. Disposal always works,
                // including on a poisoned host — otherwise nothing could ever
                // be cleaned up.
                deadline = null;
                try {
                    callDispose(qjs);
                } catch (err) {
                    postHostError(message(err));
                }
                qjs.context.dispose();
                // Guest runner disposal is async. Context teardown releases its
                // globals; drain the resulting promise job before freeing the
                // runtime or QuickJS asserts that gc_obj_list is not empty.
                // `qjs.context` is already disposed here, so it is passed as the
                // "live" context purely so the transient-error-context branch
                // never disposes it a second time.
                disposeJobsResult(qjs.runtime.executePendingJobs(), qjs.context);
                qjs.runtime.dispose?.();
                state = null;
                statePromise = null;
                poisoned = false;
            }
        },
        limits: hostLimits,
    });
}
