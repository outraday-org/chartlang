// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { CandleEvent } from "@invinite-org/chartlang-adapter-kit";
import type { Bar, StateStoreKey } from "@invinite-org/chartlang-core";
import { stateStoreKeysEqual } from "@invinite-org/chartlang-core";
import { buildBundleFromModule, createScriptRunner } from "@invinite-org/chartlang-runtime";
import type { CompiledModuleExport, PersistentStateStore } from "@invinite-org/chartlang-runtime";

import { filterEmissions } from "./filterEmissions.js";
import { idbStateStore } from "./idbStateStore.js";
import { watchStep } from "./limits.js";
import type { HostToWorker, WorkerToHost } from "./protocol.js";
import type { HostLimits, ScriptRunnerHandle } from "./types.js";

/**
 * Duck-typed slice of the worker global scope the boot factory needs. Lets
 * tests drive `createWorkerBoot` against a `MessageChannel` port without
 * faking the full `WorkerGlobalScope`.
 *
 * @since 0.1
 * @stable
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

// The bar time the deferred warm start compares the stored snapshot against.
// A `history` frame with no bars carries none, so the arm survives to the next
// event rather than warm-starting against a fabricated cursor.
function firstBarTimeOf(event: CandleEvent): number | null {
    if (event.kind === "history") {
        const first: Bar | undefined = event.bars[0];
        return first === undefined ? null : first.time;
    }
    return event.bar.time;
}

function message(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

/**
 * Wire `scope` to the host-worker postMessage protocol. Lazily imports the
 * compiled module via a `data:` URL so the same code path runs inside a real
 * browser `Worker` and inside Node tests (`MessageChannel`-backed).
 *
 * Lifecycle:
 *
 * - `load` → dynamic import → `createScriptRunner(...)` → cache `limits`.
 *   Posts `loaded` on success or `loadError` on failure. An optional
 *   `persistence` descriptor builds the packaged IDB store around the frame's
 *   `stateStoreKey` and arms one deferred warm start. Optional
 *   `sessionCalendar` rows pass straight through; the runner builds the
 *   lookup.
 * - `candleEvent` → wrap dispatch in `watchStep(...)`; post `step-overshoot`
 *   when over budget. Errors map to `fatal`.
 * - `drain` → validate every plot / alert emission; sink malformed ones into
 *   the diagnostics array; post `emissions` with the original nonce.
 * - `exportSnapshot` / `importSnapshot` → capture / restore the runner state,
 *   answering with `snapshot` / `snapshotImported`, or the typed
 *   `snapshotError` (never `fatal`) when refused.
 * - `dispose` → release the runner; subsequent messages map to `fatal`.
 *
 * Frames are processed one at a time through a single promise chain. The
 * listener is `async`, so without it a second frame's body would start while
 * the first was still awaiting — which the ordering-sensitive verbs (deferred
 * warm start, "import before the first push") cannot tolerate.
 *
 * @since 0.1
 * @stable
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
    let stateStoreKey: StateStoreKey | null = null;
    let pushed = false;
    let pendingWarmStart = false;
    let queue: Promise<void> = Promise.resolve();

    async function handleLoad(msg: Extract<HostToWorker, { kind: "load" }>): Promise<void> {
        try {
            const mod = await importCompiledModule(msg.compiled.moduleSource);
            const compiled = buildBundleFromModule(mod);
            const key = msg.stateStoreKey ?? null;
            const store: PersistentStateStore | undefined =
                msg.persistence !== undefined && key !== null
                    ? idbStateStore({
                          key,
                          ...(msg.persistence.dbName === undefined
                              ? {}
                              : { dbName: msg.persistence.dbName }),
                          ...(msg.persistence.capBytes === undefined
                              ? {}
                              : { capBytes: msg.persistence.capBytes }),
                      })
                    : undefined;
            runner = createScriptRunner({
                compiled,
                capabilities: msg.capabilities,
                ...(msg.symInfo !== undefined ? { symInfo: msg.symInfo } : {}),
                ...(msg.inputOverrides !== undefined ? { inputOverrides: msg.inputOverrides } : {}),
                ...(msg.plotOverrides !== undefined ? { plotOverrides: msg.plotOverrides } : {}),
                ...(msg.externalSeriesFeeds !== undefined
                    ? { externalSeriesFeeds: msg.externalSeriesFeeds }
                    : {}),
                ...(store === undefined ? {} : { persistentStateStore: store }),
                ...(msg.sessionCalendar === undefined
                    ? {}
                    : { sessionCalendar: msg.sessionCalendar }),
            });
            limits = msg.limits;
            stateStoreKey = key;
            pushed = false;
            pendingWarmStart = store !== undefined;
            scope.postMessage({ kind: "loaded" });
        } catch (err) {
            scope.postMessage({ kind: "loadError", message: message(err) });
        }
    }

    function handleExportSnapshot(nonce: number): WorkerToHost {
        if (runner === null) {
            return { kind: "snapshotError", nonce, message: "exportSnapshot before load" };
        }
        // No try/catch: "before load" is the only REFUSAL this verb has, and a
        // capture that cannot be validated returns `null` rather than throwing.
        // Anything else escaping the runtime here is a genuine internal failure
        // and belongs on the `fatal` channel, like `drain`'s.
        return { kind: "snapshot", nonce, snapshot: runner.exportSnapshot(), key: stateStoreKey };
    }

    function handleImportSnapshot(
        msg: Extract<HostToWorker, { kind: "importSnapshot" }>,
    ): WorkerToHost {
        if (runner === null) {
            return {
                kind: "snapshotError",
                nonce: msg.nonce,
                message: "importSnapshot before load",
            };
        }
        if (pushed) {
            return {
                kind: "snapshotError",
                nonce: msg.nonce,
                message: "importSnapshot after the first push",
            };
        }
        if (!stateStoreKeysEqual(msg.key, stateStoreKey)) {
            return {
                kind: "snapshotError",
                nonce: msg.nonce,
                message: "importSnapshot state store key mismatch",
            };
        }
        try {
            const { barIndex } = runner.importSnapshot(msg.snapshot);
            return { kind: "snapshotImported", nonce: msg.nonce, barIndex };
        } catch (err) {
            return { kind: "snapshotError", nonce: msg.nonce, message: message(err) };
        }
    }

    async function handleCandleEvent(event: CandleEvent): Promise<void> {
        if (runner === null || limits === null) {
            throw new Error("candleEvent before load");
        }
        const r = runner;
        if (pendingWarmStart) {
            const barTime = firstBarTimeOf(event);
            if (barTime !== null) {
                pendingWarmStart = false;
                await r.warmStart(barTime);
            }
        }
        pushed = true;
        const { overshoot } = await watchStep(() => r.push(event), limits.maxCpuMsPerStep);
        if (overshoot > 0) {
            scope.postMessage({ kind: "step-overshoot", observedMs: overshoot });
        }
    }

    async function handleFrame(msg: HostToWorker): Promise<void> {
        if (msg.kind === "load") {
            await handleLoad(msg);
            return;
        }

        try {
            switch (msg.kind) {
                case "candleEvent": {
                    await handleCandleEvent(msg.event);
                    break;
                }
                case "setPlotOverrides": {
                    if (runner === null) {
                        throw new Error("setPlotOverrides before load");
                    }
                    runner.setPlotOverrides(msg.overrides);
                    break;
                }
                case "setExternalSeries": {
                    if (runner === null) {
                        throw new Error("setExternalSeries before load");
                    }
                    runner.setExternalSeries(msg.feeds);
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
                case "exportSnapshot": {
                    scope.postMessage(handleExportSnapshot(msg.nonce));
                    break;
                }
                case "importSnapshot": {
                    scope.postMessage(handleImportSnapshot(msg));
                    break;
                }
                case "dispose": {
                    await runner?.dispose();
                    runner = null;
                    limits = null;
                    stateStoreKey = null;
                    pushed = false;
                    pendingWarmStart = false;
                    break;
                }
                default: {
                    throw new Error(
                        `unknown frame kind: ${(msg as { readonly kind: string }).kind}`,
                    );
                }
            }
        } catch (err) {
            scope.postMessage({ kind: "fatal", message: message(err) });
        }
    }

    scope.addEventListener("message", (ev: MessageEvent<HostToWorker>) => {
        const msg = ev.data;
        if (!isFrame(msg)) {
            scope.postMessage({
                kind: "fatal",
                message: "malformed host frame: not a plain object with a string 'kind'",
            });
            return;
        }
        queue = queue.then(() => handleFrame(msg));
        return queue;
    });
}
