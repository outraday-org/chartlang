// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { CompiledScriptObject, ComputeFn, ScriptManifest, Series } from "../types.js";

/**
 * Sentinel thrown when `output` / `withInputs` are called outside the
 * compiler-rewritten bundle path. The Phase-7 compiler statically
 * replaces every consumer-side `.output("title")` call site with a
 * synthesised `__chartlang_depOutput(...)` runtime call, and every
 * `.withInputs({...})` chain with a folded dep manifest, so these
 * bodies are unreachable when the bundle is loaded normally. Hand-
 * running an un-compiled script in a unit test hits the sentinel,
 * which is the desired failure.
 *
 * @since 0.7
 * @stable
 * @example
 *     try {
 *         depAccessorSentinel("output(\"line\")");
 *     } catch (err) {
 *         void (err as Error).message;
 *     }
 */
export const depAccessorSentinel = (name: string): never => {
    throw new Error(
        `${name} can only be called on a compiled chartlang indicator binding inside another indicator's compute body`,
    );
};

/**
 * Attach the {@link depAccessorSentinel}-backed `output` /
 * `withInputs` accessors to a `{ manifest, compute }` pair so the
 * `defineIndicator` / `defineAlert` / `defineDrawing` /
 * `defineAlertCondition` constructors return a complete
 * {@link CompiledScriptObject}. The compiler rewrites both accessors
 * to static dep lookups at bundle time — the throwing bodies only
 * fire when an un-compiled module is invoked directly.
 *
 * @since 0.7
 * @stable
 * @example
 *     declare const manifest: ScriptManifest;
 *     declare const compute: ComputeFn;
 *     const cs: CompiledScriptObject = attachDepAccessorSentinels({
 *         manifest,
 *         compute,
 *     });
 *     void cs;
 */
export const attachDepAccessorSentinels = (
    base: Readonly<{ manifest: ScriptManifest; compute: ComputeFn<never> }>,
): CompiledScriptObject => ({
    manifest: base.manifest,
    // The four constructors are generic over their concrete `inputs` schema,
    // so `opts.compute` is a `ComputeFn<ResolveComputeInputs<I>>` (its `inputs`
    // param is narrower than the runtime's `Record<string, unknown>` bag).
    // `ComputeFn<never>` accepts every such compute contravariantly with no
    // cast at the call sites; widening it back to the runtime-facing `ComputeFn`
    // is sound because the runtime always hands the real per-descriptor values
    // — the documented `ta`-style widening cast (see runtime/CLAUDE.md).
    compute: base.compute as ComputeFn,
    output: (name: string): Series<number> => depAccessorSentinel(`output("${name}")`),
    withInputs: (): CompiledScriptObject => depAccessorSentinel("withInputs"),
});
