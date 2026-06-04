// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

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

/**
 * Drive esbuild's `transform` API against an in-memory transformed TS source.
 * Pinned flags: `loader: "ts"`, `format: "esm"`, `target: "es2022"`,
 * `treeShaking: true`. The bundler is single-file; cross-file imports are a
 * Phase 4+ concern (when `chartlang.config.ts` lands).
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
    const esbuildSourcemap: esbuild.TransformOptions["sourcemap"] =
        opts.sourcemap === false ? false : opts.sourcemap === "inline" ? "inline" : true;

    const result = await esbuild.transform(opts.transformedSource, {
        loader: "ts",
        format: "esm",
        target: "es2022",
        sourcemap: esbuildSourcemap,
        sourcefile: opts.sourcePath,
        minify: opts.minify,
        treeShaking: true,
    });

    if (opts.sourcemap === true || opts.sourcemap === "external") {
        return Object.freeze({ moduleSource: result.code, sourcemap: result.map });
    }
    return Object.freeze({ moduleSource: result.code });
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
