#!/usr/bin/env tsx
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * Bundle the QuickJS-side dispatcher into a single neutral ESM file. The host
 * reads `dist/dispatcher.js` as a string and evaluates it inside QuickJS, so
 * every runtime / adapter-kit import must be included in this artifact.
 *
 * The shared `bundleDispatcher` factory is also imported by
 * `src/dispatcherFreshness.test.ts` to regenerate the bundle in-memory and
 * assert byte-for-byte equality with the committed `dist/dispatcher.js` —
 * stale-bundle detection. Keep the esbuild flags as the single source of
 * truth so the freshness gate cannot drift from the build itself.
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");

/**
 * Absolute path to the bundle entry — `src/dispatcher.ts`.
 */
export const DISPATCHER_ENTRY = resolve(ROOT, "src/dispatcher.ts");

/**
 * Absolute path to the committed bundle output — `dist/dispatcher.js`.
 */
export const DISPATCHER_OUTFILE = resolve(ROOT, "dist/dispatcher.js");

/**
 * Frozen esbuild flag set. Shared between `pnpm build:dispatcher` and the
 * freshness gate; keeping a single source of truth means the test cannot
 * silently drift from the build.
 *
 * `sourcemap: false` and `minify: false` are load-bearing for determinism —
 * esbuild does not embed timestamps in plain bundles, so the output is
 * stable across runs as long as the inputs are stable. `absWorkingDir` is
 * pinned to the package root because esbuild's `// <path>` section comments
 * are cwd-relative; without the pin the bundle differs between `pnpm build`
 * (cwd = package dir) and the root vitest run (cwd = repo root), which made
 * the freshness gate fail spuriously.
 */
export const DISPATCHER_BUILD_OPTIONS = Object.freeze({
    entryPoints: [DISPATCHER_ENTRY],
    bundle: true,
    format: "esm" as const,
    platform: "neutral" as const,
    target: "es2020",
    sourcemap: false,
    minify: false,
    absWorkingDir: ROOT,
});

/**
 * Bundle the dispatcher into a UTF-8 string without writing it to disk.
 * Used by the freshness gate. Inherits every flag from
 * `DISPATCHER_BUILD_OPTIONS` and pins `write: false` so esbuild returns the
 * output via `outputFiles` instead.
 */
export async function bundleDispatcher(): Promise<string> {
    const result = await esbuild.build({
        ...DISPATCHER_BUILD_OPTIONS,
        write: false,
    });
    const files = result.outputFiles;
    if (files === undefined || files.length !== 1) {
        throw new Error(
            `expected exactly one output file, got ${files === undefined ? "undefined" : String(files.length)}`,
        );
    }
    const file = files[0];
    if (file === undefined) throw new Error("missing output file");
    return file.text;
}

const RUN_AS_SCRIPT = import.meta.url === `file://${process.argv[1]}`;

if (RUN_AS_SCRIPT) {
    await esbuild.build({
        ...DISPATCHER_BUILD_OPTIONS,
        outfile: DISPATCHER_OUTFILE,
    });
}
