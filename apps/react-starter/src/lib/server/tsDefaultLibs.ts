// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Ported from apps/site/src/lib/server/tsDefaultLibs.ts (compiler
// invariant #3 — see apps/react-starter/CLAUDE.md).
//
// Server-only patch that makes the chartlang compiler's in-memory
// `ts.Program` resolve its default lib (`lib.es2022.d.ts` + the ES
// closure) without touching the host filesystem.
//
// The compiler builds its program with `ts.createCompilerHost`, which
// reads the default lib through `ts.sys.readFile` and locates it via
// `ts.sys.getExecutingFilePath()` → `node_modules/typescript/lib`. When
// the SSR server bundle is shipped without the sibling `lib.*.d.ts` data
// files (e.g. a future serverless deploy), that read returns `undefined`.
// With the compiler's `skipLibCheck` the failure is silent: the ambient
// core shim's `Readonly`/`Record` collapse to `any` and every valid
// `compute({ bar, ta, … })` destructure emits a spurious TS7031.
//
// `typescript` is external (a singleton), so the compiler and this module
// share one `ts.sys`. We patch `readFile`/`fileExists` to serve the lib
// text bundled by the `virtual:ts-default-libs` Vite plugin whenever the
// on-disk read misses. Keyed by basename so it works regardless of the
// bundle-relative path `getExecutingFilePath()` resolves to.

import ts from "typescript"
// @ts-expect-error virtual module provided by the tsDefaultLibs Vite plugin
import bundledLibs from "virtual:ts-default-libs"

const LIBS: Readonly<Record<string, string>> = bundledLibs
const LIB_FILE_RE = /lib\.[\w.]+\.d\.ts$/

function libContent(filePath: string): string | undefined {
  if (!LIB_FILE_RE.test(filePath)) return undefined
  const base = filePath.slice(filePath.lastIndexOf("/") + 1)
  return Object.hasOwn(LIBS, base) ? LIBS[base] : undefined
}

let patched = false

/**
 * Patch the shared `ts.sys` once so default-lib reads fall back to the
 * bundled ES lib text. Idempotent and safe to call before every compile.
 */
export function ensureTsDefaultLibsPatched(): void {
  if (patched) return
  patched = true
  const realReadFile = ts.sys.readFile.bind(ts.sys)
  const realFileExists = ts.sys.fileExists.bind(ts.sys)
  ts.sys.readFile = (path, encoding) => realReadFile(path, encoding) ?? libContent(path)
  ts.sys.fileExists = (path) => realFileExists(path) || libContent(path) !== undefined
}
