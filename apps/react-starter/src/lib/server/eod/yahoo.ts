// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// server-only — daily-bar source backed by Yahoo Finance's public chart
// endpoint. It MUST NOT enter the client graph: reached only through the
// `src/routes/api/eod.ts` server-route handlers (via `cache.ts`). Do NOT
// import it from any `src/components/*` file.
//
// Why Yahoo: it returns multi-year daily OHLCV with NO API key and NO quota,
// so a fresh clone loads real market data with zero setup. (The previous
// EODData free tier returned only ~20 daily bars and paywalled deeper history,
// which starved long-warmup indicators — a 30-bar SMA had no points and drew as
// a single line.) The endpoint is unofficial-but-stable; we send a browser
// User-Agent (it 403s/429s a default agent), establish a best-effort cookie +
// crumb session (Yahoo increasingly WAF-throttles cookie-less callers with 429),
// and parse the documented shape. The session is per-process and best-effort: if
// the handshake fails we still issue the plain request, so a missing session
// never makes things worse than before. When the host is overridden via
// `YAHOO_BASE_URL` (the e2e mock, which implements ONLY the chart endpoint) the
// handshake is skipped. On a hard Yahoo block the cache layer (`cache.ts`) falls
// back to a second source, Stooq (`stooq.ts`).

import type { Bar } from "@invinite-org/chartlang-core"

import { InvalidSymbolError, MarketDataError } from "./types"

/** chartlang interval literal for a daily bar. */
const DAILY_BAR_INTERVAL = "1D"

/** How far back to request. 5 years (~1250 trading days) gives every built-in
 * TA window a full warmup with comfortable margin. */
const HISTORY_RANGE = "5y"

const DEFAULT_BASE_URL = "https://query1.finance.yahoo.com"

// Yahoo 403s/429s a non-browser User-Agent; a desktop UA gets the JSON.
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

/** Yahoo rate-limits bursts with 429; retry a couple of times with escalating
 * backoff (1.5s, 3s, 4.5s) so a cold load right after another doesn't surface a
 * transient error. `retry-after`, when present, overrides the computed wait. */
const MAX_429_RETRIES = 3
const RETRY_BACKOFF_MS = 1_500

// --- Cookie + crumb session (best-effort) -----------------------------------
//
// Yahoo seeds an `A1`/`A3` session cookie from `fc.yahoo.com` and exchanges it
// for a "crumb" at `/v1/test/getcrumb`. The `/v8/finance/chart` endpoint
// tolerates a missing crumb, but a valid cookie markedly lowers the odds of a
// WAF 429. We build the session ONCE per process, lazily, and reuse it.

/** Host that sets the session cookie (separate from the data host). */
const COOKIE_SEED_URL = "https://fc.yahoo.com"

/** Crumb is served from the canonical data host, never the test override. */
const GETCRUMB_URL = `${DEFAULT_BASE_URL}/v1/test/getcrumb`

/** A captured Yahoo session: a `name=value; …` Cookie header and an optional
 * crumb (cookie-only sessions are still useful). */
type YahooSession = { cookie: string; crumb: string | null }

/** Memoised per-process session build; `null` once resolved if it could not be
 * established (we then fall through to a plain, session-less request). */
let sessionPromise: Promise<YahooSession | null> | null = null

/** The crumb/cookie handshake only applies to the real Yahoo host. The e2e mock
 * (`YAHOO_BASE_URL` set) implements only the chart endpoint, so skip it there. */
function sessionEnabled(): boolean {
  return process.env.YAHOO_BASE_URL == null
}

/** Flatten a response's `Set-Cookie` list into a `name=value; …` Cookie header. */
function collectCookies(res: Response): string {
  const set = res.headers.getSetCookie?.() ?? []
  return set
    .map((c) => c.split(";")[0])
    .filter(Boolean)
    .join("; ")
}

/** Best-effort: seed a cookie then exchange it for a crumb. Any failure yields a
 * weaker (cookie-only) session or `null`; it never throws. */
async function buildSession(): Promise<YahooSession | null> {
  let cookie: string
  try {
    const seed = await fetch(COOKIE_SEED_URL, { headers: { "user-agent": BROWSER_UA } })
    cookie = collectCookies(seed)
  } catch {
    return null
  }
  if (!cookie) return null

  let crumb: string | null = null
  try {
    const res = await fetch(GETCRUMB_URL, { headers: { "user-agent": BROWSER_UA, cookie } })
    if (res.ok) {
      const text = (await res.text()).trim()
      // A healthy crumb is a short opaque token; a throttled/HTML response is not.
      if (text && text.length <= 64 && !text.includes("<") && !/too many/i.test(text)) {
        crumb = text
      }
    }
  } catch {
    // Cookie-only session — the chart endpoint accepts a missing crumb.
  }
  return { cookie, crumb }
}

/** Lazily build (once) and return the shared session, or `null` if disabled or
 * unestablishable. */
function getSession(): Promise<YahooSession | null> {
  if (!sessionEnabled()) return Promise.resolve(null)
  sessionPromise ??= buildSession()
  return sessionPromise
}

/** Drop the cached session so the next call rebuilds it (used after a 401). */
function resetSession(): void {
  sessionPromise = null
}

// A US ticker is 1–10 chars: a leading letter then letters/digits/`.`/`-`
// (e.g. BRK.B). Validation happens BEFORE any fetch so a bad symbol never hits
// the network. Callers upper-case first.
const US_TICKER = /^[A-Z][A-Z0-9.\-]{0,9}$/

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function baseUrl(): string {
  return process.env.YAHOO_BASE_URL ?? DEFAULT_BASE_URL
}

/** Normalise + validate a user-supplied ticker; throws `InvalidSymbolError`. */
export function normalizeTicker(symbol: string): string {
  const up = symbol.trim().toUpperCase()
  if (!US_TICKER.test(up)) throw new InvalidSymbolError(symbol)
  return up
}

/** The slice of Yahoo's `/v8/finance/chart` response we consume. */
type YahooChartResponse = {
  chart?: {
    error?: { code?: string; description?: string } | null
    result?: ReadonlyArray<{
      timestamp?: ReadonlyArray<number>
      indicators?: {
        quote?: ReadonlyArray<{
          open?: ReadonlyArray<number | null>
          high?: ReadonlyArray<number | null>
          low?: ReadonlyArray<number | null>
          close?: ReadonlyArray<number | null>
          volume?: ReadonlyArray<number | null>
        }>
      }
    }>
  }
}

/**
 * Fetch a symbol's daily history from Yahoo Finance and map it to chartlang
 * `Bar[]`, ascending by time, with the four derived sources computed inline.
 * Bars carry NO `point` method: they round-trip through SQLite JSON AND stream
 * to the worker host via `postMessage` (a function is not structured-cloneable),
 * and the runtime injects the real `point` on its own `BarView`. This mirrors
 * the apps/site `aggregateBucket` invariant.
 *
 * Throws `InvalidSymbolError` when Yahoo reports the symbol does not exist, and
 * `MarketDataError` on any network / non-2xx / malformed-response failure.
 */
export async function fetchDailyBars(ticker: string): Promise<Bar[]> {
  let session = await getSession()

  const url = new URL(`${baseUrl()}/v8/finance/chart/${encodeURIComponent(ticker)}`)
  url.searchParams.set("range", HISTORY_RANGE)
  url.searchParams.set("interval", "1d")
  if (session?.crumb) url.searchParams.set("crumb", session.crumb)

  const headers: Record<string, string> = { accept: "application/json", "user-agent": BROWSER_UA }
  if (session?.cookie) headers.cookie = session.cookie

  let res: Response
  let refreshedSession = false
  for (let attempt = 0; ; attempt++) {
    try {
      res = await fetch(url, { headers })
    } catch (err) {
      throw new MarketDataError(
        `Yahoo request failed: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
    // A 401 means the cookie/crumb went stale — rebuild the session once and retry.
    if (res.status === 401 && sessionEnabled() && !refreshedSession) {
      refreshedSession = true
      resetSession()
      session = await getSession()
      if (session?.cookie) headers.cookie = session.cookie
      else delete headers.cookie
      if (session?.crumb) url.searchParams.set("crumb", session.crumb)
      else url.searchParams.delete("crumb")
      continue
    }
    if (res.status === 429 && attempt < MAX_429_RETRIES) {
      const retryAfter = Number(res.headers.get("retry-after"))
      const waitMs =
        Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : RETRY_BACKOFF_MS * (attempt + 1)
      await sleep(waitMs)
      continue
    }
    break
  }

  // Yahoo answers an unknown symbol with 404 + a `Not Found` chart error; treat
  // that as an invalid symbol (no retry), and any other non-2xx as upstream.
  if (res.status === 404) throw new InvalidSymbolError(ticker)
  if (!res.ok) throw new MarketDataError(`Yahoo responded ${res.status} for ${ticker}`)

  const body = (await res.json().catch(() => null)) as YahooChartResponse | null
  if (body?.chart?.error) {
    const code = body.chart.error.code ?? ""
    if (code.toLowerCase().includes("not found")) throw new InvalidSymbolError(ticker)
    throw new MarketDataError(`Yahoo error for ${ticker}: ${body.chart.error.description ?? code}`)
  }

  const result = body?.chart?.result?.[0]
  const stamps = result?.timestamp
  const quote = result?.indicators?.quote?.[0]
  if (!result || !stamps || !quote) throw new MarketDataError(`Yahoo returned no data for ${ticker}`)

  const bars: Bar[] = []
  for (let i = 0; i < stamps.length; i++) {
    const open = quote.open?.[i]
    const high = quote.high?.[i]
    const low = quote.low?.[i]
    const close = quote.close?.[i]
    const volume = quote.volume?.[i]
    // Yahoo emits a `null` for a holiday / halted session; skip incomplete rows.
    if (
      open == null ||
      high == null ||
      low == null ||
      close == null ||
      !Number.isFinite(stamps[i])
    ) {
      continue
    }
    bars.push({
      time: stamps[i] * 1000, // Yahoo stamps are epoch SECONDS; runtime speaks ms.
      open,
      high,
      low,
      close,
      volume: volume ?? 0,
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
