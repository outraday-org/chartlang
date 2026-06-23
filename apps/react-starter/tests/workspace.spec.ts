// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Full workspace happy-path e2e for the index route (Task 6). It drives the
// real editor + ChartPane + scripts sidebar in the built server bundle, but
// mocks `/api/eod` at the BROWSER level. Why browser-mock here (vs the eod
// suite's server mock)? The symbol picker + quota badge call `/api/eod` from
// the browser via `eodClient`, so the route IS interceptable; mocking it keeps
// this spec off the shared `data/e2e.db` quota counter (EODDATA_DAILY_LIMIT=2)
// that `eod.spec.ts` asserts exact counts against while running in parallel.
//
// `/api/compile` (real compiler) and `/api/scripts` (real SQLite) are NOT
// mocked — this exercises the genuine compile→chart and persistence flows. The
// saved script uses a unique name and is deleted at the end so the shared
// scripts table is left as found.

import { expect, test, type Page } from "@playwright/test"

// Deterministic two-bar daily history the mocked `load` returns. Mirrors the
// chartlang Bar shape (derived fields included) so ChartPane renders it.
function mockBars(symbol: string): unknown[] {
  const day = 86_400_000
  const base = Date.UTC(2026, 5, 18)
  const rows = [
    { o: 200, h: 210, l: 198, c: 205 },
    { o: 205, h: 212, l: 203, c: 208 },
  ]
  return rows.map((r, i) => ({
    time: base + i * day,
    open: r.o,
    high: r.h,
    low: r.l,
    close: r.c,
    volume: 1_000_000,
    symbol,
    interval: "1D",
    hl2: (r.h + r.l) / 2,
    hlc3: (r.h + r.l + r.c) / 3,
    ohlc4: (r.o + r.h + r.l + r.c) / 4,
    hlcc4: (r.h + r.l + r.c + r.c) / 4,
  }))
}

// Install the browser-level /api/eod mock and return a counter of how many
// `load` ops were served (to prove edits trigger no EOD fetch).
async function mockEod(page: Page): Promise<{ loads: () => number }> {
  let loads = 0
  let calls = 0
  await page.route("**/api/eod", async (route) => {
    const body = route.request().postDataJSON() as { op: string; query?: string; symbol?: string }
    if (body.op === "search") {
      await route.fulfill({
        json: { hits: [{ code: "MSFT", name: "Microsoft Corp.", exchange: "NASDAQ" }] },
      })
      return
    }
    if (body.op === "load") {
      loads += 1
      calls += 1
      await route.fulfill({
        json: { bars: mockBars(body.symbol ?? "MSFT"), source: "network" },
      })
      return
    }
    // usage
    await route.fulfill({ json: { usage: { day: "2026-06-21", calls, remaining: 100 - calls } } })
  })
  return { loads: () => loads }
}

test("workspace boots, compiles the seed, charts a picked symbol, and saves", async ({ page }) => {
  const eod = await mockEod(page)
  await page.goto("/")

  // Seed script visible in the sidebar and compiled to OK (it is a valid
  // SMA-cross script; the editor's linter compiles it through /api/compile).
  await expect(page.getByTestId("scripts-sidebar").getByText("SMA Cross")).toBeVisible()
  await expect(page.getByTestId("compile-status")).toHaveText(/OK/, { timeout: 30_000 })

  // Seed has no symbol → chart prompts for one (no bars yet).
  await expect(page.getByTestId("chart-pane")).toContainText(/pick a symbol/i)

  // Enter a ticker → ChartPane paints a <canvas> over the bars, and the quota
  // badge reflects the mocked usage. (Manual entry: type + Load, no search.)
  await page.getByLabel(/ticker symbol/i).fill("MSFT")
  await page.getByRole("button", { name: /load/i }).click()
  await expect(page.getByTestId("chart-container").locator("canvas").first()).toBeVisible({
    timeout: 30_000,
  })
  expect(eod.loads()).toBe(1)

  // Edit the script → it re-compiles (no EOD fetch). Append a comment line.
  const loadsBeforeEdit = eod.loads()
  await page.locator(".cm-content").click()
  await page.keyboard.type("\n// edited by e2e")
  // Compile cycles through compiling→ok again; give it a beat then assert OK.
  await expect(page.getByTestId("compile-status")).toHaveText(/OK/, { timeout: 30_000 })
  await expect(page.getByTestId("dirty-indicator")).toBeVisible()
  expect(eod.loads()).toBe(loadsBeforeEdit) // editing never re-fetched EOD

  // New script → the buffer is untracked, so Save prompts for a name. (The
  // booted seed is already tracked, so its Save would update in place silently.)
  await page.getByTitle("New script").click()
  await expect(page.getByTestId("dirty-indicator")).toBeVisible()

  // Save under a unique name → it appears in the sidebar.
  const name = `e2e ${Date.now()}`
  await page.getByTestId("save-script").click()
  await page.getByTestId("script-name-input").fill(name)
  await page.getByTestId("confirm-save").click()
  await expect(page.getByTestId("scripts-sidebar").getByText(name)).toBeVisible()

  // Clean up the shared DB: delete the script we just created (the row is the
  // current script, so its delete + rename actions are reachable on hover).
  const row = page.getByTestId("scripts-sidebar").locator("li", { hasText: name })
  await row.hover()
  await row.getByTitle("Delete").click()
  await page.getByRole("button", { name: "Delete", exact: true }).click()
  await expect(page.getByTestId("scripts-sidebar").getByText(name)).toBeHidden()
})
