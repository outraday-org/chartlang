// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// A tiny mock EODData HTTP server for the eod e2e. Server-side `fetch` (in the
// app's `/api/eod` route) cannot be intercepted by Playwright's browser
// route-mocking, so the suite instead points the app at THIS server via
// `EODDATA_BASE_URL` (set in playwright.config.ts). It implements just the two
// endpoints the layer calls — `/Symbol/List/{exchange}` and
// `/Quote/List/{exchange}/{symbol}` — with deterministic fixtures, requires the
// `ApiKey` query param, and 404s unknown symbols. Run directly with `node`
// (Playwright `webServer.command`); listens on PORT (default 4599).

import { createServer } from "node:http"

const PORT = Number.parseInt(process.env.EOD_MOCK_PORT ?? "4599", 10)

// Two US symbols on different exchanges, plus enough quote rows to assert the
// Bar mapping (asc order, derived fields). Tests use these codes.
const SYMBOLS: Record<string, { code: string; name: string }[]> = {
  NASDAQ: [
    { code: "AAPL", name: "Apple Inc." },
    { code: "MSFT", name: "Microsoft Corp." },
  ],
  NYSE: [{ code: "IBM", name: "International Business Machines" }],
  AMEX: [],
  OTCBB: [],
}

const QUOTES: Record<string, { dateStamp: string; open: number; high: number; low: number; close: number; volume: number }[]> = {
  AAPL: [
    { dateStamp: "2026-06-18", open: 200, high: 210, low: 198, close: 205, volume: 1_000_000 },
    { dateStamp: "2026-06-19", open: 205, high: 212, low: 203, close: 208, volume: 1_100_000 },
  ],
  MSFT: [{ dateStamp: "2026-06-19", open: 400, high: 410, low: 395, close: 405, volume: 800_000 }],
  IBM: [{ dateStamp: "2026-06-19", open: 150, high: 155, low: 148, close: 152, volume: 500_000 }],
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`)
  const parts = url.pathname.split("/").filter(Boolean)

  // Reject unauthenticated calls exactly as EODData would.
  if (!url.searchParams.get("ApiKey")) {
    res.writeHead(401, { "content-type": "application/json" })
    res.end(JSON.stringify({ error: "missing ApiKey" }))
    return
  }

  // /Symbol/List/{exchange}
  if (parts[0] === "Symbol" && parts[1] === "List" && parts[2]) {
    const exchange = parts[2]
    const rows = (SYMBOLS[exchange] ?? []).map((s) => ({
      code: s.code,
      name: s.name,
      exchangeCode: exchange,
      type: "Common Stock",
    }))
    res.writeHead(200, { "content-type": "application/json" })
    res.end(JSON.stringify(rows))
    return
  }

  // /Quote/List/{exchange}/{symbol}
  if (parts[0] === "Quote" && parts[1] === "List" && parts[2] && parts[3]) {
    const rows = QUOTES[parts[3]]
    if (!rows) {
      res.writeHead(404, { "content-type": "application/json" })
      res.end(JSON.stringify({ error: "unknown symbol" }))
      return
    }
    res.writeHead(200, { "content-type": "application/json" })
    res.end(JSON.stringify(rows))
    return
  }

  res.writeHead(404, { "content-type": "application/json" })
  res.end(JSON.stringify({ error: "not found" }))
})

server.listen(PORT, () => {
  // Playwright waits on this URL; the log helps when debugging locally.
  console.log(`mock EODData server listening on http://localhost:${PORT}`)
})
