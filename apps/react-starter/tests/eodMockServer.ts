// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// A tiny mock Yahoo Finance chart server for the eod e2e. The app's `/api/eod`
// route fetches daily bars server-side (via src/lib/server/eod/yahoo.ts), which
// Playwright's browser route-mocking cannot intercept, so the suite instead
// points the app at THIS server via `YAHOO_BASE_URL` (set in
// playwright.config.ts). It implements the one endpoint the layer calls —
// `GET /v8/finance/chart/{ticker}?range=5y&interval=1d` — returning Yahoo's
// documented JSON shape with deterministic fixtures, and 404s unknown tickers
// (so the layer throws InvalidSymbolError → 400). Run directly with `tsx`
// (Playwright `webServer.command`); listens on PORT (default 4599).

import { createServer } from "node:http"

const PORT = Number.parseInt(process.env.EOD_MOCK_PORT ?? "4599", 10)

// Yahoo stamps are epoch SECONDS; the layer multiplies by 1000. Build a run of
// consecutive UTC days so SMA/EMA warmup windows (up to ~30 bars) have points.
const DAY_SECONDS = 86_400
// 2026-06-19 UTC (the last bar's day) so the final two bars match the o/h/l/c
// the spec asserts on.
const LAST_STAMP = Math.floor(Date.UTC(2026, 5, 19) / 1000)

// Build N daily OHLCV bars ending on LAST_STAMP. The last two bars carry the
// fixed values the spec asserts (AAPL 2026-06-18 o200 h210 l198 c205, then
// 2026-06-19 o205 h212 l203 c208); earlier bars are a deterministic ramp so the
// indicator windows have enough history.
function buildBars(count: number): {
  timestamp: number[]
  open: number[]
  high: number[]
  low: number[]
  close: number[]
  volume: number[]
} {
  const timestamp: number[] = []
  const open: number[] = []
  const high: number[] = []
  const low: number[] = []
  const close: number[] = []
  const volume: number[] = []
  for (let i = count - 1; i >= 0; i--) {
    // i counts back from the most recent bar (i === 0 is the last bar).
    timestamp.push(LAST_STAMP - i * DAY_SECONDS)
  }
  for (let i = 0; i < count; i++) {
    if (i === count - 2) {
      open.push(200), high.push(210), low.push(198), close.push(205), volume.push(1_000_000)
    } else if (i === count - 1) {
      open.push(205), high.push(212), low.push(203), close.push(208), volume.push(1_100_000)
    } else {
      const base = 100 + i
      open.push(base), high.push(base + 5), low.push(base - 5), close.push(base + 2)
      volume.push(900_000)
    }
  }
  return { timestamp, open, high, low, close, volume }
}

// Known tickers serve 40 bars; everything else 404s as an unknown symbol.
const KNOWN = new Set(["AAPL", "MSFT", "IBM"])
const BAR_COUNT = 40

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`)
  const parts = url.pathname.split("/").filter(Boolean)

  // /v8/finance/chart/{ticker}
  if (parts[0] === "v8" && parts[1] === "finance" && parts[2] === "chart" && parts[3]) {
    const ticker = decodeURIComponent(parts[3]).toUpperCase()
    if (!KNOWN.has(ticker)) {
      // Yahoo answers an unknown symbol with 404 + a `Not Found` chart error.
      res.writeHead(404, { "content-type": "application/json" })
      res.end(
        JSON.stringify({
          chart: { result: null, error: { code: "Not Found", description: `No data found, symbol may be delisted` } },
        }),
      )
      return
    }
    const bars = buildBars(BAR_COUNT)
    res.writeHead(200, { "content-type": "application/json" })
    res.end(
      JSON.stringify({
        chart: {
          error: null,
          result: [
            {
              timestamp: bars.timestamp,
              indicators: {
                quote: [
                  {
                    open: bars.open,
                    high: bars.high,
                    low: bars.low,
                    close: bars.close,
                    volume: bars.volume,
                  },
                ],
              },
            },
          ],
        },
      }),
    )
    return
  }

  res.writeHead(404, { "content-type": "application/json" })
  res.end(JSON.stringify({ chart: { result: null, error: { code: "Not Found" } } }))
})

server.listen(PORT, () => {
  // Playwright waits on this URL; the log helps when debugging locally.
  console.log(`mock Yahoo Finance server listening on http://localhost:${PORT}`)
})
