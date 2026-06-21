// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Compile smoke for the real-compiler `/api/compile` server route. Task 2
// ships only the route (the editor/chart UI lands in later tasks), so the
// suite POSTs straight to the endpoint via the `request` fixture rather
// than driving the DOM. Good path proves the core-import resolution
// invariant (without `chartlangCoreBundles` the compile 500s); bad path
// proves diagnostics flow through; oversized proves the 64 KiB guard.

import { expect, test } from "@playwright/test"

// A minimal two-indicator SMA cross — exercises `compute`, `ta.sma`,
// `ta.crossover`, `plot`, and `alert`, enough to bundle through the real
// compiler. Follows the required convention (top-level imports AND the
// destructured `compute({ bar, ta, plot, alert })` params).
const GOOD_SOURCE = `import { alert, defineIndicator, plot, ta } from "@invinite-org/chartlang-core"

export default defineIndicator({
  name: "SMA cross",
  apiVersion: 1,
  overlay: true,
  compute({ bar, ta, plot, alert }) {
    const fast = ta.sma(bar.close, 5)
    const slow = ta.sma(bar.close, 20)
    plot(fast, { title: "SMA(5)" })
    plot(slow, { title: "SMA(20)" })
    if (ta.crossover(fast, slow).current) {
      alert("SMA(5) crossed above SMA(20)", { severity: "info" })
    }
  },
})
`

// Missing `compute`/`defineIndicator` default export — a hard compile error.
const BAD_SOURCE = `this is not valid chartlang @@@ ((`

test("compiles a valid script to a module + manifest", async ({ request }) => {
  const res = await request.post("/api/compile", { data: { source: GOOD_SOURCE } })
  expect(res.ok()).toBe(true)
  const body = await res.json()
  expect(body.ok).toBe(true)
  expect(typeof body.moduleSource).toBe("string")
  expect(body.moduleSource.length).toBeGreaterThan(0)
})

test("returns diagnostics for a broken script", async ({ request }) => {
  const res = await request.post("/api/compile", { data: { source: BAD_SOURCE } })
  expect(res.ok()).toBe(true)
  const body = await res.json()
  expect(body.ok).toBe(false)
  expect(Array.isArray(body.diagnostics)).toBe(true)
  expect(body.diagnostics.length).toBeGreaterThan(0)
})

test("rejects oversized source with a clean failure, not a 500", async ({ request }) => {
  const oversized = `// ${"x".repeat(64 * 1024 + 1)}`
  const res = await request.post("/api/compile", { data: { source: oversized } })
  expect(res.ok()).toBe(true)
  const body = await res.json()
  expect(body.ok).toBe(false)
  expect(body.diagnostics).toEqual([])
})
