// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Shared shapes for the server-only EODData layer: the raw response DTOs
// (mirroring the live OpenAPI spec at https://api.eoddata.com/openapi/v1.json),
// the browser-facing result/usage types, and the typed errors the route maps
// to friendly HTTP statuses. This module is type-only-ish (the error classes
// are the only runtime values) so the browser client can re-export the DTO
// types without dragging in `client.ts` / `cache.ts` (which touch the key + db).

import type { Bar } from "@invinite-org/chartlang-core"

/** A US symbol the picker can offer. `exchange` is EODData's exchange code. */
export type SymbolHit = {
  code: string
  name: string
  exchange: string
}

/** Result of loading a symbol's daily bars. `source` is the cache outcome. */
export type LoadSymbolResult = {
  bars: Bar[]
  source: "cache" | "network"
  /** Set when the quota was exhausted and we fell back to a stale cache. */
  quotaExceeded?: boolean
}

/** The per-UTC-day quota state for the UI badge. */
export type UsageInfo = {
  /** UTC `YYYY-MM-DD`. */
  day: string
  calls: number
  remaining: number
}

// --- Raw EODData response shapes (only the fields we consume) ----------------

/** A row from `GET /Symbol/List/{exchangeCode}`. */
export type EodSymbol = {
  code: string
  name: string
  exchangeCode: string
  type?: string | null
}

/** A row from `GET /Quote/List/{exchangeCode}/{symbolCode}?Interval=d`. */
export type EodQuote = {
  /** `yyyy-MM-dd` (daily) — parsed as a UTC midnight epoch. */
  dateStamp: string
  open: number
  high: number
  low: number
  close: number
  /** int64 in the spec; JSON delivers it as a number. */
  volume: number
}

// --- Typed errors (the route maps each to a friendly status) -----------------

/** No `EODDATA_API_KEY` set — surfaced as a friendly "set the key" message. */
export class MissingApiKeyError extends Error {
  constructor() {
    super("EODDATA_API_KEY is not set — add it to .env to load market data.")
    this.name = "MissingApiKeyError"
  }
}

/** Symbol failed the US-ticker allowlist BEFORE any fetch (no quota cost). */
export class InvalidSymbolError extends Error {
  constructor(symbol: string) {
    super(`"${symbol}" is not a US daily symbol (AMEX / NASDAQ / NYSE / OTCBB).`)
    this.name = "InvalidSymbolError"
  }
}

/** The free-tier daily quota is spent and no cache could satisfy the request. */
export class QuotaExceededError extends Error {
  constructor(limit: number) {
    super(`Out of EODData calls for today (${limit}/day). Cached symbols still work.`)
    this.name = "QuotaExceededError"
  }
}

/** A network / non-2xx failure talking to EODData. */
export class EodDataError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "EodDataError"
  }
}
