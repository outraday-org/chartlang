// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Browser-safe typed wrappers over the /api/eod server route. The UI (Task 6's
// SymbolPicker + chart load + usage badge) imports ONLY this module — never
// src/lib/server/* — so neither the native db driver nor the EODDATA_API_KEY
// ever reach the client bundle. Parallels src/lib/scriptsClient.ts.

import type { Bar } from "@invinite-org/chartlang-core"

// Re-export the browser-relevant DTO types from the server-only types module.
// `import type` is erased at build time, so this does NOT pull the server
// errors / fetch code into the client graph.
export type { SymbolHit, UsageInfo } from "./server/eod/types"

import type { LoadSymbolResult, SymbolHit, UsageInfo } from "./server/eod/types"

/** The shape `loadSymbol` resolves to (bars + cache provenance). */
export type LoadedSymbol = {
  bars: Bar[]
  source: LoadSymbolResult["source"]
  quotaExceeded?: boolean
}

async function postOp<T>(payload: Record<string, unknown>): Promise<T> {
  const res = await fetch("/api/eod", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  })
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : `request failed (${res.status})`)
  }
  return data as T
}

/** Search US symbols (cache-first on the server; no quota cost when warm). */
export async function searchSymbols(query: string): Promise<SymbolHit[]> {
  const { hits } = await postOp<{ hits: SymbolHit[] }>({ op: "search", query })
  return hits
}

/**
 * Load a symbol's daily bars. A first load fetches + caches; subsequent loads
 * (and page reloads) serve from the SQLite cache with `source:"cache"` and no
 * API call. When the daily quota is spent, `quotaExceeded` is set and `bars`
 * is the last cached history (or the call rejects if nothing is cached).
 */
export async function loadSymbol(symbol: string): Promise<LoadedSymbol> {
  return postOp<LoadedSymbol>({ op: "load", symbol })
}

/** Current per-UTC-day quota state for the usage badge. */
export async function getUsage(): Promise<UsageInfo> {
  const { usage } = await postOp<{ usage: UsageInfo }>({ op: "usage" })
  return usage
}
