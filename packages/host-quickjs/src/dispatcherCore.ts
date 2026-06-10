// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { createScriptRunner } from "@invinite-org/chartlang-runtime";
import type { Capabilities, RunnerEmissions } from "@invinite-org/chartlang-adapter-kit";
import type { CompiledScriptObject } from "@invinite-org/chartlang-core";

import { moduleSourceToScript } from "./moduleSourceToScript";
import type { HostToQuickJs, QuickJsToHost } from "./protocol";

type LoadFrame = Extract<HostToQuickJs, { readonly kind: "load" }>;
type PushFrame = Extract<HostToQuickJs, { readonly kind: "candleEvent" }>;
type DrainFrame = Extract<HostToQuickJs, { readonly kind: "drain" }>;
type ScriptRunnerHandle = ReturnType<typeof createScriptRunner>;

/**
 * Dependencies injected into {@link createDispatcher}. Lifting these out of
 * module scope lets the unit tests exercise dispatcher behaviour in the host
 * realm without the side effects (eval-deletion, globalThis writes) that the
 * production guest entry — `dispatcher.ts` — performs.
 *
 * @since 0.5
 * @internal
 * @stable
 * @example
 *     const deps: DispatcherDeps = {
 *         loadEval: (src) => src,
 *         runnerFactory: () => ({ push: async () => {}, drain: () => ({}) as never, dispose: () => {} }) as never,
 *         getCompiledDefault: () => undefined,
 *         setCompiledDefault: () => {},
 *     };
 *     void deps;
 */
export type DispatcherDeps = Readonly<{
    loadEval: (source: string) => unknown;
    runnerFactory: typeof createScriptRunner;
    getCompiledDefault: () => CompiledScriptObject | undefined;
    setCompiledDefault: (value: CompiledScriptObject | undefined) => void;
}>;

/**
 * The four QuickJS-guest entrypoints the host calls across the JSON-string
 * membrane. They mirror {@link HostToQuickJs} kinds and always return a
 * JSON-string reply matching a {@link QuickJsToHost} frame.
 *
 * @since 0.5
 * @internal
 * @stable
 * @example
 *     declare const h: DispatcherHandlers;
 *     void h.load("{}");
 */
export type DispatcherHandlers = Readonly<{
    load: (json: string) => Promise<string>;
    push: (json: string) => Promise<string>;
    drain: (json: string) => string;
    dispose: () => string;
}>;

function reply(frame: QuickJsToHost): string {
    return JSON.stringify(frame);
}

function message(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
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

/**
 * Build the four dispatcher handlers around a host-injected dependency bag.
 * The factory keeps the per-context `runner` reference in closure so the
 * caller (`dispatcher.ts` in the guest realm, or a unit test in the host
 * realm) only has to wire the entrypoints onto the appropriate `globalThis`.
 *
 * Behaviour is identical to the in-realm dispatcher: `load` evaluates the
 * compiled module source via `deps.loadEval`, instantiates a runner, and
 * replies with `loaded` or `loadError`; `push` forwards the event and replies
 * with `ack` or `fatal`; `drain` snapshots emissions; `dispose` tears the
 * runner down. Errors are coerced to a string message and never thrown across
 * the membrane.
 *
 * @since 0.5
 * @internal
 * @stable
 * @example
 *     const handlers = createDispatcher({
 *         loadEval: () => undefined,
 *         runnerFactory: createScriptRunner,
 *         getCompiledDefault: () => undefined,
 *         setCompiledDefault: () => {},
 *     });
 *     void handlers.dispose();
 */
export function createDispatcher(deps: DispatcherDeps): DispatcherHandlers {
    let runner: ScriptRunnerHandle | null = null;

    function loadCompiled(source: string): CompiledScriptObject {
        deps.setCompiledDefault(undefined);
        deps.loadEval(
            `((Function, eval) => {\n${moduleSourceToScript(source)}\n})(undefined, undefined);`,
        );
        const compiled = deps.getCompiledDefault();
        if (compiled === undefined) {
            throw new Error("compiled module did not set a default export");
        }
        return compiled;
    }

    async function load(json: string): Promise<string> {
        try {
            const frame = JSON.parse(json) as LoadFrame;
            const compiled = loadCompiled(frame.compiled.moduleSource);
            runner = deps.runnerFactory({
                compiled,
                capabilities: reviveCapabilities(frame.capabilities),
                ...(frame.symInfo === undefined ? {} : { symInfo: frame.symInfo }),
                ...(frame.inputOverrides === undefined
                    ? {}
                    : { inputOverrides: frame.inputOverrides }),
            });
            return reply({ kind: "loaded" });
        } catch (err) {
            return reply({ kind: "loadError", message: message(err) });
        }
    }

    async function push(json: string): Promise<string> {
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
    }

    function drain(json: string): string {
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
    }

    function dispose(): string {
        try {
            void runner?.dispose();
            runner = null;
            deps.setCompiledDefault(undefined);
            return reply({ kind: "ack" });
        } catch (err) {
            return reply({ kind: "fatal", message: message(err) });
        }
    }

    return Object.freeze({ load, push, drain, dispose });
}
