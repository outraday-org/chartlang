// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { expect, test, type Page } from "@playwright/test"
import { PINE_SCRIPTS } from "../../src/components/converter/pineScripts"

// The converter analogue of the demo's adapter sweep: drive EVERY
// `PINE_SCRIPTS` sample through the full Pine → chartlang → compile →
// render path via the `?script=` deep-link (Task 1). Importing the
// catalogue (pure string data, no React/Node) keeps the sweep auto-synced
// — a new sample in `pineScripts.ts` adds a test with no spec edit.
//
// Each sample's live convert → server compile → canvas paint exceeds the
// 30s default test timeout.
test.setTimeout(120_000)

// Fails the test on any uncaught page error or console.error fired while
// the listeners are attached — copied verbatim from `demo-adapters.spec.ts`.
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

for (const sample of PINE_SCRIPTS) {
  test(`converter sample: ${sample.id} (${sample.category})`, async ({ page }) => {
    const stop = trackErrors(page)
    await page.goto(`/converter?script=${sample.id}`)

    const converter = page.locator(".cl-converter")
    // The Pine input mounts and the deep-linked sample's live convert ran
    // (the read-only output pane is present).
    await expect(converter.locator(".pane-editor .cm-content")).toBeVisible({ timeout: 30_000 })
    const output = converter.locator(".output-editor .cm-content")
    const compileButton = converter.locator("button.compile-button")

    if (sample.category === "rejects") {
      // Intentional hard reject: an error-severity diagnostic shows and the
      // Compile button stays disabled (a reject that compiled is a failure).
      // Do NOT click compile.
      const diagnostics = converter.locator(".converter-diagnostics")
      await expect(diagnostics.locator(".diagnostic.is-error").first()).toBeVisible({
        timeout: 30_000,
      })
      await expect(compileButton).toBeDisabled()
    } else {
      // Convert produced a chartlang indicator; compile + render it. A
      // warning-only sample keeps the button enabled (warnings don't set
      // `hasError`), so assert on the `.compile-status.is-error` count, not
      // on the absence of all diagnostics.
      await expect(output).toContainText("defineIndicator", { timeout: 30_000 })
      await expect(compileButton).toBeEnabled({ timeout: 30_000 })
      await compileButton.click()
      const canvas = converter.locator("canvas.chart-canvas")
      await expect(canvas).toBeVisible({ timeout: 60_000 })
      await expect
        .poll(() => canvas.evaluate((node) => (node as HTMLCanvasElement).toDataURL().length), {
          timeout: 30_000,
        })
        .toBeGreaterThan(1000)
      // The status must not be the error state after a successful compile.
      await expect(converter.locator(".compile-status.is-error")).toHaveCount(0)
    }

    stop()
  })
}
