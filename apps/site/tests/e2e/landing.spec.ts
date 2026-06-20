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

  // First compile + render: the editor's linter compiles the initial
  // script through `/api/compile` on mount, which sets the chart
  // artifact. The Play button is `disabled` until that artifact arrives
  // and the bars load, so an enabled Play button is the end-user-visible
  // proof the compile→render loop reached a renderable state. The canvas
  // must also paint a non-empty bitmap.
  const play = demo.locator("button.play-button")
  await expect(play).toBeEnabled({ timeout: 30_000 })

  const canvas = demo.locator("canvas.chart-canvas")
  await expect(canvas).toBeVisible()
  const firstBitmap = await canvas.evaluate((node) =>
    (node as HTMLCanvasElement).toDataURL(),
  )
  expect(firstBitmap.length).toBeGreaterThan(1000)

  // Recompile: switch to a visually distinct script. Selecting a script
  // clears the artifact (Play goes disabled) and re-mounts the editor,
  // whose linter compiles the new source through the same `/api/compile`
  // loop. Play re-enabling plus a changed bitmap proves the loop
  // recompiled and re-rendered fresh source end to end.
  await demo.getByRole("combobox").first().click()
  await page.getByRole("option", { name: "RSI Divergence Alert" }).click()
  await expect(play).toBeEnabled({ timeout: 30_000 })

  await expect
    .poll(
      () => canvas.evaluate((node) => (node as HTMLCanvasElement).toDataURL()),
      { timeout: 30_000 },
    )
    .not.toBe(firstBitmap)
})
