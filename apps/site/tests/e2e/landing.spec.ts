// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { expect, test } from "@playwright/test"

// Smoke test for the full edit→compile→render loop on the built
// artifact. The demo posts to the real `/api/compile` server route, so
// this also exercises the Netlify-bound function path end to end.
test("landing renders and the demo compiles, renders, and recompiles", async ({ page }) => {
  await page.goto("/")

  // Marketing sections from Tasks 2–3 plus the Task-4 demo.
  await expect(page.getByRole("heading", { name: "Quickstart" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "See it in action" })).toBeVisible()

  const demo = page.locator("#demo")
  const editor = demo.locator(".cm-content")
  await expect(editor).toBeVisible({ timeout: 30_000 })

  // First compile: the status badge must reach "ok" and the canvas must
  // paint a non-empty bitmap.
  const status = demo.locator(".status")
  await expect(status).toHaveText(/ok/, { timeout: 30_000 })

  const canvas = demo.locator("canvas.chart-canvas")
  await expect(canvas).toBeVisible()
  const firstBitmap = await canvas.evaluate((node) =>
    (node as HTMLCanvasElement).toDataURL(),
  )
  expect(firstBitmap.length).toBeGreaterThan(1000)

  // Edit the source: append a trivial line and confirm the loop recompiles
  // back to "ok" (the linter extension drives the compile on change).
  await editor.click()
  await page.keyboard.press("ControlOrMeta+End")
  await editor.pressSequentially("\n// noop", { delay: 10 })
  await expect(status).toHaveText(/compiling/, { timeout: 15_000 })
  await expect(status).toHaveText(/ok/, { timeout: 30_000 })
})
