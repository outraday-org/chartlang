// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { expect, test } from "@playwright/test"

// Regression guard for the lazy-chunk failure mode that took the live
// site down: `DemoBody` is loaded through `lazy(() => import(...))`, and a
// failed fetch of its content-hashed chunk ("Failed to fetch dynamically
// imported module") used to propagate past Suspense to the router root,
// replacing the whole page — nav, hero, quickstart and all — with the
// default "Something went wrong!" screen.
//
// Both tests simulate the failure by aborting the chunk request, which is
// indistinguishable to the browser from the CDN edge missing a
// just-deployed hash or a tab held open across a deploy.

const DEMO_CHUNK = "**/assets/DemoBody-*.js"

test("a transient chunk failure recovers itself with a single reload", async ({ page }) => {
  let aborted = 0
  let documentLoads = 0
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documentLoads += 1
  })
  // Fail the first fetch only — the shape of an edge that has not yet
  // propagated the new deploy and serves it correctly moments later.
  await page.route(DEMO_CHUNK, (route) => {
    if (aborted === 0) {
      aborted += 1
      return route.abort()
    }
    return route.continue()
  })

  await page.goto("/?adapter=canvas2d")

  // The demo comes up for real: `installChunkRecovery` reloads the
  // document, which re-reads the SSR HTML and re-fetches the chunk.
  const editor = page.locator("#demo .cm-content")
  await expect(editor).toBeVisible({ timeout: 30_000 })
  expect(aborted).toBe(1)
  // Exactly one recovery reload — the `sessionStorage` guard in
  // `lib/chunkRecovery.ts` is what keeps this from becoming a loop.
  expect(documentLoads).toBe(2)
})

test("a persistent chunk failure is contained to the demo section", async ({ page }) => {
  await page.route(DEMO_CHUNK, (route) => route.abort())

  await page.goto("/?adapter=canvas2d")

  // The failed slot says so and offers the only recovery that works (a
  // reload — React memoizes the rejected lazy promise, and the browser
  // memoizes the failed chunk URL, so nothing retries in place).
  const demo = page.locator("#demo")
  await expect(demo.getByText("The live demo could not be loaded.")).toBeVisible({
    timeout: 30_000,
  })
  await expect(demo.getByRole("button", { name: "Reload the page" })).toBeVisible()

  // The rest of the page is untouched — this is the assertion that would
  // have caught the outage.
  await expect(page.getByRole("heading", { name: "Quickstart" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "See it in action" })).toBeVisible()
  await expect(page.getByRole("link", { name: "PineScript Converter" })).toBeVisible()
  await expect(page.getByText("Something went wrong!")).toHaveCount(0)
})
