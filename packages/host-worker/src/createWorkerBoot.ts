// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    CompiledScriptBundle,
    CompiledScriptObject,
    ScriptManifest,
} from "@invinite-org/chartlang-core";
import { createScriptRunner } from "@invinite-org/chartlang-runtime";

import { filterEmissions } from "./filterEmissions.js";
import { watchStep } from "./limits.js";
import type { HostToWorker, WorkerToHost } from "./protocol.js";
import type { CompiledModuleExport, HostLimits, ScriptRunnerHandle } from "./types.js";

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

// `Array.isArray` narrows to `any[]`, which does not subtract a
// `ReadonlyArray<T>` member from a union (TS #17002), so the single-object
// `__manifest` form needs this dedicated guard.
function isSingleManifest(
    manifest: ScriptManifest | ReadonlyArray<ScriptManifest> | undefined,
): manifest is ScriptManifest {
    return manifest !== undefined && !Array.isArray(manifest);
}

function isCompiledScriptObject(v: unknown): v is CompiledScriptObject {
    if (v === null || typeof v !== "object") return false;
    const o = v as { readonly compute?: unknown; readonly manifest?: unknown };
    return typeof o.compute === "function" && typeof o.manifest === "object" && o.manifest !== null;
}

/**
 * Bridge a dynamically-imported compiled module into the runtime's
 * single-or-bundle compiled-script shape. Detects the §22.10
 * indicator-composition bundle by either (a) the array form of
 * `__manifest` or (b) a non-empty `__dependencies` export — both are
 * additive over the Phase-1 single-script wire format. Single-script
 * callers see the same `mod.default` `CompiledScriptObject` they did
 * before, byte-identical.
 *
 * Sibling exports are recovered by reading each non-`default` manifest
 * entry's `exportName` off the array sidecar and pulling the matching
 * named export off the module namespace object. Entries the local
 * `isCompiledScriptObject` guard rejects are skipped silently so a
 * malformed bundle still loads its primary script.
 */
function buildBundleFromModule(
    mod: CompiledModuleExport,
): CompiledScriptObject | CompiledScriptBundle {
    const manifest = mod.__manifest;
    const dependencies = mod.__dependencies ?? [];
    const isBundle = Array.isArray(manifest) || dependencies.length > 0;
    if (!isBundle) {
        // Single-script form: the compiler's `__manifest` sidecar is the
        // authoritative manifest (it carries compiler-derived fields the
        // runtime `defineIndicator` cannot know — `requestedIntervals`,
        // `outputs`, `plots`, `maxLookback`). `mod.default.manifest` is the
        // runtime stub with those fields zeroed, so an MTF script would
        // never register its secondary streams if we used it directly.
        // `isBundle` is false here, so `manifest` (when present) is the
        // single-object form.
        if (isSingleManifest(manifest)) {
            return Object.freeze({ ...mod.default, manifest });
        }
        return mod.default;
    }
    const siblings: Array<{
        readonly exportName: string;
        readonly compiled: CompiledScriptObject;
    }> = [];
    if (Array.isArray(manifest)) {
        for (let i = 1; i < manifest.length; i += 1) {
            const entry = manifest[i];
            const exportName = entry.exportName;
            if (exportName === undefined || exportName === "default") continue;
            const compiled = mod[exportName];
            if (!isCompiledScriptObject(compiled)) continue;
            siblings.push(Object.freeze({ exportName, compiled }));
        }
    }
    const frozenDeps = dependencies.map((d) =>
        Object.freeze({
            localId: d.localId,
            compiled: d.compiled,
            ...(d.inputOverrides === undefined ? {} : { inputOverrides: d.inputOverrides }),
        }),
    );
    return Object.freeze({
        primary: mod.default,
        siblings: Object.freeze(siblings),
        dependencies: Object.freeze(frozenDeps),
    });
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
                const compiled = buildBundleFromModule(mod);
                runner = createScriptRunner({
                    compiled,
                    capabilities: msg.capabilities,
                    ...(msg.symInfo !== undefined ? { symInfo: msg.symInfo } : {}),
                    ...(msg.inputOverrides !== undefined
                        ? { inputOverrides: msg.inputOverrides }
                        : {}),
                    ...(msg.plotOverrides !== undefined
                        ? { plotOverrides: msg.plotOverrides }
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
                        () => r.push(msg.event),
                        limits.maxCpuMsPerStep,
                    );
                    if (overshoot > 0) {
                        scope.postMessage({ kind: "step-overshoot", observedMs: overshoot });
                    }
                    break;
                }
                case "setPlotOverrides": {
                    if (runner === null) {
                        throw new Error("setPlotOverrides before load");
                    }
                    runner.setPlotOverrides(msg.overrides);
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
                    await runner?.dispose();
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
