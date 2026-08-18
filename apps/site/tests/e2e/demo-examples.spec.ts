// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { expect, test } from "@playwright/test"

// The "Browse examples" dialog replaces the old flat <select> script
// switcher: a category sidebar on the left, the category's examples on
// the right. These specs cover the pick flow and the `?script=`
// deep-link, both of which must end in a clean compile→render loop.

test("the Browse examples dialog switches the active script", async ({ page }) => {
  await page.goto("/#demo")

  const demo = page.locator("#demo")
  const editor = demo.locator(".cm-content")
  await expect(editor).toBeVisible({ timeout: 30_000 })
  await expect(demo.locator("button.play-button")).toBeEnabled({ timeout: 30_000 })

  // The default catalogue entry is EMA Cross; its source is what the
  // editor mounts with.
  await expect(editor).toContainText("EMA Cross")

  // Open the dialog, choose a different category, pick one of its
  // examples. The dialog closes and the editor re-mounts on that source.
  await demo.getByRole("button", { name: "Browse examples" }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()

  await dialog.getByRole("button", { name: /TA · Bands & Volatility/ }).click()
  await dialog.getByRole("button", { name: /Bollinger Bands/ }).click()
  await expect(dialog).toBeHidden()

  await expect(editor).toContainText("Bollinger Bands")
  // Picking a script clears the artifact, then the editor's linter
  // recompiles the new source — Play re-enabling proves the loop ran.
  await expect(demo.locator("button.play-button")).toBeEnabled({ timeout: 30_000 })
})

// The `orders` category ("Orders & Backtesting") is the catalogue's newest
// section. Its three scripts are the only ones in the tree that emit on the
// `orders` channel, so this is where a broken compile of `order.*` surfaces
// as a product failure rather than a unit-test failure.
const ORDER_EXAMPLES: ReadonlyArray<{ id: string; label: string }> = [
  { id: "order-ema-cross", label: "Order EMA Cross" },
  { id: "order-rsi-reversal", label: "Order RSI Reversal" },
  { id: "order-silent-markers", label: "Order Silent Markers" },
]

test("the Orders & Backtesting category lists its examples", async ({ page }) => {
  await page.goto("/#demo")

  const demo = page.locator("#demo")
  await expect(demo.locator(".cm-content")).toBeVisible({ timeout: 30_000 })

  await demo.getByRole("button", { name: "Browse examples" }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()

  await dialog.getByRole("button", { name: /Orders & Backtesting/ }).click()
  for (const example of ORDER_EXAMPLES) {
    await expect(dialog.getByRole("button", { name: new RegExp(example.label) })).toBeVisible()
  }
})

test("every order example compiles and runs", async ({ page }) => {
  // Three full compile→render cycles in one case; well past the 30s default.
  test.setTimeout(180_000)
  for (const example of ORDER_EXAMPLES) {
    await page.goto(`/?script=${example.id}#demo`)

    const demo = page.locator("#demo")
    const editor = demo.locator(".cm-content")
    await expect(editor).toBeVisible({ timeout: 30_000 })
    await expect(editor).toContainText(example.label)
    // Play re-enabling proves the compile→render loop reached a renderable
    // state; the surface carries no error overlay.
    await expect(demo.locator("button.play-button")).toBeEnabled({ timeout: 30_000 })
    await expect(demo.locator(".chart-surface .error-overlay")).toHaveCount(0)
    // Every one of the three emits at least one order over the history.
    await expect
      .poll(() => demo.locator(".chart-orders .order").count(), { timeout: 30_000 })
      .toBeGreaterThan(0)
  }
})

test("?script= deep-links straight to the requested example", async ({ page }) => {
  await page.goto("/?script=bollinger-bands#demo")

  const demo = page.locator("#demo")
  const editor = demo.locator(".cm-content")
  await expect(editor).toBeVisible({ timeout: 30_000 })

  // The deep-linked example is active on load and compiles clean.
  await expect(editor).toContainText("Bollinger Bands")
  await expect(demo.locator("button.play-button")).toBeEnabled({ timeout: 30_000 })

  // The trigger reflects the deep-linked example, and opening the dialog
  // pre-highlights that example's category.
  const trigger = demo.getByRole("button", { name: "Browse examples" })
  await expect(trigger).toContainText("Bollinger Bands")
  await trigger.click()
  await expect(
    page.getByRole("dialog").getByRole("button", { name: /TA · Bands & Volatility/ }),
  ).toHaveAttribute("aria-current", "true")
})
