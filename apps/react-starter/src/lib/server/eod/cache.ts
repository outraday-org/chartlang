// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// server-only — the read-through SQLite cache over the daily-bar source
// (`yahoo.ts`). It MUST NOT enter the client graph: reached only through the
// `src/routes/api/eod.ts` server-route handlers. Do NOT import from any
// `src/components/*` file. The browser uses `src/lib/eodClient.ts`.
//
// Cache: one `eod_cache` row per `(SYMBOL, "daily:max")` holds that symbol's
// full daily `Bar[]` (TTL 24h). Yahoo is free + unmetered, so there is no API
// key and no per-day quota — the cache exists purely to avoid re-fetching the
// same multi-year history on every page load.
//
// Source chain (real usage): Nasdaq (`nasdaq.ts`) leads because it still answers
// a plain server fetch; Yahoo (`yahoo.ts`) and Stooq (`stooq.ts`) follow as
// fallbacks (both now WAF / bot-wall many IPs with 429s). We try each in order,
// returning the first that yields bars; a source's `MarketDataError` (429 / WAF
// / malformed) advances to the next, while an authoritative `InvalidSymbolError`
// short-circuits to a 400. If every source fails we serve a stale cache when one
// exists, else throw a `MarketDataError` aggregating each source's failure. In
// the mocked-Yahoo e2e (`YAHOO_BASE_URL` set) the chain is the Yahoo mock ALONE,
// so the suite stays hermetic (no real-network call).

import { and, eq } from "drizzle-orm"

import type { Bar } from "@invinite-org/chartlang-core"

import { getDb, schema } from "../db/index"
import { fetchDailyBarsNasdaq } from "./nasdaq"
import { fetchDailyBarsStooq } from "./stooq"
import { InvalidSymbolError, MarketDataError, type LoadSymbolResult } from "./types"
import { fetchDailyBars, normalizeTicker } from "./yahoo"

const BARS_TTL_MS = 24 * 60 * 60 * 1000 // daily bars refresh once a day

const BARS_RANGE = "daily:max"

// --- Cache row helpers ------------------------------------------------------

function readCache(symbol: string, rangeKey: string): { bars: unknown; fetchedAt: Date } | null {
  const [row] = getDb()
    .select({ bars: schema.eodCache.bars, fetchedAt: schema.eodCache.fetchedAt })
    .from(schema.eodCache)
    .where(and(eq(schema.eodCache.symbol, symbol), eq(schema.eodCache.rangeKey, rangeKey)))
    .all()
  return row ?? null
}

function writeCache(symbol: string, rangeKey: string, value: unknown): void {
  getDb()
    .insert(schema.eodCache)
    .values({ symbol, rangeKey, bars: value, fetchedAt: new Date() })
    .onConflictDoUpdate({
      target: [schema.eodCache.symbol, schema.eodCache.rangeKey],
      set: { bars: value, fetchedAt: new Date() },
    })
    .run()
}

function isFresh(fetchedAt: Date, ttlMs: number): boolean {
  return Date.now() - fetchedAt.getTime() < ttlMs
}

/** One daily-bar provider: a display name + its `(ticker) => Bar[]` fetcher. */
type DailySource = { name: string; fetch: (ticker: string) => Promise<Bar[]> }

/** The ordered source chain. In the mocked-Yahoo e2e (`YAHOO_BASE_URL` set) the
 * mock owns the only data source, so the real-network providers are dropped to
 * keep the suite hermetic and deterministic. */
function dailySources(): DailySource[] {
  if (process.env.YAHOO_BASE_URL != null) {
    return [{ name: "Yahoo", fetch: fetchDailyBars }]
  }
  return [
    { name: "Nasdaq", fetch: fetchDailyBarsNasdaq },
    { name: "Yahoo", fetch: fetchDailyBars },
    { name: "Stooq", fetch: fetchDailyBarsStooq },
  ]
}

// --- Daily bars -------------------------------------------------------------

/**
 * Read-through daily bars for a symbol. Fresh cache → `{source:"cache"}` with no
 * network call. Otherwise walk the source chain (Nasdaq → Yahoo → Stooq; see the
 * file header) and return `{source:"network"}` for the first that yields bars,
 * caching it. A source's `MarketDataError` (429 / WAF / malformed) advances to
 * the next source; an authoritative `InvalidSymbolError` short-circuits (surfaced
 * as a 400). If every source fails, serve a stale cache when one exists, else
 * throw a `MarketDataError` whose message aggregates each source's failure.
 * Validates the ticker first, so a malformed symbol never reaches the network.
 */
export async function getDailyBars(symbol: string): Promise<LoadSymbolResult> {
  const ticker = normalizeTicker(symbol) // throws InvalidSymbolError pre-fetch

  const cached = readCache(ticker, BARS_RANGE)
  if (cached && isFresh(cached.fetchedAt, BARS_TTL_MS)) {
    return { bars: cached.bars as Bar[], source: "cache" }
  }

  // Try each source in turn, collecting why each failed. The aggregated message
  // is surfaced to the user (and logged) so a multi-source failure reveals what
  // every provider did — not just the first one.
  const failures: string[] = []
  for (const source of dailySources()) {
    try {
      const bars = await source.fetch(ticker)
      writeCache(ticker, BARS_RANGE, bars)
      return { bars, source: "network" }
    } catch (err) {
      // An authoritative "this symbol does not exist" stops the chain → 400.
      if (err instanceof InvalidSymbolError) throw err
      failures.push(err instanceof Error ? err.message : String(err))
    }
  }

  // A transient upstream blip should not blow away a usable history: serve the
  // stale cache if we have one, else surface every source's failure together.
  if (cached) return { bars: cached.bars as Bar[], source: "cache" }
  const detail = failures.join("; ")
  console.warn(`[eod] all market-data sources failed for ${ticker}: ${detail}`)
  throw new MarketDataError(`No market data for ${ticker} — ${detail}`)
}
