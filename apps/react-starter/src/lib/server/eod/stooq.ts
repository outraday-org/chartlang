// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// server-only — the FALLBACK daily-bar source, used by `cache.ts` only when the
// primary Yahoo source (`yahoo.ts`) fails with a `MarketDataError` (a 429 / WAF
// block / malformed body). Stooq exposes a key-less daily CSV download, so when
// Yahoo hard-blocks an IP a different provider often still answers. Like
// `yahoo.ts` it MUST NOT enter the client graph: reached only through the
// `src/routes/api/eod.ts` server-route handlers (via `cache.ts`).
//
// Stooq is best-effort too: it occasionally serves a JS bot-wall (an HTML page,
// not CSV) to data-centre IPs, in which case we surface a `MarketDataError` and
// the cache layer falls through to a stale cache. `STOOQ_BASE_URL` overrides the
// host (for tests). Stooq daily rows carry only a date (no intra-day stamp), so
// each bar's `time` is that date at 00:00 UTC — fine for a `1D` series.

import type { Bar } from "@invinite-org/chartlang-core"

import { MarketDataError } from "./types"

/** chartlang interval literal for a daily bar. */
const DAILY_BAR_INTERVAL = "1D"

/** Match Yahoo's 5-year window so warmup-heavy indicators have full history. */
const HISTORY_YEARS = 5

const DEFAULT_BASE_URL = "https://stooq.com"

// Stooq, like Yahoo, prefers a browser User-Agent over a default agent.
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

function baseUrl(): string {
  return process.env.STOOQ_BASE_URL ?? DEFAULT_BASE_URL
}

/** `YYYYMMDD` in UTC — Stooq's `d1`/`d2` date-bound format. */
function yyyymmdd(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, "0")
  const day = String(d.getUTCDate()).padStart(2, "0")
  return `${y}${m}${day}`
}

/**
 * chartlang ticker → Stooq symbol. Stooq suffixes US tickers with `.us` and
 * spells dotted class shares with a hyphen (BRK.B → `brk-b.us`).
 */
function stooqSymbol(ticker: string): string {
  return `${ticker.toLowerCase().replace(/\./g, "-")}.us`
}

/** Parse Stooq's `Date,Open,High,Low,Close,Volume` CSV into ascending `Bar[]`. */
function parseStooqCsv(text: string, ticker: string): Bar[] {
  const lines = text.trim().split(/\r?\n/)
  lines.shift() // drop the header row
  const bars: Bar[] = []
  for (const line of lines) {
    const [date, o, h, l, c, v] = line.split(",")
    const time = Date.parse(`${date}T00:00:00Z`)
    const open = Number(o)
    const high = Number(h)
    const low = Number(l)
    const close = Number(c)
    const volume = Number(v)
    // Stooq emits an `N/D` (no data) for the rare incomplete row; skip it.
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
 * Fetch a symbol's daily history from Stooq and map it to chartlang `Bar[]`,
 * ascending by time, with the four derived sources computed inline. Bars carry
 * NO `point` method — same serialisable-`Bar` invariant as `yahoo.ts`.
 *
 * Throws `MarketDataError` on any network / non-2xx / non-CSV / empty failure.
 * Unlike `yahoo.ts` it does NOT distinguish an unknown symbol: by the time we
 * reach Stooq, Yahoo has already failed without confirming the ticker invalid,
 * so a Stooq miss is treated as an upstream failure (the caller then serves a
 * stale cache if one exists).
 */
export async function fetchDailyBarsStooq(ticker: string): Promise<Bar[]> {
  const now = new Date()
  const from = new Date(
    Date.UTC(now.getUTCFullYear() - HISTORY_YEARS, now.getUTCMonth(), now.getUTCDate()),
  )
  const url = new URL(`${baseUrl()}/q/d/l/`)
  url.searchParams.set("s", stooqSymbol(ticker))
  url.searchParams.set("i", "d")
  url.searchParams.set("d1", yyyymmdd(from))
  url.searchParams.set("d2", yyyymmdd(now))

  let res: Response
  try {
    res = await fetch(url, { headers: { accept: "text/csv", "user-agent": BROWSER_UA } })
  } catch (err) {
    throw new MarketDataError(
      `Stooq request failed: ${err instanceof Error ? err.message : String(err)}`,
    )
  }
  if (!res.ok) throw new MarketDataError(`Stooq responded ${res.status} for ${ticker}`)

  const text = await res.text()
  // A bot-wall / error page is HTML, not the expected CSV header.
  if (!/^date,open,high,low,close/i.test(text.trimStart())) {
    throw new MarketDataError(`Stooq returned a non-CSV body for ${ticker}`)
  }

  const bars = parseStooqCsv(text, ticker)
  if (bars.length === 0) throw new MarketDataError(`Stooq returned no rows for ${ticker}`)
  return bars
}
