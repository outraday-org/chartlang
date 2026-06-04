#!/usr/bin/env tsx
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * Bundle `src/workerBoot.ts` (and its transitive runtime / adapter-kit / core
 * imports) into a single browser-loadable ESM file at
 * `dist/worker-boot.js`. The main-side host loads this URL via
 * `new URL("./worker-boot.js", import.meta.url)` (see
 * `src/defaultWorkerFactory.ts`).
 *
 * Pinned esbuild flags: `bundle: true`, `format: "esm"`, `platform:
 * "browser"`, `target: "es2022"`. Matches the compiler's `bundle.ts`
 * surface.
 */

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import * as esbuild from "esbuild";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");

await esbuild.build({
    entryPoints: [resolve(ROOT, "src/workerBoot.ts")],
    outfile: resolve(ROOT, "dist/worker-boot.js"),
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    sourcemap: true,
    minify: false,
});
