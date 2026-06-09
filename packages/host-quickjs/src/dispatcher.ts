// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { createScriptRunner } from "@invinite-org/chartlang-runtime";
import type { Capabilities, RunnerEmissions } from "@invinite-org/chartlang-adapter-kit";
import type { CompiledScriptObject } from "@invinite-org/chartlang-core";
import { moduleSourceToScript } from "./moduleSourceToScript";
import type { HostToQuickJs, QuickJsToHost } from "./protocol";

type LoadFrame = Extract<HostToQuickJs, { readonly kind: "load" }>;
type PushFrame = Extract<HostToQuickJs, { readonly kind: "candleEvent" }>;
type DrainFrame = Extract<HostToQuickJs, { readonly kind: "drain" }>;
type ScriptRunnerHandle = ReturnType<typeof createScriptRunner>;

declare global {
    var __chartlang_compiled_default: CompiledScriptObject | undefined;
    var __chartlang_load: (json: string) => Promise<string>;
    var __chartlang_push: (json: string) => Promise<string>;
    var __chartlang_drain: (json: string) => string;
    var __chartlang_dispose: () => string;
}

let runner: ScriptRunnerHandle | null = null;
// biome-ignore lint/security/noGlobalEval: the QuickJS dispatcher captures the guest realm evaluator before hardening.
const loadEval: (source: string) => unknown = globalThis.eval;

function reply(frame: QuickJsToHost): string {
    return JSON.stringify(frame);
}

function message(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

function loadCompiled(source: string): CompiledScriptObject {
    globalThis.__chartlang_compiled_default = undefined;
    loadEval(moduleSourceToScript(source));
    const compiled = globalThis.__chartlang_compiled_default;
    if (compiled === undefined) {
        throw new Error("compiled module did not set a default export");
    }
    return compiled;
}

function hardenGuestGlobals(): void {
    Reflect.deleteProperty(globalThis, "eval");
    Reflect.deleteProperty(globalThis, "Function");
}

function reviveSet<T>(value: unknown): ReadonlySet<T> {
    if (Array.isArray(value)) {
        return new Set<T>(value as Array<T>);
    }
    return new Set<T>();
}

function reviveCapabilities(value: Capabilities): Capabilities {
    return {
        ...value,
        plots: reviveSet(value.plots),
        drawings: reviveSet(value.drawings),
        alerts: reviveSet(value.alerts),
        inputs: reviveSet(value.inputs),
        symInfoFields: reviveSet(value.symInfoFields),
    };
}

globalThis.__chartlang_load = async (json: string): Promise<string> => {
    try {
        const frame = JSON.parse(json) as LoadFrame;
        const compiled = loadCompiled(frame.compiled.moduleSource);
        runner = createScriptRunner({
            compiled,
            capabilities: reviveCapabilities(frame.capabilities),
            ...(frame.symInfo === undefined ? {} : { symInfo: frame.symInfo }),
            ...(frame.inputOverrides === undefined ? {} : { inputOverrides: frame.inputOverrides }),
        });
        hardenGuestGlobals();
        return reply({ kind: "loaded" });
    } catch (err) {
        return reply({ kind: "loadError", message: message(err) });
    }
};

globalThis.__chartlang_push = async (json: string): Promise<string> => {
    try {
        if (runner === null) {
            throw new Error("candleEvent before load");
        }
        const frame = JSON.parse(json) as PushFrame;
        await runner.push(frame.event);
        return reply({ kind: "ack" });
    } catch (err) {
        return reply({ kind: "fatal", message: message(err) });
    }
};

globalThis.__chartlang_drain = (json: string): string => {
    try {
        if (runner === null) {
            throw new Error("drain before load");
        }
        const frame = JSON.parse(json) as DrainFrame;
        const emissions: RunnerEmissions = runner.drain();
        return reply({ kind: "emissions", nonce: frame.nonce, emissions });
    } catch (err) {
        return reply({ kind: "fatal", message: message(err) });
    }
};

globalThis.__chartlang_dispose = (): string => {
    try {
        void runner?.dispose();
        runner = null;
        globalThis.__chartlang_compiled_default = undefined;
        return reply({ kind: "ack" });
    } catch (err) {
        return reply({ kind: "fatal", message: message(err) });
    }
};
