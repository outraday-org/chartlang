// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { expect, test } from "@playwright/test"

// Smoke test for the Pine → chartlang converter playground. Conversion
// runs entirely client-side (no /api/compile), so the output appearing is
// proof the browser-safe `convert()` ran. The "Compile & preview" step then
// posts the converted output to the real `/api/compile` route and renders
// the chart, exercising the full Pine → chartlang → compile → render path.
test("converter converts live, compiles the output, and flags rejects", async ({ page }) => {
  // A live convert, a server compile, then a chart render exceed the 30s
  // default test timeout.
  test.setTimeout(120_000)
  await page.goto("/converter")

  await expect(page.getByRole("heading", { name: /Pine Script/ })).toBeVisible({
    timeout: 30_000,
  })

  const converter = page.locator(".cl-converter")

  // The Pine input editor mounts (left pane) and the default EMA-cross sample
  // converts to an indicator — the read-only output pane shows the generated
  // chartlang `defineIndicator(...)`. That text appearing is end-user proof
  // the in-browser `convert()` ran with no server round-trip.
  await expect(converter.locator(".pane-editor .cm-content")).toBeVisible({ timeout: 30_000 })
  const output = converter.locator(".output-editor .cm-content")
  await expect(output).toContainText("defineIndicator", { timeout: 30_000 })

  // Full pipeline on the clean default sample: compile the converted output
  // through the real /api/compile route and render it. The canvas mounting
  // and painting a non-empty bitmap proves the converted chartlang compiled
  // and reached a renderable chart.
  await converter.locator("button.compile-button").click()
  const canvas = converter.locator("canvas.chart-canvas")
  await expect(canvas).toBeVisible({ timeout: 60_000 })
  await expect
    .poll(() => canvas.evaluate((node) => (node as HTMLCanvasElement).toDataURL().length), {
      timeout: 30_000,
    })
    .toBeGreaterThan(1000)

  // Switch to a hard-reject sample. The Sample switcher is now a "Browse
  // examples" dialog with a category sidebar: open it, pick the Rejections
  // category, then the for…in reject. That re-converts and lands the
  // playground on that sample — its trigger reflects the new selection and
  // the reject-specific description renders. The dialog portals to <body>,
  // so its category / item buttons are queried via `page`, not `converter`.
  await converter.locator("button.example-browser-trigger").click()
  await page.locator(".example-browser-category", { hasText: "Rejections" }).click()
  await page.locator(".example-browser-item", { hasText: "for…in over handles" }).click()
  await expect(converter.locator("button.example-browser-trigger")).toContainText(
    "for…in over handles",
    { timeout: 30_000 },
  )
  await expect(
    converter.getByText("refused with a structured diagnostic", { exact: false }),
  ).toBeVisible({ timeout: 30_000 })

  // The diagnostics pane surfaces the structured reject: the error-severity
  // `unsupported-for-in` diagnostic and the partial-output banner render, so
  // the rejection is visible on-screen rather than only in the sample blurb.
  const diagnostics = converter.locator(".converter-diagnostics")
  await expect(diagnostics).toBeVisible({ timeout: 30_000 })
  await expect(diagnostics.locator(".diagnostic.is-error")).toBeVisible()
  await expect(diagnostics.getByText("unsupported-for-in")).toBeVisible()
  await expect(diagnostics.getByText("This Pine construct is rejected", { exact: false })).toBeVisible()

  // The error-severity diagnostic disables "Compile & preview": the output is
  // a partial best-effort lowering, so compiling it would render a misleading
  // chart. The button is disabled and the reason is shown in its place.
  await expect(converter.locator("button.compile-button")).toBeDisabled()
  await expect(
    converter.getByText("Fix the rejected construct above before compiling", { exact: false }),
  ).toBeVisible()
})
