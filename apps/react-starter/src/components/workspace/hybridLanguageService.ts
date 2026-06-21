// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Hybrid language service for the workspace editor. The shipped
// `createLanguageService` exposes a `compileToDiagnostics` injection seam so
// browser hosts can route compilation through their own boundary. The local
// service still drives the pure-TS surface (hover, completions, signature
// help, definition, intervals); the injected callback POSTs `/api/compile`
// (Task 2's real-compiler route) and returns the server's diagnostics.
//
// The server returns `moduleSource` + `manifest` alongside the diagnostics;
// we forward both to a subscriber so the chart side hot-reloads from the same
// compile request the linter just made — no second compile, no in-browser
// compiler (which would crash through the esbuild stub). Ported from
// apps/site/src/components/demo/hybridLanguageService.ts (behaviour-faithful).

import { createLanguageService } from "@invinite-org/chartlang-language-service"
import type { LspDiagnostic } from "@invinite-org/chartlang-language-service"

/**
 * Successful compile result observed by the chart-side subscriber: exactly
 * the `{ moduleSource, manifest }` pair `host.load()` accepts.
 */
export type CompiledArtifact = Readonly<{
  moduleSource: string
  manifest: unknown
}>

/**
 * Status surface the React UI consumes — drives the editor's status line.
 */
export type CompileStatus =
  | Readonly<{ kind: "idle" }>
  | Readonly<{ kind: "compiling" }>
  | Readonly<{ kind: "ok"; errorCount: 0; warningCount: number }>
  | Readonly<{ kind: "error"; errorCount: number; warningCount: number }>
  | Readonly<{ kind: "transport-error"; message: string }>

type LocalService = ReturnType<typeof createLanguageService>

/**
 * Subscriber notified after every server compile, success or fail. The
 * `artifact` is non-null only on a successful compile; the page retains the
 * last good artifact when it is null, so the chart never blanks on an error.
 */
export type CompileObserver = (
  status: CompileStatus,
  artifact: CompiledArtifact | null,
  diagnostics: ReadonlyArray<LspDiagnostic>,
) => void

type ServerCompileResponse =
  | Readonly<{
      ok: true
      moduleSource: string
      manifest: unknown
      diagnostics: ReadonlyArray<LspDiagnostic>
    }>
  | Readonly<{ ok: false; diagnostics: ReadonlyArray<LspDiagnostic> }>

function isLspDiagnostic(value: unknown): value is LspDiagnostic {
  if (typeof value !== "object" || value === null) return false
  const obj = value as Record<string, unknown>
  return (
    typeof obj.severity === "string" &&
    typeof obj.code === "string" &&
    typeof obj.message === "string" &&
    typeof obj.range === "object"
  )
}

function parseDiagnostics(raw: unknown): ReadonlyArray<LspDiagnostic> {
  if (!Array.isArray(raw)) return []
  return raw.filter(isLspDiagnostic)
}

function parseResponse(raw: unknown): ServerCompileResponse {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, diagnostics: [] }
  }
  const obj = raw as Record<string, unknown>
  if (obj.ok === true) {
    const moduleSource = obj.moduleSource
    const manifest = obj.manifest
    if (typeof moduleSource !== "string" || manifest === undefined) {
      return { ok: false, diagnostics: parseDiagnostics(obj.diagnostics) }
    }
    return {
      ok: true,
      moduleSource,
      manifest,
      diagnostics: parseDiagnostics(obj.diagnostics),
    }
  }
  return { ok: false, diagnostics: parseDiagnostics(obj.diagnostics) }
}

function summarise(diagnostics: ReadonlyArray<LspDiagnostic>): {
  errorCount: number
  warningCount: number
} {
  let errorCount = 0
  let warningCount = 0
  for (const d of diagnostics) {
    if (d.severity === "error") errorCount += 1
    else if (d.severity === "warning") warningCount += 1
  }
  return { errorCount, warningCount }
}

/**
 * Build the hybrid service plus its observable side-channel. The editor's
 * linter extension calls `compileToDiagnostics` on its own debounce, so
 * Task 6 needs no extra debounce — set `lintDebounceMs` on the editor.
 */
export function createHybridLanguageService(observer: CompileObserver): LocalService {
  const compileToDiagnostics = async (
    source: string,
  ): Promise<ReadonlyArray<LspDiagnostic>> => {
    observer({ kind: "compiling" }, null, [])
    let response: Response
    try {
      response = await fetch("/api/compile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source }),
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      observer({ kind: "transport-error", message }, null, [])
      return []
    }
    if (!response.ok) {
      observer({ kind: "transport-error", message: `HTTP ${response.status}` }, null, [])
      return []
    }
    const parsed = parseResponse(await response.json())
    const { errorCount, warningCount } = summarise(parsed.diagnostics)
    if (parsed.ok) {
      const artifact: CompiledArtifact = {
        moduleSource: parsed.moduleSource,
        manifest: parsed.manifest,
      }
      observer(
        errorCount === 0
          ? { kind: "ok", errorCount: 0, warningCount }
          : { kind: "error", errorCount, warningCount },
        artifact,
        parsed.diagnostics,
      )
    } else {
      observer(
        { kind: "error", errorCount: Math.max(1, errorCount), warningCount },
        null,
        parsed.diagnostics,
      )
    }
    return parsed.diagnostics
  }

  return createLanguageService({ compileToDiagnostics })
}
