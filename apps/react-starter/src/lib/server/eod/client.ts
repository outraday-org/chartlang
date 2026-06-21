// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// server-only — this module reads `EODDATA_API_KEY` and talks to the EODData
// HTTP API. It MUST NOT enter the client graph: it is reached only through the
// `src/routes/api/eod.ts` server-route handlers (via `cache.ts`), which
// TanStack Start keeps in the server bundle. Do NOT import it from any
// `src/components/*` file.
//
// API shapes resolved from the live OpenAPI spec
// (https://api.eoddata.com/openapi/v1.json — info.title "EODData API",
// version "v1"). The spec has no `servers` array and bare paths
// (`/Symbol/...`, `/Quote/...`); the served spec lives under `/openapi/v1.json`,
// so the request base is `https://api.eoddata.com/v1`. Auth is the `ApiKey`
// QUERY param (not a header). Both base + key are env-overridable.

import type { Bar } from "@invinite-org/chartlang-core"

import {
  EodDataError,
  InvalidSymbolError,
  MissingApiKeyError,
  type EodQuote,
  type EodSymbol,
  type SymbolHit,
} from "./types"

/** Default request base; override with `EODDATA_BASE_URL` (e2e points it local). */
const DEFAULT_BASE_URL = "https://api.eoddata.com/v1"

// Free tier: US equities only. EODData's exact exchange codes are confirmed at
// integration time; an unknown code degrades to an empty list / friendly error
// (never a crash) because every symbol is validated against the cached index.
const US_EXCHANGES = ["NASDAQ", "NYSE", "AMEX", "OTCBB"] as const

/** Daily EOD interval token per the spec's `Interval` enum (`d` = daily). */
const DAILY_INTERVAL = "d"

/** chartlang interval literal for a daily bar. */
const DAILY_BAR_INTERVAL = "1D"

/** Defensive spacing for the 10-calls/min free-tier limit (the cache is the
 * real protection — this just keeps a burst of cold loads polite). */
const MIN_INTERVAL_MS = 6_000

function baseUrl(): string {
  return process.env.EODDATA_BASE_URL ?? DEFAULT_BASE_URL
}

function apiKey(): string {
  const key = process.env.EODDATA_API_KEY
  if (!key || key.trim().length === 0) throw new MissingApiKeyError()
  return key
}

// A US ticker is 1–10 chars: a leading letter then letters/digits/`.`/`-`
// (e.g. BRK.B). Validation happens BEFORE any fetch so a bad symbol never
// costs a quota call. Callers upper-case first.
const US_TICKER = /^[A-Z][A-Z0-9.\-]{0,9}$/

/** Normalise + validate a user-supplied ticker; throws `InvalidSymbolError`. */
export function normalizeTicker(symbol: string): string {
  const up = symbol.trim().toUpperCase()
  if (!US_TICKER.test(up)) throw new InvalidSymbolError(symbol)
  return up
}

// --- Throttle: serialise network calls 6s apart -----------------------------

let lastCall = 0
let chain: Promise<void> = Promise.resolve()

function throttle(): Promise<void> {
  chain = chain.then(async () => {
    const wait = Math.max(0, lastCall + MIN_INTERVAL_MS - Date.now())
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    lastCall = Date.now()
  })
  return chain
}

/** Typed GET against the EODData API; appends `ApiKey`, maps non-2xx → error. */
export async function eodFetch<T>(path: string, query?: Record<string, string>): Promise<T> {
  const key = apiKey() // throws MissingApiKeyError before any network work
  await throttle()

  const url = new URL(`${baseUrl()}${path}`)
  for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, v)
  url.searchParams.set("ApiKey", key)

  let res: Response
  try {
    res = await fetch(url, { headers: { accept: "application/json" } })
  } catch (err) {
    throw new EodDataError(`EODData request failed: ${err instanceof Error ? err.message : String(err)}`)
  }
  if (!res.ok) {
    throw new EodDataError(`EODData responded ${res.status} for ${path}`)
  }
  return (await res.json()) as T
}

// --- Symbol index -----------------------------------------------------------

/** Fetch + merge the US per-exchange symbol lists into one de-duped index. */
export async function fetchSymbolIndex(): Promise<SymbolHit[]> {
  const seen = new Set<string>()
  const hits: SymbolHit[] = []
  for (const exchange of US_EXCHANGES) {
    let rows: EodSymbol[]
    try {
      rows = await eodFetch<EodSymbol[]>(`/Symbol/List/${exchange}`)
    } catch (err) {
      // A single unreachable/unknown exchange must not sink the whole index;
      // skip it (the cache stores whatever resolved).
      if (err instanceof EodDataError) continue
      throw err
    }
    for (const row of rows) {
      const code = row.code?.toUpperCase()
      if (!code || seen.has(code)) continue
      seen.add(code)
      hits.push({ code, name: row.name ?? code, exchange: row.exchangeCode ?? exchange })
    }
  }
  return hits
}

/** Pure case-insensitive prefix/substring filter over a cached index. */
export function filterSymbols(index: readonly SymbolHit[], query: string): SymbolHit[] {
  const q = query.trim().toUpperCase()
  if (q.length === 0) return index.slice(0, 50)
  const starts: SymbolHit[] = []
  const contains: SymbolHit[] = []
  for (const hit of index) {
    if (hit.code.startsWith(q)) starts.push(hit)
    else if (hit.code.includes(q) || hit.name.toUpperCase().includes(q)) contains.push(hit)
  }
  return [...starts, ...contains].slice(0, 50)
}

// --- Daily bars -------------------------------------------------------------

/** Fetch a symbol's daily EOD history from the symbol's home exchange. */
export async function fetchDailyQuotes(hit: SymbolHit): Promise<EodQuote[]> {
  return eodFetch<EodQuote[]>(`/Quote/List/${hit.exchange}/${hit.code}`, { Interval: DAILY_INTERVAL })
}

// Parse `yyyy-MM-dd` as UTC midnight ms. EODData daily stamps have no time;
// the runtime speaks UTC-ms, so we anchor each bar at 00:00 UTC of its day.
function dayToEpochMs(dateStamp: string): number {
  return Date.parse(`${dateStamp.slice(0, 10)}T00:00:00Z`)
}

/**
 * Map EODData daily quotes to chartlang `Bar[]`, ascending by time, with the
 * four derived sources computed inline. Bars carry NO `point` method: they
 * round-trip through SQLite JSON AND stream to the worker host via
 * `postMessage` (a function is not structured-cloneable), and the runtime
 * injects the real `point` on its own `BarView`. This mirrors the apps/site
 * `aggregateBucket` invariant.
 */
export function mapQuotesToBars(quotes: readonly EodQuote[], symbol: string): Bar[] {
  return quotes
    .map((q) => ({ ...q, time: dayToEpochMs(q.dateStamp) }))
    .filter((q) => Number.isFinite(q.time))
    .sort((a, b) => a.time - b.time)
    .map((q) => {
      const { open, high, low, close, volume } = q
      return {
        time: q.time,
        open,
        high,
        low,
        close,
        volume,
        symbol,
        interval: DAILY_BAR_INTERVAL,
        hl2: (high + low) / 2,
        hlc3: (high + low + close) / 3,
        ohlc4: (open + high + low + close) / 4,
        hlcc4: (high + low + close + close) / 4,
      } as Bar
    })
}
