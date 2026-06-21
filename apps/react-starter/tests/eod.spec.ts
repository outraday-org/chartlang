// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// EODData layer e2e against the running app's `/api/eod` route, with the
// network mocked by tests/eodMockServer.ts (the app points at it via
// EODDATA_BASE_URL; see playwright.config.ts). Exercises the full stack —
// route → cache → quota → SQLite → Bar mapping — in the built server bundle.
//
// The suite is SERIAL and budgeted against EODDATA_DAILY_LIMIT=2 (set in the
// config): the cold symbol-search spends 1 quota call, the first AAPL load
// spends the 2nd, then a third DISTINCT network load is refused. A fresh
// data/e2e.db (globalSetup wipes it) makes the sequence deterministic.

import { expect, test } from "@playwright/test"

type Hit = { code: string; name: string; exchange: string }
type Usage = { day: string; calls: number; remaining: number }
type Loaded = { bars: Bar[]; source: "cache" | "network"; quotaExceeded?: boolean }
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

async function usage(request: import("@playwright/test").APIRequestContext): Promise<Usage> {
  const { body } = await op<{ usage: Usage }>(request, { op: "usage" })
  return body.usage
}

test.describe.configure({ mode: "serial" })

test("search returns US symbol hits (cold index spends 1 quota call)", async ({ request }) => {
  expect((await usage(request)).calls).toBe(0)

  const { body } = await op<{ hits: Hit[] }>(request, { op: "search", query: "AA" })
  expect(body.hits.some((h) => h.code === "AAPL")).toBeTruthy()

  // Building the index is a real network call → quota advanced to 1.
  expect((await usage(request)).calls).toBe(1)
})

test("first load fetches from network; bars map to a valid Bar shape", async ({ request }) => {
  const { body } = await op<Loaded>(request, { op: "load", symbol: "AAPL" })
  expect(body.source).toBe("network")
  expect((await usage(request)).calls).toBe(2)

  // Ascending by time, daily interval, derived fields correct.
  expect(body.bars.length).toBe(2)
  const [first, second] = body.bars
  expect(first.time).toBeLessThan(second.time)
  expect(second.symbol).toBe("AAPL")
  expect(second.interval).toBe("1D")
  // AAPL 2026-06-19: o205 h212 l203 c208.
  expect(second.hl2).toBeCloseTo((212 + 203) / 2)
  expect(second.hlc3).toBeCloseTo((212 + 203 + 208) / 3)
  expect(second.ohlc4).toBeCloseTo((205 + 212 + 203 + 208) / 4)
  expect(second.hlcc4).toBeCloseTo((212 + 203 + 208 + 208) / 4)
})

test("a repeat load serves from cache and spends no quota", async ({ request }) => {
  const before = (await usage(request)).calls
  const { body } = await op<Loaded>(request, { op: "load", symbol: "AAPL" })
  expect(body.source).toBe("cache")
  expect((await usage(request)).calls).toBe(before)
})

test("a third distinct network load is refused once the quota is spent", async ({ request }) => {
  // Quota is at the limit (2) and IBM is uncached → refused, no further spend.
  const before = (await usage(request)).calls
  const { status, body } = await op<{ error: string }>(request, { op: "load", symbol: "IBM" })
  expect(status).toBe(429)
  expect(body.error).toMatch(/out of eoddata calls/i)
  expect((await usage(request)).calls).toBe(before)
})

test("a non-US / invalid symbol is rejected before any fetch (no quota cost)", async ({ request }) => {
  const before = (await usage(request)).calls
  const { status } = await op<{ error: string }>(request, { op: "load", symbol: "not a ticker!" })
  expect(status).toBe(400)
  expect((await usage(request)).calls).toBe(before)
})
