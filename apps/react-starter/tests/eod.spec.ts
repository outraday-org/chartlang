// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Daily-bar layer e2e against the running app's `/api/eod` route, with the
// network mocked by tests/eodMockServer.ts (the app points at it via
// `YAHOO_BASE_URL`; see playwright.config.ts). Exercises the full stack —
// route → cache → SQLite → Bar mapping — in the built server bundle.
//
// The suite is SERIAL because it asserts cache-vs-network ordering on a
// dedicated DB: the first AAPL load is `source:"network"`, the second is
// `source:"cache"`. A fresh data/e2e.db (globalSetup wipes it) makes the
// sequence deterministic.

import { expect, test } from "@playwright/test"

type Loaded = { bars: Bar[]; source: "cache" | "network" }
// Minimal local mirror of the chartlang Bar fields we assert (the spec runs
// outside the app's module graph).
type Bar = {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  symbol: string
  interval: string
  hl2: number
  hlc3: number
  ohlc4: number
  hlcc4: number
}

async function op<T>(
  request: import("@playwright/test").APIRequestContext,
  payload: Record<string, unknown>,
): Promise<{ status: number; body: T }> {
  const res = await request.post("/api/eod", { data: payload })
  return { status: res.status(), body: (await res.json()) as T }
}

test.describe.configure({ mode: "serial" })

test("first load fetches from network; bars map to a valid Bar shape", async ({ request }) => {
  const { body } = await op<Loaded>(request, { op: "load", symbol: "AAPL" })
  expect(body.source).toBe("network")

  // Ascending by time, daily interval, derived fields correct on the last bar.
  expect(body.bars.length).toBeGreaterThan(1)
  const [first, second] = body.bars.slice(-2)
  expect(first.time).toBeLessThan(second.time)
  expect(second.symbol).toBe("AAPL")
  expect(second.interval).toBe("1D")
  // AAPL last bar: o205 h212 l203 c208 (the mock's final fixture row).
  expect(second.hl2).toBeCloseTo((212 + 203) / 2)
  expect(second.hlc3).toBeCloseTo((212 + 203 + 208) / 3)
  expect(second.ohlc4).toBeCloseTo((205 + 212 + 203 + 208) / 4)
  expect(second.hlcc4).toBeCloseTo((212 + 203 + 208 + 208) / 4)
})

test("a repeat load serves from cache", async ({ request }) => {
  const { body } = await op<Loaded>(request, { op: "load", symbol: "AAPL" })
  expect(body.source).toBe("cache")
})

test("an unknown symbol is rejected with 400", async ({ request }) => {
  // The mock 404s unknown tickers → the layer throws InvalidSymbolError → 400.
  const { status } = await op<{ error: string }>(request, { op: "load", symbol: "ZZZZ" })
  expect(status).toBe(400)
})

test("a malformed ticker is rejected before any fetch with 400", async ({ request }) => {
  const { status } = await op<{ error: string }>(request, { op: "load", symbol: "not a ticker!" })
  expect(status).toBe(400)
})

test("a missing symbol is rejected with 400", async ({ request }) => {
  const { status } = await op<{ error: string }>(request, { op: "load" })
  expect(status).toBe(400)
})
