// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// server-only — the PRIMARY daily-bar source. Nasdaq's public quote API returns
// multi-year daily OHLCV with NO API key and NO quota, and (unlike Yahoo /
// Stooq, which now aggressively WAF / bot-wall data-centre and many residential
// IPs with 429s + JS challenges) it still answers a plain server `fetch`. So it
// leads the source chain in `cache.ts`; Yahoo (`yahoo.ts`) and Stooq
// (`stooq.ts`) are the fallbacks. Like them it MUST NOT enter the client graph:
// reached only through `src/routes/api/eod.ts` (via `cache.ts`).
//
// `NASDAQ_BASE_URL` overrides the host (for tests). Nasdaq keys history by
// `assetclass`, so a stock and an ETF live at the same path with a different
// `assetclass` query — we try `stocks` then `etf` before declaring a symbol
// unknown. Rows arrive newest-first with `$`/comma-formatted numbers and
// `MM/DD/YYYY` dates; we normalise to the same serialisable `Bar` shape the
// other sources emit (no `point` method — see `yahoo.ts`).

import type { Bar } from "@invinite-org/chartlang-core"

import { InvalidSymbolError, MarketDataError } from "./types"

/** chartlang interval literal for a daily bar. */
const DAILY_BAR_INTERVAL = "1D"

/** Match Yahoo's 5-year window so warmup-heavy indicators have full history. */
const HISTORY_YEARS = 5

const DEFAULT_BASE_URL = "https://api.nasdaq.com"

// Nasdaq's Akamai edge prefers a browser-shaped request.
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

// Nasdaq stores equities and ETFs under the same path keyed by `assetclass`;
// try the common case first, then ETFs, before calling a symbol unknown.
const ASSET_CLASSES = ["stocks", "etf"] as const

function baseUrl(): string {
  return process.env.NASDAQ_BASE_URL ?? DEFAULT_BASE_URL
}

/** `YYYY-MM-DD` in UTC — Nasdaq's `fromdate`/`todate` format. */
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Strip Nasdaq's `$` / thousands commas from a numeric cell → `number`. */
function num(cell: string | undefined): number {
  return Number((cell ?? "").replace(/[$,]/g, ""))
}

/** The slice of Nasdaq's historical response we consume. */
type NasdaqHistorical = {
  data?: {
    tradesTable?: {
      rows?: ReadonlyArray<{
        date?: string
        open?: string
        high?: string
        low?: string
        close?: string
        volume?: string
      }>
    } | null
  } | null
  status?: { bCodeMessage?: ReadonlyArray<{ errorMessage?: string }> | null } | null
}

/** Outcome of a single-assetclass fetch: rows, or a "symbol not in this class"
 * marker so the caller can try the next assetclass. */
type ClassResult = { kind: "rows"; rows: NonNullable<NasdaqHistorical["data"]>["tradesTable"] } | {
  kind: "absent"
}

async function fetchClass(ticker: string, assetclass: string, from: Date, to: Date): Promise<ClassResult> {
  const url = new URL(`${baseUrl()}/api/quote/${encodeURIComponent(ticker)}/historical`)
  url.searchParams.set("assetclass", assetclass)
  url.searchParams.set("fromdate", isoDate(from))
  url.searchParams.set("todate", isoDate(to))
  url.searchParams.set("limit", "9999")

  let res: Response
  try {
    res = await fetch(url, {
      headers: {
        "user-agent": BROWSER_UA,
        accept: "application/json, text/plain, */*",
        "accept-language": "en-US,en;q=0.9",
        referer: "https://www.nasdaq.com/",
      },
    })
  } catch (err) {
    throw new MarketDataError(
      `Nasdaq request failed: ${err instanceof Error ? err.message : String(err)}`,
    )
  }
  if (!res.ok) throw new MarketDataError(`Nasdaq responded ${res.status} for ${ticker}`)

  const body = (await res.json().catch(() => null)) as NasdaqHistorical | null
  if (body == null) throw new MarketDataError(`Nasdaq returned a malformed body for ${ticker}`)

  const table = body.data?.tradesTable
  if (table?.rows && table.rows.length > 0) return { kind: "rows", rows: table }

  // `data: null` with a "Symbol not exists." status means this assetclass does
  // not hold the symbol — let the caller try the next class.
  const msg = body.status?.bCodeMessage?.[0]?.errorMessage ?? ""
  if (body.data == null && /not exist/i.test(msg)) return { kind: "absent" }

  // Symbol exists in this class but no rows came back (unexpected for a 5y span).
  throw new MarketDataError(`Nasdaq returned no rows for ${ticker}`)
}

/** Parse a Nasdaq trades table into ascending `Bar[]`. */
function mapRows(table: NonNullable<ClassResult & { kind: "rows" }>["rows"], ticker: string): Bar[] {
  const bars: Bar[] = []
  for (const row of table?.rows ?? []) {
    // Nasdaq dates are `MM/DD/YYYY`; pin to 00:00 UTC for a daily series.
    const [mm, dd, yyyy] = (row.date ?? "").split("/")
    const time = Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd))
    const open = num(row.open)
    const high = num(row.high)
    const low = num(row.low)
    const close = num(row.close)
    const volume = num(row.volume)
    if (
      !Number.isFinite(time) ||
      !Number.isFinite(open) ||
      !Number.isFinite(high) ||
      !Number.isFinite(low) ||
      !Number.isFinite(close)
    ) {
      continue
    }
    bars.push({
      time,
      open,
      high,
      low,
      close,
      volume: Number.isFinite(volume) ? volume : 0,
      symbol: ticker,
      interval: DAILY_BAR_INTERVAL,
      hl2: (high + low) / 2,
      hlc3: (high + low + close) / 3,
      ohlc4: (open + high + low + close) / 4,
      hlcc4: (high + low + close + close) / 4,
    } as Bar)
  }
  bars.sort((a, b) => a.time - b.time)
  return bars
}

/**
 * Fetch a symbol's daily history from Nasdaq and map it to chartlang `Bar[]`,
 * ascending by time, with the four derived sources computed inline. Bars carry
 * NO `point` method — same serialisable-`Bar` invariant as `yahoo.ts`.
 *
 * Throws `InvalidSymbolError` when Nasdaq holds the symbol in neither the stock
 * nor the ETF class, and `MarketDataError` on any network / non-2xx / malformed
 * / empty failure.
 */
export async function fetchDailyBarsNasdaq(ticker: string): Promise<Bar[]> {
  const to = new Date()
  const from = new Date(Date.UTC(to.getUTCFullYear() - HISTORY_YEARS, to.getUTCMonth(), to.getUTCDate()))

  for (const assetclass of ASSET_CLASSES) {
    const result = await fetchClass(ticker, assetclass, from, to)
    if (result.kind === "rows") {
      const bars = mapRows(result.rows, ticker)
      if (bars.length === 0) throw new MarketDataError(`Nasdaq returned no usable rows for ${ticker}`)
      return bars
    }
    // `absent` → fall through and try the next assetclass.
  }
  throw new InvalidSymbolError(ticker)
}
