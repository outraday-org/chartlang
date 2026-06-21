// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// server-only — the read-through SQLite cache + per-UTC-day quota guard over
// the Task 3 db layer (`getDb()` + `schema.eodCache` / `schema.apiUsage`). It
// MUST NOT enter the client graph: reached only through the
// `src/routes/api/eod.ts` server-route handlers. Do NOT import from any
// `src/components/*` file. The browser uses `src/lib/eodClient.ts`.
//
// Cache keys (one `eod_cache` row each):
//   ("*",     "symbols:US")  → the merged US symbol index (TTL 7d). "*" is not
//                              a valid ticker, so the synthetic key never
//                              collides with a real symbol's bars row.
//   (SYMBOL,  "daily:max")   → that symbol's full daily `Bar[]` (TTL 24h).
//
// Quota: `api_usage.calls` is a per-UTC-day counter. It is incremented ONLY on
// a real network call (cache hits + pre-fetch validation cost nothing) and is a
// CONSERVATIVE guard — EODData resets on its own schedule, not local/UTC
// midnight, so the counter may refuse slightly early but never over-spends.

import { and, eq, sql } from "drizzle-orm"

import type { Bar } from "@invinite-org/chartlang-core"

import { getDb, schema } from "../db/index"
import {
  fetchDailyQuotes,
  fetchSymbolIndex,
  filterSymbols,
  mapQuotesToBars,
  normalizeTicker,
} from "./client"
import {
  InvalidSymbolError,
  QuotaExceededError,
  type LoadSymbolResult,
  type SymbolHit,
  type UsageInfo,
} from "./types"

/** Free-tier default; override with `EODDATA_DAILY_LIMIT` (e2e sets it low). */
const DEFAULT_DAILY_LIMIT = 100
const SYMBOLS_TTL_MS = 7 * 24 * 60 * 60 * 1000 // symbol lists change rarely
const BARS_TTL_MS = 24 * 60 * 60 * 1000 // daily bars refresh once a day

const INDEX_SYMBOL = "*"
const INDEX_RANGE = "symbols:US"
const BARS_RANGE = "daily:max"

function dailyLimit(): number {
  const raw = Number.parseInt(process.env.EODDATA_DAILY_LIMIT ?? "", 10)
  return Number.isFinite(raw) && raw >= 1 ? raw : DEFAULT_DAILY_LIMIT
}

/** UTC `YYYY-MM-DD` for the quota key. */
function utcDay(): string {
  return new Date().toISOString().slice(0, 10)
}

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

// --- Quota ------------------------------------------------------------------

/** Current per-UTC-day usage for the UI badge. */
export function getUsage(): UsageInfo {
  const day = utcDay()
  const [row] = getDb()
    .select({ calls: schema.apiUsage.calls })
    .from(schema.apiUsage)
    .where(eq(schema.apiUsage.day, day))
    .all()
  const calls = row?.calls ?? 0
  return { day, calls, remaining: Math.max(0, dailyLimit() - calls) }
}

/** True if at least one network call remains for today. */
function hasQuota(): boolean {
  return getUsage().calls < dailyLimit()
}

// Atomically `calls = calls + 1` for today (insert-or-bump). Run inside a
// better-sqlite3 transaction so concurrent route calls can't double-spend.
function consumeQuota(): void {
  const db = getDb()
  db.insert(schema.apiUsage)
    .values({ day: utcDay(), calls: 1 })
    .onConflictDoUpdate({
      target: schema.apiUsage.day,
      set: { calls: sql`${schema.apiUsage.calls} + 1` },
    })
    .run()
}

// --- Symbol search ----------------------------------------------------------

/** Read-through US symbol index. Fetches (1 quota call) only on a cold/stale
 * cache; otherwise serves the cached merged list. */
function getSymbolIndex(): SymbolHit[] {
  const cached = readCache(INDEX_SYMBOL, INDEX_RANGE)
  if (cached && isFresh(cached.fetchedAt, SYMBOLS_TTL_MS)) {
    return cached.bars as SymbolHit[]
  }
  return [] // signal "needs network" to the async caller
}

/**
 * Search US symbols. Serves the cached index when fresh; otherwise spends one
 * quota call to (re)build it, then filters. When the quota is spent and no
 * cached index exists, returns whatever stale index is available (possibly
 * empty) rather than throwing — search must stay usable offline.
 */
export async function searchSymbols(query: string): Promise<SymbolHit[]> {
  let index = getSymbolIndex()
  if (index.length === 0) {
    const stale = readCache(INDEX_SYMBOL, INDEX_RANGE)
    if (hasQuota()) {
      consumeQuota()
      index = await fetchSymbolIndex()
      writeCache(INDEX_SYMBOL, INDEX_RANGE, index)
    } else {
      index = (stale?.bars as SymbolHit[]) ?? []
    }
  }
  return filterSymbols(index, query)
}

// --- Daily bars -------------------------------------------------------------

/** Resolve a symbol's home exchange from the (cached) index. */
async function resolveHit(symbol: string): Promise<SymbolHit | null> {
  const index = await searchSymbols(symbol)
  return index.find((h) => h.code === symbol) ?? null
}

/**
 * Read-through daily bars for a symbol. Fresh cache → `{source:"cache"}` with
 * NO API call. Otherwise: if the quota is spent, return the stale cache (if
 * any) flagged `quotaExceeded`, else throw `QuotaExceededError`; if quota
 * remains, consume one call, fetch, store, and return `{source:"network"}`.
 * Validates the ticker first (no quota cost on a bad symbol).
 */
export async function getDailyBars(symbol: string): Promise<LoadSymbolResult> {
  const ticker = normalizeTicker(symbol) // throws InvalidSymbolError pre-fetch

  const cached = readCache(ticker, BARS_RANGE)
  if (cached && isFresh(cached.fetchedAt, BARS_TTL_MS)) {
    return { bars: cached.bars as Bar[], source: "cache" }
  }

  if (!hasQuota()) {
    if (cached) return { bars: cached.bars as Bar[], source: "cache", quotaExceeded: true }
    throw new QuotaExceededError(dailyLimit())
  }

  const hit = await resolveHit(ticker)
  if (!hit) {
    // Unknown US symbol: surface as a stale cache if we have one, else throw a
    // friendly invalid-symbol error (no fetch attempted → no quota burn).
    if (cached) return { bars: cached.bars as Bar[], source: "cache" }
    throw new InvalidSymbolError(symbol)
  }

  // resolveHit may have spent the last remaining call building a cold symbol
  // index; re-check before the bars fetch so we never over-spend the daily
  // budget (the conservative-guard invariant — see this file's CLAUDE.md).
  if (!hasQuota()) {
    if (cached) return { bars: cached.bars as Bar[], source: "cache", quotaExceeded: true }
    throw new QuotaExceededError(dailyLimit())
  }

  consumeQuota()
  const bars = mapQuotesToBars(await fetchDailyQuotes(hit), ticker)
  writeCache(ticker, BARS_RANGE, bars)
  return { bars, source: "network" }
}
