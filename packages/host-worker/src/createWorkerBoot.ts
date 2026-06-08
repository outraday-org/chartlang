// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { CandleEvent } from "@invinite-org/chartlang-adapter-kit";
import { createScriptRunner } from "@invinite-org/chartlang-runtime";

import { filterEmissions } from "./filterEmissions";
import { watchStep } from "./limits";
import type { HostToWorker, WorkerToHost } from "./protocol";
import type { CompiledModuleExport, HostLimits, ScriptRunnerHandle } from "./types";

/**
 * Duck-typed slice of the worker global scope the boot factory needs. Lets
 * tests drive `createWorkerBoot` against a `MessageChannel` port without
 * faking the full `WorkerGlobalScope`.
 *
 * @since 0.1
 * @experimental
 * @example
 *     const scope: WorkerBootScope = {
 *         addEventListener: () => {},
 *         postMessage: () => {},
 *     };
 *     void scope;
 */
export type WorkerBootScope = {
    addEventListener(type: "message", listener: (ev: MessageEvent<HostToWorker>) => void): void;
    postMessage(msg: WorkerToHost): void;
};

function dispatchEvent(runner: ScriptRunnerHandle, event: CandleEvent): Promise<void> {
    switch (event.kind) {
        case "history":
            return runner.onHistory(event.bars);
        case "close":
            return runner.onBarClose(event.bar);
        case "tick":
            return runner.onBarTick(event.bar);
    }
}

async function importCompiledModule(moduleSource: string): Promise<CompiledModuleExport> {
    // `encodeURIComponent` preserves multi-byte UTF-8 across the data URL
    // without the Annex-B `unescape` round-trip. ESM `import("data:…")`
    // accepts percent-encoded text/javascript directly in both browsers
    // and Node 20+.
    const url = `data:text/javascript;charset=utf-8,${encodeURIComponent(moduleSource)}`;
    return (await import(/* @vite-ignore */ url)) as CompiledModuleExport;
}

function isFrame(value: unknown): value is HostToWorker {
    if (value === null || typeof value !== "object") return false;
    const k = (value as { readonly kind?: unknown }).kind;
    return typeof k === "string";
}

/**
 * Wire `scope` to the host-worker postMessage protocol. Lazily imports the
 * compiled module via a `data:` URL so the same code path runs inside a real
 * browser `Worker` and inside Node tests (`MessageChannel`-backed).
 *
 * Lifecycle:
 *
 * - `load` → dynamic import → `createScriptRunner(...)` → cache `limits`.
 *   Posts `loaded` on success or `loadError` on failure.
 * - `candleEvent` → wrap dispatch in `watchStep(...)`; post `step-overshoot`
 *   when over budget. Errors map to `fatal`.
 * - `drain` → validate every plot / alert emission; sink malformed ones into
 *   the diagnostics array; post `emissions` with the original nonce.
 * - `dispose` → release the runner; subsequent messages map to `fatal`.
 *
 * @since 0.1
 * @experimental
 * @example
 *     // import { createWorkerBoot } from "@invinite-org/chartlang-host-worker";
 *     // const scope = self;
 *     // createWorkerBoot(scope);
 *     const fn: typeof createWorkerBoot = createWorkerBoot;
 *     void fn;
 */
export function createWorkerBoot(scope: WorkerBootScope): void {
    let runner: ScriptRunnerHandle | null = null;
    let limits: HostLimits | null = null;

    scope.addEventListener("message", async (ev: MessageEvent<HostToWorker>) => {
        const msg = ev.data;
        if (!isFrame(msg)) {
            scope.postMessage({
                kind: "fatal",
                message: "malformed host frame: not a plain object with a string 'kind'",
            });
            return;
        }
        if (msg.kind === "load") {
            try {
                const mod = await importCompiledModule(msg.compiled.moduleSource);
                runner = createScriptRunner({
                    compiled: mod.default,
                    capabilities: msg.capabilities,
                    ...(msg.symInfo !== undefined ? { symInfo: msg.symInfo } : {}),
                    ...(msg.inputOverrides !== undefined
                        ? { inputOverrides: msg.inputOverrides }
                        : {}),
                });
                limits = msg.limits;
                scope.postMessage({ kind: "loaded" });
            } catch (err) {
                scope.postMessage({
                    kind: "loadError",
                    message: err instanceof Error ? err.message : String(err),
                });
            }
            return;
        }

        try {
            switch (msg.kind) {
                case "candleEvent": {
                    if (runner === null || limits === null) {
                        throw new Error("candleEvent before load");
                    }
                    const r = runner;
                    const { overshoot } = await watchStep(
                        () => dispatchEvent(r, msg.event),
                        limits.maxCpuMsPerStep,
                    );
                    if (overshoot > 0) {
                        scope.postMessage({ kind: "step-overshoot", observedMs: overshoot });
                    }
                    break;
                }
                case "drain": {
                    if (runner === null) {
                        throw new Error("drain before load");
                    }
                    const cleaned = filterEmissions(runner.drain());
                    scope.postMessage({
                        kind: "emissions",
                        nonce: msg.nonce,
                        emissions: cleaned,
                    });
                    break;
                }
                case "dispose": {
                    runner?.dispose();
                    runner = null;
                    limits = null;
                    break;
                }
                default: {
                    throw new Error(
                        `unknown frame kind: ${(msg as { readonly kind: string }).kind}`,
                    );
                }
            }
        } catch (err) {
            scope.postMessage({
                kind: "fatal",
                message: err instanceof Error ? err.message : String(err),
            });
        }
    });
}
