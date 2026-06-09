#!/usr/bin/env tsx
// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * Bundle the QuickJS-side dispatcher into a single neutral ESM file. The host
 * reads `dist/dispatcher.js` as a string and evaluates it inside QuickJS, so
 * every runtime / adapter-kit import must be included in this artifact.
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");

await esbuild.build({
    entryPoints: [resolve(ROOT, "src/dispatcher.ts")],
    outfile: resolve(ROOT, "dist/dispatcher.js"),
    bundle: true,
    format: "esm",
    platform: "neutral",
    target: "es2020",
    sourcemap: false,
    minify: false,
});
