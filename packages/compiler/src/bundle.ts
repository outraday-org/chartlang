// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import type { ScriptManifest } from "@invinite-org/chartlang-core";
import * as esbuild from "esbuild";

/**
 * Options accepted by `bundleModule`. `transformedSource` is the printed text
 * of the callsite-id-injected `ts.SourceFile`; `sourcePath` becomes the
 * sourcemap `sourcefile` field; `sourcemap` mirrors the compile API contract;
 * `minify` toggles esbuild's minifier.
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

    const buildOpts: esbuild.BuildOptions = {
        stdin: {
            contents: opts.transformedSource,
            loader: "ts",
            sourcefile: opts.sourcePath,
            resolveDir: COMPILER_PACKAGE_DIR,
        },
        bundle: true,
        format: "esm",
        target: "es2022",
        platform: "neutral",
        sourcemap: esbuildSourcemap,
        minify: opts.minify,
        treeShaking: true,
        write: false,
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
 * frozen `ScriptManifest` that travels alongside the compiled JS. Serialised
 * via `JSON.stringify` for determinism (insertion-order key emission).
 *
 * @since 0.1
 * @example
 *     // const line = formatManifestAssignment(manifest);
 *     // line === 'export const __manifest = {"apiVersion":1,…};\n'
 *     const fn: typeof formatManifestAssignment = formatManifestAssignment;
 *     void fn;
 */
export function formatManifestAssignment(manifest: ScriptManifest): string {
    return `export const __manifest = ${JSON.stringify(manifest)};\n`;
}
