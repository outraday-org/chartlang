// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type {
    AdapterSymInfo,
    Capabilities,
    LogEmission,
    RunnerEmissions,
    RuntimeDiagnostic,
} from "@invinite-org/chartlang-adapter-kit";
import { validateEmission } from "@invinite-org/chartlang-adapter-kit";
import { getQuickJS } from "quickjs-emscripten";

import { DEFAULT_QUICKJS_LIMITS } from "./limits";
import type { HostToQuickJs, QuickJsToHost } from "./protocol";
import type {
    QuickJsContextLike,
    QuickJsHandleLike,
    QuickJsHostLimits,
    QuickJsLike,
    QuickJsRuntimeLike,
    ScriptHost,
} from "./types";

const HERE = dirname(fileURLToPath(import.meta.url));
const DISPATCHER_SOURCE = readFileSync(resolve(HERE, "../dist/dispatcher.js"), "utf8");

/**
 * Constructor options for {@link createQuickJsHost}.
 *
 * @since 0.5
 * @experimental
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
    });
}

function dispose(handle: QuickJsHandleLike): void {
    handle.dispose();
}

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
    const logs: LogEmission[] = partitionValidated(raw.logs, diagnostics, () => null);
    return {
        plots,
        drawings: raw.drawings,
        alerts,
        alertConditions,
        logs,
        diagnostics,
        fromBar: raw.fromBar,
        toBar: raw.toBar,
    };
}

async function resolveStringPromise(
    context: QuickJsContextLike,
    runtime: QuickJsRuntimeLike,
    handle: QuickJsHandleLike,
): Promise<string> {
    const pending = context.resolvePromise(handle);
    runtime.executePendingJobs();
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
    fnName: "__chartlang_drain",
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
 * @experimental
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
    let stepStartedAtMs: number | null = null;
    let nonceCounter = 0;

    async function ensureState(): Promise<QuickJsState> {
        if (state !== null) return state;
        if (statePromise !== null) return statePromise;
        statePromise = Promise.resolve(quickJsFactory()).then((module) => {
            const runtime = module.newRuntime();
            runtime.setMemoryLimit(limits.maxHeapBytes);
            runtime.setInterruptHandler(() => {
                if (stepStartedAtMs === null) return false;
                return performance.now() - stepStartedAtMs > limits.maxStepMs;
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
                limits,
            };
            const reply = await callAsyncJson(qjs, "__chartlang_load", frame);
            if (reply.kind === "loadError") {
                throw new Error(reply.message);
            }
            if (reply.kind === "fatal") {
                postHostError(reply.message);
                throw new Error(reply.message);
            }
        },
        async push(event) {
            const qjs = await ensureState();
            const startedAt = performance.now();
            stepStartedAtMs = startedAt;
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
                if (text.includes("out of memory") || text.includes("memory")) {
                    postHostError(`quickjs-oom: ${text}`);
                    return;
                }
                postHostError(text);
            } finally {
                stepStartedAtMs = null;
            }
        },
        async drain() {
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
                logs: [],
                diagnostics: [],
                fromBar: 0,
                toBar: 0,
            };
        },
        dispose() {
            const qjs = state;
            if (qjs !== null) {
                try {
                    callDispose(qjs);
                } catch (err) {
                    postHostError(message(err));
                }
                qjs.context.dispose();
                qjs.runtime.dispose?.();
                state = null;
                statePromise = null;
            }
        },
        limits: hostLimits,
    });
}
