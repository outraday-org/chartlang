// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Server-only chartlang compile helper. The `handleCompile` body is the
// canonical compile-then-diagnose flow; the request/response plumbing
// lives in the TanStack Start server route at routes/api/compile.ts.
//
// This module imports the real compiler + language service, which pull
// in `esbuild` and `node:*` builtins. It MUST stay out of the browser
// graph: the only importer is the server route, which TanStack Start
// keeps in its server bundle. Do NOT import this from any component.

import { CompileError, compile } from "@invinite-org/chartlang-compiler"
import { createLanguageService } from "@invinite-org/chartlang-language-service"
// @ts-expect-error virtual module provided by the chartlangCoreBundles Vite plugin
import coreBundles from "virtual:chartlang-core-bundles"

import { ensureTsDefaultLibsPatched } from "./tsDefaultLibs"

const IN_MEMORY_MODULES: Readonly<Record<string, string>> = coreBundles

/**
 * Successful compile response. `moduleSource` + `manifest` flow straight
 * into `adapter.host.load(...)`; `diagnostics` is the (possibly empty)
 * LSP-style array the editor's linter consumes.
 */
export type CompileSuccess = Readonly<{
  ok: true
  moduleSource: string
  manifest: unknown
  diagnostics: ReadonlyArray<unknown>
}>

/**
 * Failed compile response — script had at least one error-severity
 * diagnostic. The browser keeps its last good chart and surfaces the
 * diagnostics in the gutter / status bar.
 */
export type CompileFailure = Readonly<{
  ok: false
  diagnostics: ReadonlyArray<unknown>
}>

const SOURCE_PATH = "demo.chart.ts"

// The route is public and the compiler does real CPU work (esbuild), so
// cap the source far above any realistic `.chart.ts` to blunt abuse as a
// general-purpose TS compile endpoint. Oversized bodies fail as a normal
// compile failure (no diagnostics), not a 500.
const MAX_SOURCE_LENGTH = 64 * 1024

/**
 * Run the real chartlang compiler (and the language service's
 * `compileToDiagnostics` for mapped LSP errors) over `source`. Returns
 * the compiled triple on success, or the diagnostics on a CompileError.
 */
export async function handleCompile(
  source: string,
): Promise<CompileSuccess | CompileFailure> {
  if (source.length > MAX_SOURCE_LENGTH) {
    return { ok: false, diagnostics: [] }
  }
  ensureTsDefaultLibsPatched()
  const languageService = createLanguageService()
  const diagnostics = await languageService.compileToDiagnostics(source)
  try {
    const compiled = await compile(source, {
      apiVersion: 1,
      sourcePath: SOURCE_PATH,
      inMemoryModules: IN_MEMORY_MODULES,
    })
    return {
      ok: true,
      moduleSource: compiled.moduleSource,
      manifest: compiled.manifest,
      diagnostics,
    }
  } catch (err) {
    if (err instanceof CompileError) {
      return { ok: false, diagnostics }
    }
    throw err
  }
}
