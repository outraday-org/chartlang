// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { createScriptRunner } from "@invinite-org/chartlang-runtime";
import type { CompiledScriptObject } from "@invinite-org/chartlang-core";

import { createDispatcher } from "./dispatcherCore";

declare global {
    var __chartlang_compiled_default: CompiledScriptObject | undefined;
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
});

globalThis.__chartlang_load = handlers.load;
globalThis.__chartlang_push = handlers.push;
globalThis.__chartlang_drain = handlers.drain;
globalThis.__chartlang_dispose = handlers.dispose;
