// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Chart render e2e for the DEFAULT (canvas2d) adapter path. Drives the
// test-only /test/chart harness route (src/routes/test.chart.tsx), which
// compiles a seed SMA-cross script (alert + order.* legs) through the real
// /api/compile route and mounts ChartPane over a deterministic daily series.
// Asserts the chart container renders (a <canvas> appears inside the mount
// node), that the alert-emitting script surfaces a sonner toast, and that the
// structured `orders` channel reaches the orders feed.
//
// Heavy adapter-render correctness lives in multi-library-adapters
// conformance; this is a light render + alert smoke through the seam.

import { expect, test } from "@playwright/test"

test("renders the canvas2d chart for a compiled script over daily bars", async ({ page }) => {
  await page.goto("/test/chart")

  // The mount container is always present; the adapter paints a <canvas>
  // into it once host.load + the render loop run.
  const container = page.getByTestId("chart-container")
  await expect(container).toBeVisible()
  await expect(container.locator("canvas").first()).toBeVisible({ timeout: 30_000 })
})

test("lists the structured orders channel in the orders feed", async ({ page }) => {
  await page.goto("/test/chart")

  // The seed script's `order.buy` / `order.close` legs ride the `orders`
  // channel to the seam's `onOrder` sink — no prefix parsing, and no app code
  // for the entry/exit arrows (those are ordinary plot emissions).
  const feed = page.getByTestId("orders-feed")
  await expect(feed).toBeVisible({ timeout: 30_000 })
  const actions = feed.getByTestId("order-action")
  await expect.poll(() => actions.count(), { timeout: 30_000 }).toBeGreaterThan(0)
  // `uppercase` is presentational — the DOM text is the action enum itself.
  await expect(actions.first()).toHaveText(/^(buy|close)$/)
  await expect(feed.getByText("Long").first()).toBeVisible()
})

test("surfaces an alert as a toast through the generic adapter handle", async ({ page }) => {
  await page.goto("/test/chart")

  // The seed script fires `alert(...)` on an SMA crossover; ChartPane routes
  // every alert (host emits → adapter renders) to a sonner toast + footer.
  await expect(page.getByText(/crossed above/i).first()).toBeVisible({ timeout: 30_000 })
})
