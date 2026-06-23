// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Shared shapes for the server-only daily-bar layer (Yahoo Finance source +
// SQLite cache). The browser-facing result type plus the typed errors the
// `/api/eod` route maps to friendly HTTP statuses. This module is
// type-only-ish (the error classes are the only runtime values) so the browser
// client (`src/lib/eodClient.ts`) can re-export the result type without dragging
// in `yahoo.ts` / `cache.ts` (which touch the network + db).

import type { Bar } from "@invinite-org/chartlang-core"

/** Result of loading a symbol's daily bars. `source` is the cache outcome. */
export type LoadSymbolResult = {
  bars: Bar[]
  source: "cache" | "network"
}

// --- Typed errors (the route maps each to a friendly status) -----------------

/** Symbol failed the US-ticker allowlist (or Yahoo reported it unknown). */
export class InvalidSymbolError extends Error {
  constructor(symbol: string) {
    super(`"${symbol}" is not a recognised US daily symbol.`)
    this.name = "InvalidSymbolError"
  }
}

/** A network / non-2xx / malformed-response failure talking to the data source. */
export class MarketDataError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "MarketDataError"
  }
}
