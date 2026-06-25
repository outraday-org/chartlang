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

  // The Pine input editor mounts (left pane) and the default Camp A sample
  // converts to a drawing — the read-only output pane shows the generated
  // chartlang `defineDrawing(...)`. That text appearing is end-user proof
  // the in-browser `convert()` ran with no server round-trip.
  await expect(converter.locator(".pane-editor .cm-content")).toBeVisible({ timeout: 30_000 })
  const output = converter.locator(".output-editor .cm-content")
  await expect(output).toContainText("defineDrawing", { timeout: 30_000 })

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

  // Switch to the hard-reject sample. The Sample switcher is the first
  // combobox in the toolbar; opening it and picking the reject entry
  // re-converts and lands the playground on that sample — its trigger
  // reflects the new selection and the reject-specific description renders.
  await converter.getByRole("combobox").first().click()
  await page.getByRole("option", { name: "Hard reject (for…in)" }).click()
  await expect(converter.getByRole("combobox").first()).toHaveText(/Hard reject/, {
    timeout: 30_000,
  })
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
