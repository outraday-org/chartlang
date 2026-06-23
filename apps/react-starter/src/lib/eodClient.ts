// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Browser-safe typed wrapper over the /api/eod server route. The UI (the
// SymbolPicker + chart load) imports ONLY this module — never src/lib/server/* —
// so the native db driver never reaches the client bundle. Parallels
// src/lib/scriptsClient.ts. The data source is Yahoo Finance (no API key).

import type { Bar } from "@invinite-org/chartlang-core"

import type { LoadSymbolResult } from "./server/eod/types"

/** The shape `loadSymbol` resolves to (bars + cache provenance). */
export type LoadedSymbol = {
  bars: Bar[]
  source: LoadSymbolResult["source"]
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

/**
 * Load a symbol's daily bars. A first load fetches from Yahoo + caches;
 * subsequent loads (and page reloads) serve from the SQLite cache with
 * `source:"cache"` and no network call. Rejects with a friendly message for an
 * unknown symbol or an upstream failure.
 */
export async function loadSymbol(symbol: string): Promise<LoadedSymbol> {
  return postOp<LoadedSymbol>({ op: "load", symbol })
}
