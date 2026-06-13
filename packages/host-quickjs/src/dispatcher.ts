// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { createScriptRunner } from "@invinite-org/chartlang-runtime";
import type { CompiledScriptObject, ScriptManifest } from "@invinite-org/chartlang-core";

import { createDispatcher } from "./dispatcherCore.js";

declare global {
    var __chartlang_compiled_default: CompiledScriptObject | undefined;
    /**
     * Drawn-sibling capture for §22.10 indicator-composition bundles.
     * The guest's rewritten `(globalThis.__chartlang_compiled_named =
     * globalThis.__chartlang_compiled_named || {})[name] = value;`
     * populates this map; the dispatcher reads it back when building
     * the `CompiledScriptBundle`.
     */
    var __chartlang_compiled_named: Readonly<Record<string, CompiledScriptObject>> | undefined;
    /**
     * Private-dep capture for §22.10 indicator-composition bundles.
     * The guest's rewritten `export const __dependencies = …;` lands
     * on this slot; the dispatcher mounts each entry as a `DepRunner`.
     */
    var __chartlang_compiled_dependencies:
        | ReadonlyArray<{
              readonly localId: string;
              readonly compiled: CompiledScriptObject;
              readonly inputOverrides?: Readonly<Record<string, unknown>>;
          }>
        | undefined;
    /**
     * Sidecar manifest capture. Single object for single-script bundles;
     * array for §22.10 multi-export bundles. The dispatcher branches on
     * `Array.isArray(...)` to pick the bundle path.
     */
    var __chartlang_compiled_manifest: ScriptManifest | ReadonlyArray<ScriptManifest> | undefined;
    var __chartlang_load: (json: string) => Promise<string>;
    var __chartlang_push: (json: string) => Promise<string>;
    var __chartlang_drain: (json: string) => string;
    var __chartlang_dispose: () => string;
}

// biome-ignore lint/security/noGlobalEval: the QuickJS dispatcher captures the guest realm evaluator before hardening.
const loadEval: (source: string) => unknown = globalThis.eval;

function hardenGuestGlobals(): void {
    Reflect.set(globalThis, "eval", undefined);
    Reflect.set(globalThis, "Function", undefined);
    Reflect.deleteProperty(globalThis, "eval");
    Reflect.deleteProperty(globalThis, "Function");
}

hardenGuestGlobals();

const handlers = createDispatcher({
    loadEval,
    runnerFactory: createScriptRunner,
    getCompiledDefault: () => globalThis.__chartlang_compiled_default,
    setCompiledDefault: (value) => {
        globalThis.__chartlang_compiled_default = value;
    },
    getCompiledNamed: () => globalThis.__chartlang_compiled_named,
    setCompiledNamed: (value) => {
        globalThis.__chartlang_compiled_named = value;
    },
    getCompiledDependencies: () => globalThis.__chartlang_compiled_dependencies,
    setCompiledDependencies: (value) => {
        globalThis.__chartlang_compiled_dependencies = value;
    },
    getCompiledManifest: () => globalThis.__chartlang_compiled_manifest,
    setCompiledManifest: (value) => {
        globalThis.__chartlang_compiled_manifest = value;
    },
});

globalThis.__chartlang_load = handlers.load;
globalThis.__chartlang_push = handlers.push;
globalThis.__chartlang_drain = handlers.drain;
globalThis.__chartlang_dispose = handlers.dispose;
