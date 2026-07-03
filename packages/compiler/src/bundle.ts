// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { ScriptManifest } from "@invinite-org/chartlang-core";
import * as esbuild from "esbuild";

/**
 * Options accepted by `bundleModule`. `transformedSource` is the printed text
 * of the callsite-id-injected `ts.SourceFile`; `sourcePath` becomes the
 * sourcemap `sourcefile` field; `sourcemap` mirrors the compile API contract;
 * `minify` toggles esbuild's minifier.
 *
 * `inlinedProducers` is the §22.10 indicator-composition extension — when
 * non-empty, the bundler synthesises the `__chartlang_depOutput` runtime
 * shim and concatenates each producer's pre-rewritten TS source ahead of
 * the consumer's. The producer source must already have its `export
 * default <expr>` / `export const <name>` lines rewritten to local
 * `const __producer_<hash>__default = …` / `const __producer_<hash>__<name>
 * = …` form and its top-level `import` lines stripped so the combined
 * source parses as one ESM module.
 *
 * @since 0.1
 * @example
 *     const opts: BundleModuleOptions = {
 *         transformedSource: "export default {};",
 *         sourcePath: "demo.chart.ts",
 *         sourcemap: false,
 *         minify: false,
 *     };
 */
export type BundleModuleOptions = Readonly<{
    transformedSource: string;
    sourcePath: string;
    sourcemap: boolean | "inline" | "external";
    minify: boolean;
    inlinedProducers?: ReadonlyArray<InlinedProducer>;
    inMemoryModules?: Readonly<Record<string, string>>;
}>;

/**
 * One pre-rewritten cross-file producer the bundler inlines ahead of the
 * consumer's source. `hash` is a stable identifier derived from the
 * producer's absolute path; `rewrittenSource` is the producer's printed
 * TS source with `export` statements lowered to local `const`s and
 * top-level `import`s stripped.
 *
 * @since 0.7
 * @stable
 * @example
 *     const p: InlinedProducer = {
 *         hash: "a1b2c3",
 *         rewrittenSource: "const __producer_a1b2c3__default = {};",
 *     };
 *     void p;
 */
export type InlinedProducer = Readonly<{
    readonly hash: string;
    readonly rewrittenSource: string;
}>;

/**
 * Result of `bundleModule`. `moduleSource` is the ESM output; `sourcemap` is
 * the external map JSON when `sourcemap === true | "external"` and omitted
 * when `sourcemap === false | "inline"`. Inline sourcemaps land inside
 * `moduleSource` as a base64 `sourceMappingURL` comment.
 *
 * @since 0.1
 * @example
 *     const result: BundleModuleResult = { moduleSource: "export default {};" };
 *     void result;
 */
export type BundleModuleResult = Readonly<{
    moduleSource: string;
    sourcemap?: string;
}>;

// The compiler package directory — esbuild's `resolveDir` so the workspace
// `@invinite-org/chartlang-core` bare specifier resolves through the compiler
// package's own `node_modules/` symlink. Computed once at module load.
const COMPILER_PACKAGE_DIR = dirname(dirname(fileURLToPath(import.meta.url)));

// `__chartlang_depOutput` is the runtime helper that lets inlined producers
// read each other's titled outputs via `__chartlang_depOutput(slotId,
// depLocalId, title)`. When `@invinite-org/chartlang-runtime` ≥ 0.7 mounts
// the bundle, it sets `globalThis.__chartlang_depOutput` before evaluation;
// otherwise the throwing fallback signals a runtime / compiler skew. The
// shim keeps the §5.2 "zero remaining `import` statements" contract intact.
const DEP_OUTPUT_SHIM = `const __chartlang_depOutput = globalThis.__chartlang_depOutput ?? (() => { throw new Error("@invinite-org/chartlang-runtime >= 0.7 is required to evaluate this bundle"); });`;

const IN_MEMORY_NAMESPACE = "chartlang-in-memory";

/**
 * Build an esbuild plugin that resolves the bare specifiers in `modules`
 * to in-memory ESM contents instead of the filesystem. Used by hosts that
 * run the compiler where the workspace `@invinite-org/chartlang-*`
 * packages are not resolvable on disk (e.g. a bundled serverless function
 * where the packages were inlined into the host bundle, not installed as
 * node_modules). The contents must be self-contained ESM (no remaining
 * bare imports), since they are loaded in their own namespace.
 */
function inMemoryModulesPlugin(modules: Readonly<Record<string, string>>): esbuild.Plugin {
    return {
        name: "chartlang-in-memory-modules",
        setup(build) {
            const filter = /.*/;
            build.onResolve({ filter }, (args) =>
                Object.hasOwn(modules, args.path)
                    ? { path: args.path, namespace: IN_MEMORY_NAMESPACE }
                    : null,
            );
            build.onLoad({ filter, namespace: IN_MEMORY_NAMESPACE }, (args) => ({
                contents: modules[args.path],
                loader: "js",
                resolveDir: COMPILER_PACKAGE_DIR,
            }));
        },
    };
}

/**
 * Drive esbuild's `build` API against an in-memory transformed TS source and
 * emit a self-contained ESM bundle. Pinned flags: `bundle: true`,
 * `loader: "ts"`, `format: "esm"`, `target: "es2022"`, `treeShaking: true`,
 * `platform: "neutral"`. Bare specifiers like
 * `@invinite-org/chartlang-core` resolve through the compiler package's own
 * `node_modules/` (i.e. `resolveDir` is fixed to the compiler package dir),
 * so the output has zero remaining `import` statements and can load from a
 * `data:` URL inside any host (worker / QuickJS / Node) without a module
 * resolver. Output is ~5–50 KB unminified per PLAN §5.2.
 *
 * @since 0.1
 * @example
 *     // const { moduleSource } = await bundleModule({
 *     //     transformedSource: "export default {};",
 *     //     sourcePath: "demo.chart.ts",
 *     //     sourcemap: false,
 *     //     minify: false,
 *     // });
 *     const fn: typeof bundleModule = bundleModule;
 *     void fn;
 */
export async function bundleModule(opts: BundleModuleOptions): Promise<BundleModuleResult> {
    const esbuildSourcemap: esbuild.BuildOptions["sourcemap"] =
        opts.sourcemap === false ? false : opts.sourcemap === "inline" ? "inline" : "external";

    const wantsExternalMap = opts.sourcemap === true || opts.sourcemap === "external";
    const producers = opts.inlinedProducers ?? [];
    const combinedSource =
        producers.length === 0
            ? opts.transformedSource
            : `${DEP_OUTPUT_SHIM}\n${producers.map((p) => p.rewrittenSource).join("\n")}\n${opts.transformedSource}`;

    const inMemoryModules = opts.inMemoryModules ?? {};
    const hasInMemoryModules = Object.keys(inMemoryModules).length > 0;

    const buildOpts: esbuild.BuildOptions = {
        stdin: {
            contents: combinedSource,
            loader: "ts",
            sourcefile: opts.sourcePath,
            resolveDir: COMPILER_PACKAGE_DIR,
        },
        bundle: true,
        format: "esm",
        target: "es2022",
        platform: "neutral",
        sourcemap: esbuildSourcemap,
        sourcesContent: true,
        minify: opts.minify,
        treeShaking: true,
        write: false,
        ...(hasInMemoryModules ? { plugins: [inMemoryModulesPlugin(inMemoryModules)] } : {}),
        // `outfile` is required when `sourcemap: "external"`; the virtual path
        // never touches disk because `write: false`.
        ...(wantsExternalMap ? { outfile: `${opts.sourcePath}.js` } : {}),
    };

    const result = await esbuild.build(buildOpts);

    // `outputFiles` is only `undefined` when `write !== false`; we pin
    // `write: false` above so the runtime branch never fires. The defensive
    // throws keep the type narrow without bloating the coverage gate.
    const outputFiles = result.outputFiles ?? /* v8 ignore next */ [];
    const jsFile = outputFiles.find((f) => !f.path.endsWith(".map"));
    /* v8 ignore next 3 */
    if (jsFile === undefined) {
        throw new Error("esbuild produced no JS output file");
    }

    if (wantsExternalMap) {
        const mapFile = outputFiles.find((f) => f.path.endsWith(".map"));
        /* v8 ignore next 3 */
        if (mapFile === undefined) {
            throw new Error("esbuild produced no sourcemap file");
        }
        return Object.freeze({ moduleSource: jsFile.text, sourcemap: mapFile.text });
    }

    return Object.freeze({ moduleSource: jsFile.text });
}

/**
 * Synthesise the bottom-of-bundle `export const __manifest = …;` assignment.
 * The runtime reads this constant via dynamic `import(...)` to recover the
 * frozen `ScriptManifest` (or array of manifests, for multi-export files)
 * that travels alongside the compiled JS. Serialised via `JSON.stringify`
 * for determinism (insertion-order key emission).
 *
 * Single-object branch stays byte-identical to Phase 1 — no indent. The
 * array branch (one entry per drawn indicator in source order, default
 * first) is indented at 4 spaces for readability; runtimes branch on
 * `Array.isArray(__manifest)`.
 *
 * @since 0.1
 * @example
 *     // const line = formatManifestAssignment(manifest);
 *     // line === 'export const __manifest = {"apiVersion":1,…};\n'
 *     const fn: typeof formatManifestAssignment = formatManifestAssignment;
 *     void fn;
 */
export function formatManifestAssignment(
    manifestOrArray: ScriptManifest | ReadonlyArray<ScriptManifest>,
): string {
    const json = Array.isArray(manifestOrArray)
        ? JSON.stringify(manifestOrArray, null, 4)
        : JSON.stringify(manifestOrArray);
    return `export const __manifest = ${json};\n`;
}

// esbuild's ESM output always names the default export via a local binding —
// `var <slug>_chart_default = …; export { <slug>_chart_default as default };`
// (multiline when pretty, `;export{c as default};` when minified, and the
// clause may carry sibling co-exports). Anchored to a statement boundary
// (line start / `;` / `}`) so a bare `<word> as default` substring inside a
// string literal (e.g. a plot title "reset color as default") can never be
// captured as the binding name; `formatCompiledDefaultRebind` additionally
// takes the LAST anchored match, because esbuild hoists the export clause to
// the end of the module — nothing authored can follow it. `[^}]*?` keeps the
// scan inside the clause braces; the leading `\b` stops a mid-identifier
// suffix capture.
const DEFAULT_EXPORT_BINDING_RE =
    /(?:^|[;}])\s*export\s*\{[^}]*?\b([A-Za-z_$][\w$]*)\s+as\s+default\b/gm;

/**
 * Synthesise the tail line that makes a compiled bundle's `default` export
 * carry the **real** manifest instead of the author-eval stub. The stub the
 * `defineIndicator(...)` factory returns is frozen (its `.manifest` cannot be
 * reassigned in place under strict mode), so this rebuilds a fresh frozen
 * object from the stub's own props with the compiler-derived `primaryManifest`
 * and reassigns the esbuild default binding. Because `default` is exported via
 * a local `var` binding, the ESM live-binding contract makes `mod.default`
 * reflect the reassignment — so an integrator who feeds `mod.default` straight
 * into the runtime gets the real manifest (not the capacity-1-collapsing stub).
 *
 * The manifest JSON is inlined (not a reference to the `__manifest` const) so
 * the guest-realm source rewrite in `host-quickjs` — which turns
 * `export const __manifest = …` into a global assignment, erasing the binding —
 * never sees a dangling `__manifest` reference.
 *
 * @since 2.0
 * @stable
 * @example
 *     // const line = formatCompiledDefaultRebind(
 *     //     "export { demo_chart_default as default };\n",
 *     //     manifest,
 *     // );
 *     // line === 'demo_chart_default = Object.freeze({ ...demo_chart_default, manifest: {…} });\n'
 *     const fn: typeof formatCompiledDefaultRebind = formatCompiledDefaultRebind;
 *     void fn;
 */
export function formatCompiledDefaultRebind(
    moduleSource: string,
    primaryManifest: ScriptManifest,
): string {
    let binding: string | undefined;
    for (const match of moduleSource.matchAll(DEFAULT_EXPORT_BINDING_RE)) {
        binding = match[1];
    }
    if (binding === undefined) {
        throw new Error(
            "compiled bundle has no `<binding> as default` export to carry the manifest",
        );
    }
    return `${binding} = Object.freeze({ ...${binding}, manifest: ${JSON.stringify(primaryManifest)} });\n`;
}

/**
 * One inlined private-dep entry for the bundler's `__dependencies`
 * export. `localId` matches the `DependencyDeclaration.localId` on the
 * consumer's manifest; `bindingExpression` is the JS expression the
 * runtime walks to reach the dep's compiled `{ manifest, compute }`
 * object. In Phase-7, `bindingExpression === localId` because the
 * compiler keys deps by their JS binding name and the bundler
 * preserves the top-level `const` declaration.
 *
 * `effectiveInputs` carries the merged `.withInputs({...})` overrides
 * the consumer applied to its alias binding. When present and
 * non-empty, the runtime feeds it into the `DepRunner` as the dep's
 * input overrides so the producer's `compute` reads the consumer-
 * supplied values instead of its own manifest defaults. Empty / absent
 * for direct `defineIndicator(...)` private deps.
 *
 * @since 0.7
 * @stable
 * @example
 *     const entry: DependencyAssignmentEntry = {
 *         localId: "base",
 *         bindingExpression: "base",
 *     };
 *     void entry;
 */
export type DependencyAssignmentEntry = Readonly<{
    readonly localId: string;
    readonly bindingExpression: string;
    readonly effectiveInputs?: Readonly<Record<string, unknown>>;
}>;

/**
 * Synthesise the bottom-of-bundle `export const __dependencies = […];`
 * assignment that exposes private-dep `CompiledScriptObject` instances
 * to the host. Hosts mount each entry as a `DepRunner` (Task 4); the
 * binding reference keeps esbuild's tree-shaker from dropping the
 * compiled module-local `const` that produced it.
 *
 * Returns the empty string when `deps` is empty so single-script
 * bundles stay byte-identical to the Phase 1/2/3 baseline.
 *
 * @since 0.7
 * @stable
 * @example
 *     // const line = formatDependenciesAssignment([
 *     //     { localId: "base", bindingExpression: "base" },
 *     // ]);
 *     // line === 'export const __dependencies = [\n    { localId: "base", compiled: base },\n];\n'
 *     const fn: typeof formatDependenciesAssignment = formatDependenciesAssignment;
 *     void fn;
 */
export function formatDependenciesAssignment(
    deps: ReadonlyArray<DependencyAssignmentEntry>,
): string {
    if (deps.length === 0) return "";
    const entries = deps
        .map((d) => {
            const overrides =
                d.effectiveInputs !== undefined && Object.keys(d.effectiveInputs).length > 0
                    ? `, inputOverrides: ${JSON.stringify(d.effectiveInputs)}`
                    : "";
            return `    { localId: ${JSON.stringify(d.localId)}, compiled: ${d.bindingExpression}${overrides} },`;
        })
        .join("\n");
    return `export const __dependencies = [\n${entries}\n];\n`;
}
