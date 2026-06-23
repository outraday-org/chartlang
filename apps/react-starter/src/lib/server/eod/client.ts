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
  type SymbolHit,
} from "./types"

// Default request base. The live OpenAPI spec (https://api.eoddata.com/
// openapi/v1.json) declares NO `servers` array and bare paths (`/Symbol/...`),
// so the base is the spec's own host — `https://api.eoddata.com`, NOT a `/v1`
// subpath (a `/v1` prefix 404s every call). Override with `EODDATA_BASE_URL`
// (e2e points it at the local mock server).
const DEFAULT_BASE_URL = "https://api.eoddata.com"

/** Daily EOD interval token per the spec's `Interval` enum (`d` = daily). */
const DAILY_INTERVAL = "d"

/** chartlang interval literal for a daily bar. */
const DAILY_BAR_INTERVAL = "1D"

/** Defensive spacing for the free-tier rate limit (the cache is the real
 * protection — this just keeps a burst of cold loads polite). */
const MIN_INTERVAL_MS = 7_000

/** The free tier rate-limits bursts harder than the nominal 10/min: a second
 * call seconds after the first can still 429. Retry a 429 a couple of times,
 * honouring `Retry-After` when present, so a cold load (resolve exchange +
 * fetch bars = two calls) succeeds instead of surfacing a transient error. */
const MAX_429_RETRIES = 3
const RETRY_BACKOFF_MS = 8_000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

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

/** Typed GET against the EODData API; appends `ApiKey`, retries 429s with
 * backoff, maps other non-2xx → error. */
export async function eodFetch<T>(path: string, query?: Record<string, string>): Promise<T> {
  const key = apiKey() // throws MissingApiKeyError before any network work

  const url = new URL(`${baseUrl()}${path}`)
  for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, v)
  url.searchParams.set("ApiKey", key)

  for (let attempt = 0; ; attempt++) {
    await throttle()
    let res: Response
    try {
      res = await fetch(url, { headers: { accept: "application/json" } })
    } catch (err) {
      throw new EodDataError(
        `EODData request failed: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
    if (res.status === 429 && attempt < MAX_429_RETRIES) {
      // Honour `Retry-After` (seconds) when present, else a fixed backoff.
      const retryAfter = Number(res.headers.get("retry-after"))
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : RETRY_BACKOFF_MS
      await sleep(waitMs)
      continue
    }
    if (!res.ok) {
      throw new EodDataError(`EODData responded ${res.status} for ${path}`)
    }
    return (await res.json()) as T
  }
}

// --- Symbol search ----------------------------------------------------------

/** A row from `GET /Symbol/Search/{searchString}` (only the fields we use). */
type EodSearchRow = {
  symbolCode?: string
  symbolName?: string
  exchangeCode?: string
}

/**
 * Resolve symbols matching `query` via `GET /Symbol/Search/{q}` — ONE API call
 * that returns each match WITH its home exchange (so a single search both
 * powers a picker and resolves the exchange a daily-bars fetch needs). This
 * replaces fetching + merging the four full per-exchange symbol lists (~7 MB,
 * serialised behind the throttle), which is far too heavy + slow for the free
 * tier. De-duped by `exchange:code`, capped at 50.
 */
export async function searchSymbolApi(query: string): Promise<SymbolHit[]> {
  const q = query.trim()
  if (q.length === 0) return []
  const rows = await eodFetch<EodSearchRow[]>(`/Symbol/Search/${encodeURIComponent(q)}`)
  const seen = new Set<string>()
  const hits: SymbolHit[] = []
  for (const row of rows) {
    const code = row.symbolCode?.toUpperCase()
    const exchange = row.exchangeCode
    if (!code || !exchange) continue
    const key = `${exchange}:${code}`
    if (seen.has(key)) continue
    seen.add(key)
    hits.push({ code, name: row.symbolName ?? code, exchange })
    if (hits.length >= 50) break
  }
  return hits
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
