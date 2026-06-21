// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Chart render e2e for the DEFAULT (echarts) adapter path. Drives the
// test-only /test/chart harness route (src/routes/test.chart.tsx), which
// compiles a seed SMA-cross-with-alert script through the real /api/compile
// route and mounts ChartPane over a deterministic daily series. Asserts the
// echarts chart container renders (a <canvas> appears inside the mount node)
// and that the alert-emitting script surfaces a sonner toast.
//
// Heavy adapter-render correctness lives in multi-library-adapters
// conformance; this is a light render + alert smoke through the seam.

import { expect, test } from "@playwright/test"

test("renders the echarts chart for a compiled script over daily bars", async ({ page }) => {
  await page.goto("/test/chart")

  // The mount container is always present; the adapter paints a <canvas>
  // into it once host.load + the render loop run.
  const container = page.getByTestId("chart-container")
  await expect(container).toBeVisible()
  await expect(container.locator("canvas").first()).toBeVisible({ timeout: 30_000 })
})

test("surfaces an alert as a toast through the generic adapter handle", async ({ page }) => {
  await page.goto("/test/chart")

  // The seed script fires `alert(...)` on an SMA crossover; ChartPane routes
  // every alert (host emits → adapter renders) to a sonner toast + footer.
  await expect(page.getByText(/crossed above/i).first()).toBeVisible({ timeout: 30_000 })
})
