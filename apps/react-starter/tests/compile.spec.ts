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

// Exercises the module-scope `math` namespace + the `syminfo` compute field:
// `math.roundToMintick(value, syminfo.mintick)` is the headline chart-aware
// helper. Proves the starter accepts the namespace end-to-end (no seam change
// is needed — language features flow through the compiler automatically).
const MATH_SOURCE = `import { defineIndicator, math, plot } from "@invinite-org/chartlang-core"

export default defineIndicator({
  name: "Tick snap",
  apiVersion: 1,
  overlay: true,
  compute({ bar, plot, syminfo }) {
    const snapped = math.roundToMintick(bar.close, syminfo.mintick)
    plot(snapped, { title: "Snapped close" })
  },
})
`

// Exercises the module-scope `str` namespace: `str.tostring(value, "#.##")` +
// `str.format(...)` build the dynamic text the `draw.table` hole consumes.
// Proves the starter accepts the namespace end-to-end (no seam change is
// needed — language features flow through the compiler automatically).
const STR_SOURCE = `import { defineIndicator, str } from "@invinite-org/chartlang-core"

export default defineIndicator({
  name: "Formatted HUD",
  apiVersion: 1,
  overlay: true,
  compute({ bar, draw }) {
    draw.table({
      position: "top-right",
      cells: [[{ text: str.format("C {0}", str.tostring(bar.close, "#.##")) }]],
    })
  },
})
`

// Exercises the `state.array` reduction surface: the analytic methods on the
// window handle (`win.stdev()`) plus the Pine-parity `array.*` free-function
// alias (`array.median(win)`). Proves the starter accepts the namespace
// end-to-end (no seam change — language features flow through the compiler).
const ARRAY_SOURCE = `import { array, defineIndicator, plot, state } from "@invinite-org/chartlang-core"

export default defineIndicator({
  name: "Rolling reductions",
  apiVersion: 1,
  overlay: true,
  compute({ bar, state, plot }) {
    const win = state.array<number>(20)
    win.push(bar.close.current)
    plot(win.stdev(), { title: "stdev" })
    plot(array.median(win), { title: "median" })
  },
})
`

// Exercises the `state.map` keyed-collection surface: a numeric `state.map`
// allocated with a literal capacity (the guard path) plus `set`/`get` with the
// `?? 0` undefined-vs-zero seed. Proves the starter accepts the primitive
// end-to-end (no seam change — language features flow through the compiler).
const MAP_SOURCE = `import { defineIndicator, plot, state } from "@invinite-org/chartlang-core"

export default defineIndicator({
  name: "Volume by level",
  apiVersion: 1,
  overlay: false,
  compute({ bar, state, plot }) {
    const levels = state.map<number, number>(64)
    const key = Math.round(bar.close.current)
    levels.set(key, (levels.get(key) ?? 0) + bar.volume.current)
    plot(levels.get(key) ?? 0, { title: "Volume at level" })
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

test("compiles a script using the math.* namespace + syminfo.mintick", async ({ request }) => {
  const res = await request.post("/api/compile", { data: { source: MATH_SOURCE } })
  expect(res.ok()).toBe(true)
  const body = await res.json()
  expect(body.ok).toBe(true)
  expect(typeof body.moduleSource).toBe("string")
  expect(body.moduleSource.length).toBeGreaterThan(0)
})

test("compiles a script using the str.* namespace in a draw.table", async ({ request }) => {
  const res = await request.post("/api/compile", { data: { source: STR_SOURCE } })
  expect(res.ok()).toBe(true)
  const body = await res.json()
  expect(body.ok).toBe(true)
  expect(typeof body.moduleSource).toBe("string")
  expect(body.moduleSource.length).toBeGreaterThan(0)
})

test("compiles a script using the state.array reduction methods + array.* alias", async ({
  request,
}) => {
  const res = await request.post("/api/compile", { data: { source: ARRAY_SOURCE } })
  expect(res.ok()).toBe(true)
  const body = await res.json()
  expect(body.ok).toBe(true)
  expect(typeof body.moduleSource).toBe("string")
  expect(body.moduleSource.length).toBeGreaterThan(0)
})

test("compiles a script using the state.map keyed collection + literal capacity", async ({
  request,
}) => {
  const res = await request.post("/api/compile", { data: { source: MAP_SOURCE } })
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
