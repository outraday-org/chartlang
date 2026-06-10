// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { ScriptManifest } from "@invinite-org/chartlang-core";

/**
 * Subset of `CompiledScript` the QuickJS host needs. Matches
 * host-worker's `HostCompiledScript` field shape while keeping this package
 * free of a compiler dependency.
 *
 * @since 0.5
 * @stable
 * @example
 *     const cs: QuickJsCompiledScript = {
 *         moduleSource: "export default { manifest: m, compute: () => {} };",
 *         manifest: {} as import("@invinite-org/chartlang-core").ScriptManifest,
 *     };
 *     void cs;
 */
export type QuickJsCompiledScript = Readonly<{
    moduleSource: string;
    manifest: ScriptManifest;
}>;

/**
 * Hard runtime caps for the QuickJS host. `maxHeapBytes` defaults to 64 MB per
 * PLAN §8.3; `maxStepMs` defaults to 1 ms per compute step.
 *
 * `maxLoadTimeoutMs` mirrors `host-worker`'s field for `ScriptHost` parity.
 * QuickJS does not actually boot asynchronously — it lazily evaluates the
 * dispatcher source inline on first `load()` — so the value is informational
 * and surfaced on `host.limits` only to keep the cross-host shape uniform.
 *
 * @since 0.5
 * @stable
 * @example
 *     const limits: QuickJsHostLimits = {
 *         maxHeapBytes: 64 * 1024 * 1024,
 *         maxStepMs: 1,
 *         maxLoadTimeoutMs: 30_000,
 *     };
 *     void limits;
 */
export type QuickJsHostLimits = Readonly<{
    maxHeapBytes: number;
    maxStepMs: number;
    maxLoadTimeoutMs: number;
}>;

/**
 * Disposable QuickJS handle slice used by the host membrane. The real
 * `quickjs-emscripten` handles expose more methods; the host only needs
 * explicit disposal.
 *
 * @since 0.5
 * @stable
 * @example
 *     const h: QuickJsHandleLike = { dispose: () => undefined };
 *     h.dispose();
 */
export type QuickJsHandleLike = {
    dispose(): void;
};

/**
 * Minimal structural context API the host uses. This keeps tests small while
 * remaining compatible with `quickjs-emscripten`'s concrete
 * `QuickJSContext`.
 *
 * @since 0.5
 * @stable
 * @example
 *     declare const ctx: QuickJsContextLike;
 *     void ctx.global;
 */
export type QuickJsContextLike = {
    readonly global: QuickJsHandleLike;
    readonly undefined: QuickJsHandleLike;
    evalCode(code: string, filename?: string): unknown;
    getProp(handle: QuickJsHandleLike, key: string): QuickJsHandleLike;
    newString(value: string): QuickJsHandleLike;
    callFunction(
        fn: QuickJsHandleLike,
        thisVal: QuickJsHandleLike,
        ...args: ReadonlyArray<QuickJsHandleLike>
    ): unknown;
    unwrapResult(result: unknown): QuickJsHandleLike;
    getString(handle: QuickJsHandleLike): string;
    resolvePromise(handle: QuickJsHandleLike): Promise<unknown>;
    dispose(): void;
};

/**
 * Minimal structural runtime API the host configures.
 *
 * @since 0.5
 * @stable
 * @example
 *     declare const runtime: QuickJsRuntimeLike;
 *     runtime.setMemoryLimit(64 * 1024 * 1024);
 */
export type QuickJsRuntimeLike = {
    setMemoryLimit(limitBytes: number): void;
    setInterruptHandler(cb: () => boolean): void;
    executePendingJobs(): unknown;
    newContext(): QuickJsContextLike;
    dispose?(): void;
};

/**
 * Factory seam for tests. Production callers omit it; the host then awaits
 * `getQuickJS()` and creates a runtime/context from the installed
 * `quickjs-emscripten` module.
 *
 * @since 0.5
 * @stable
 * @example
 *     const qjs: QuickJsLike = () => ({
 *         newRuntime: () => ({
 *             setMemoryLimit: () => undefined,
 *             setInterruptHandler: () => undefined,
 *             executePendingJobs: () => undefined,
 *             newContext: () => ({} as QuickJsContextLike),
 *         }),
 *     });
 *     void qjs;
 */
export type QuickJsLike = () =>
    | { newRuntime(): QuickJsRuntimeLike }
    | Promise<{ newRuntime(): QuickJsRuntimeLike }>;

/**
 * Mirrors `host-worker`'s `ScriptHost` shape for cross-host
 * interchangeability. The alias keeps symbol identity stable across packages.
 *
 * @since 0.5
 * @stable
 * @example
 *     declare const host: ScriptHost;
 *     host.dispose();
 */
export type ScriptHost = import("@invinite-org/chartlang-host-worker").ScriptHost;
