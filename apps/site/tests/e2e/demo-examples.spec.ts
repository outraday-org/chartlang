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
