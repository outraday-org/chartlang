// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { expect, test, type Page } from "@playwright/test"

// Each adapter switch lazy-loads a per-adapter chunk (echarts/konva are
// heavy), then re-mounts the chart against that library — well past the
// 30s default test timeout when run back to back.
test.setTimeout(180_000)

// Mirrors `DEMO_ADAPTERS` in
// `src/components/demo/adapters/registry.ts` (which itself mirrors
// `scripts/adapters/registry.ts`). Kept as a literal so the spec drives
// every shipped adapter without importing app source into the test.
const ADAPTERS: ReadonlyArray<{ id: string; label: string }> = [
  { id: "canvas2d", label: "Canvas 2D" },
  { id: "lightweight-charts", label: "Lightweight Charts" },
  { id: "uplot", label: "uPlot" },
  { id: "echarts", label: "ECharts" },
  { id: "konva", label: "Konva" },
]

// Fails the test on any uncaught page error or console.error fired while
// the listeners are attached — the adapter switch must be clean.
function trackErrors(page: Page): () => void {
  const errors: string[] = []
  const onPageError = (err: Error): void => {
    errors.push(`pageerror: ${err.message}`)
  }
  const onConsole = (msg: { type: () => string; text: () => string }): void => {
    if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`)
  }
  page.on("pageerror", onPageError)
  page.on("console", onConsole)
  return () => {
    page.off("pageerror", onPageError)
    page.off("console", onConsole)
    expect(errors, errors.join("\n")).toEqual([])
  }
}

// A rendered surface is the adapter's content element inside
// `.chart-surface` (a `<canvas>` for canvas2d/uplot, `<svg>`/`<canvas>`
// for echarts/lwc/konva). Asserting "≥1 element child, no error overlay"
// keeps the check surface-agnostic.
async function expectSurfaceRendered(page: Page): Promise<void> {
  const surface = page.locator("#demo .chart-surface")
  await expect(surface).toBeVisible({ timeout: 30_000 })
  await expect
    .poll(() => surface.evaluate((node) => node.childElementCount), { timeout: 30_000 })
    .toBeGreaterThan(0)
  await expect(surface.locator(".error-overlay")).toHaveCount(0)
}

test("the demo renders every adapter when switched", async ({ page }) => {
  await page.goto("/#demo")

  const demo = page.locator("#demo")
  await expect(demo.locator(".cm-content")).toBeVisible({ timeout: 30_000 })
  // Play enables once the initial artifact + bars arrive, proving the
  // compile→render loop reached a renderable state before we switch.
  await expect(demo.locator("button.play-button")).toBeEnabled({ timeout: 30_000 })

  const adapterSelect = demo.getByRole("combobox", { name: "Adapter" })
  await expect(adapterSelect).toBeVisible()

  for (const adapter of ADAPTERS) {
    const stop = trackErrors(page)
    await adapterSelect.click()
    await page.getByRole("option", { name: adapter.label, exact: true }).click()
    await expect(adapterSelect).toHaveText(new RegExp(adapter.label), { timeout: 30_000 })
    await expectSurfaceRendered(page)
    stop()
  }
})

test("?adapter= deep-links straight to the requested adapter", async ({ page }) => {
  const stop = trackErrors(page)
  await page.goto("/?adapter=echarts#demo")

  const demo = page.locator("#demo")
  await expect(demo.locator(".cm-content")).toBeVisible({ timeout: 30_000 })
  await expect(demo.locator("button.play-button")).toBeEnabled({ timeout: 30_000 })

  // The switcher reflects the deep-linked id on load…
  await expect(demo.getByRole("combobox", { name: "Adapter" })).toHaveText(/ECharts/, {
    timeout: 30_000,
  })
  // …and the echarts surface mounts without a manual switch.
  await expectSurfaceRendered(page)
  stop()
})
