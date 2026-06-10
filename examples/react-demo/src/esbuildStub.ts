// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Browser-side stub for the `esbuild` module. The chartlang compiler
// (`@invinite-org/chartlang-compiler/src/bundle.ts`) does
// `import * as esbuild from "esbuild"` and calls `esbuild.build(...)` / —
// historically — `esbuild.transform(...)`. esbuild's real entrypoint is a
// native binary launcher that cannot resolve in a Vite browser graph, so
// vite.config.ts aliases `esbuild` to this file in the client build.
//
// The compile path is still exercised — it just runs server-side via the
// Vite dev plugin's `/api/compile` middleware (which loads esbuild
// directly in Node). The browser-side language service is constructed
// here only for the parts that do NOT need compilation: hover,
// completions, signature help, definition.

const BROWSER_ERROR =
    "esbuild is not available in the browser; compilation happens server-side via /api/compile";

type BuildResult = {
    readonly outputFiles: ReadonlyArray<{ readonly path: string; readonly text: string }>;
};

type TransformResult = {
    readonly code: string;
};

/**
 * Browser stub for `esbuild.build`. Always rejects — the real call runs
 * server-side inside the Vite dev plugin.
 */
export function build(): Promise<BuildResult> {
    return Promise.reject(new Error(BROWSER_ERROR));
}

/**
 * Browser stub for `esbuild.transform`. Same contract as {@link build}.
 */
export function transform(): Promise<TransformResult> {
    return Promise.reject(new Error(BROWSER_ERROR));
}

const stub = { build, transform };
export default stub;
