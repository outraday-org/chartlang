// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    CompiledScriptBundle,
    CompiledScriptObject,
    ScriptManifest,
} from "@invinite-org/chartlang-core";

/**
 * The ESM-export shape a dynamically-imported compiled bundle presents.
 * Matches `@invinite-org/chartlang-compiler`'s bundled output:
 *
 * - **Single-script** files export `default` + (compiled) `__manifest:
 *   ScriptManifest`.
 * - **Multi-export / composition** files (§22.10) additionally export one
 *   named const per drawn sibling (`mod[exportName]`), an array `__manifest:
 *   ReadonlyArray<ScriptManifest>` (default first), and — when the default
 *   manifest declares private deps — `__dependencies`.
 *
 * The `[exportName: string]: unknown` index signature keeps sibling reads
 * narrow; {@link buildBundleFromModule} walks `mod[exportName]` behind a
 * type guard before forwarding.
 *
 * @since 2.0
 * @stable
 * @example
 *     const m: CompiledModuleExport = {
 *         default: { manifest: {} as ScriptManifest, compute: () => {} },
 *     };
 *     void m;
 */
export type CompiledModuleExport = {
    readonly default: CompiledScriptObject;
    readonly __manifest?: ScriptManifest | ReadonlyArray<ScriptManifest>;
    readonly __dependencies?: ReadonlyArray<{
        readonly localId: string;
        readonly compiled: CompiledScriptObject;
        readonly inputOverrides?: Readonly<Record<string, unknown>>;
    }>;
    readonly [exportName: string]: unknown;
};

function isCompiledScriptObject(value: unknown): value is CompiledScriptObject {
    if (value === null || typeof value !== "object") return false;
    const candidate = value as Readonly<Record<string, unknown>>;
    return typeof candidate.compute === "function" && "manifest" in candidate;
}

// A manifest is "stub-shaped" when it matches the author-eval object
// `defineIndicator(...)` returns before the compiler runs: zero lookback, no
// plots, no series capacities, no feeds. This is the ONLY shape that is
// ambiguous between "a raw author-eval object misfed to the runtime" and "a
// genuinely trivial script" — and the presence of an `__manifest` sidecar
// disambiguates it (a compiled bundle always carries one), so this check is
// only ever consulted when `__manifest` is absent.
function isStubManifest(manifest: unknown): boolean {
    if (manifest === null || typeof manifest !== "object") return false;
    const m = manifest as {
        readonly maxLookback?: unknown;
        readonly plots?: unknown;
        readonly seriesCapacities?: unknown;
        readonly requestedFeeds?: unknown;
    };
    // The compiler OMITS `plots` / `requestedFeeds` when empty (never an empty
    // array) and always emits an object `seriesCapacities`, so matching the
    // exact author-stub shape needs only presence/emptiness checks.
    const caps = m.seriesCapacities;
    const emptyCapacities =
        typeof caps === "object" && caps !== null && Object.keys(caps).length === 0;
    return (
        m.maxLookback === 0 &&
        m.plots === undefined &&
        m.requestedFeeds === undefined &&
        emptyCapacities
    );
}

/**
 * The single module→runnable bridge every host uses. Given a compiled bundle's
 * module namespace, it merges the authoritative `__manifest` sidecar over
 * `mod.default` (single) or recovers the primary + siblings + private deps
 * (composition), returning the `CompiledScriptObject` or `CompiledScriptBundle`
 * that {@link createScriptRunner} expects.
 *
 * The `__manifest` sidecar is authoritative because it carries the
 * compiler-derived fields the runtime `defineIndicator` stub zeroes
 * (`requestedIntervals`, `outputs`, `plots`, `maxLookback`, `requestedFeeds`);
 * using `mod.default.manifest` for a bundle that predates the compiler's
 * default-rebind would collapse series capacity to `1` and drop secondary
 * feeds. When `__manifest` is absent AND `mod.default.manifest` is stub-shaped
 * the input is a raw author-eval `defineIndicator(...)` object rather than a
 * compiled bundle, which this throws on loudly instead of silently producing
 * all-NaN output.
 *
 * @since 2.0
 * @stable
 * @example
 *     // const compiled = buildBundleFromModule(await import(bundleUrl));
 *     // const runner = createScriptRunner({ compiled, capabilities });
 *     const fn: typeof buildBundleFromModule = buildBundleFromModule;
 *     void fn;
 */
export function buildBundleFromModule(
    mod: CompiledModuleExport,
): CompiledScriptObject | CompiledScriptBundle {
    const sidecar = mod.__manifest;
    const dependencies = mod.__dependencies ?? [];
    const primaryManifest: ScriptManifest | undefined = Array.isArray(sidecar)
        ? sidecar[0]
        : sidecar;

    if (primaryManifest === undefined) {
        if (isStubManifest(mod.default.manifest)) {
            throw new Error(
                "manifest-stub: module default carries a stub manifest (maxLookback 0, no plots/feeds) and no __manifest sidecar was found — pass a compiled bundle, not an author-eval object",
            );
        }
        return mod.default;
    }

    const primary: CompiledScriptObject = Object.freeze({
        ...mod.default,
        manifest: primaryManifest,
    });
    const isBundle = Array.isArray(sidecar) || dependencies.length > 0;
    if (!isBundle) {
        return primary;
    }

    const siblings: Array<{
        readonly exportName: string;
        readonly compiled: CompiledScriptObject;
    }> = [];
    if (Array.isArray(sidecar)) {
        for (let i = 1; i < sidecar.length; i += 1) {
            const exportName = sidecar[i].exportName;
            if (exportName === undefined || exportName === "default") continue;
            const compiled = mod[exportName];
            if (!isCompiledScriptObject(compiled)) continue;
            siblings.push(Object.freeze({ exportName, compiled }));
        }
    }
    return Object.freeze({
        primary,
        siblings: Object.freeze(siblings),
        dependencies: Object.freeze(
            dependencies.map((d) =>
                Object.freeze({
                    localId: d.localId,
                    compiled: d.compiled,
                    ...(d.inputOverrides === undefined ? {} : { inputOverrides: d.inputOverrides }),
                }),
            ),
        ),
    });
}
