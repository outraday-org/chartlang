// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Saved-script CRUD e2e against the running app's `/api/scripts` route.
// Task 3 ships only the persistence layer (the editor/sidebar UI lands in
// Task 6), so the suite POSTs straight to the endpoint via the `request`
// fixture rather than driving the DOM. It exercises the full round-trip
// through the real better-sqlite3 + Drizzle stack in the built server
// bundle: the seed exists on a fresh DB, and save → list → get → rename →
// delete all persist.

import { expect, test } from "@playwright/test"

type Meta = { id: string; name: string; symbol: string | null; updatedAt: string }
type Full = Meta & { source: string; createdAt: string }

async function list(request: import("@playwright/test").APIRequestContext): Promise<Meta[]> {
  const res = await request.get("/api/scripts")
  expect(res.ok()).toBeTruthy()
  return ((await res.json()) as { scripts: Meta[] }).scripts
}

async function op<T>(
  request: import("@playwright/test").APIRequestContext,
  payload: Record<string, unknown>,
): Promise<T> {
  const res = await request.post("/api/scripts", { data: payload })
  expect(res.ok(), `op ${String(payload.op)} should succeed`).toBeTruthy()
  return (await res.json()) as T
}

test("the seed SMA-cross script exists on a fresh DB", async ({ request }) => {
  const scripts = await list(request)
  expect(scripts.some((s) => s.name === "SMA Cross")).toBeTruthy()
})

test("save, list, get (source round-trips), rename, delete", async ({ request }) => {
  const SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";

export default defineIndicator({
  name: "e2e fixture",
  apiVersion: 1,
  compute({ bar, plot, ta }) {
    plot(ta.sma(bar.close, 7));
  },
});
`

  // Save (create) — no id, so the server mints one.
  const { script: created } = await op<{ script: Full }>(request, {
    op: "save",
    name: "e2e fixture",
    source: SOURCE,
    symbol: "AAPL",
  })
  expect(created.id).toBeTruthy()
  expect(created.name).toBe("e2e fixture")
  expect(created.symbol).toBe("AAPL")

  // List — the new script shows up (meta only, no source).
  const afterSave = await list(request)
  const meta = afterSave.find((s) => s.id === created.id)
  expect(meta).toBeTruthy()
  expect(meta).not.toHaveProperty("source")

  // Get — full source round-trips byte-for-byte.
  const { script: fetched } = await op<{ script: Full }>(request, {
    op: "get",
    id: created.id,
  })
  expect(fetched.source).toBe(SOURCE)

  // Rename.
  const { script: renamed } = await op<{ script: Full }>(request, {
    op: "rename",
    id: created.id,
    name: "renamed fixture",
  })
  expect(renamed.name).toBe("renamed fixture")

  // Delete — removed, and a follow-up get returns null.
  const { deleted } = await op<{ deleted: boolean }>(request, {
    op: "delete",
    id: created.id,
  })
  expect(deleted).toBeTruthy()

  const { script: gone } = await op<{ script: Full | null }>(request, {
    op: "get",
    id: created.id,
  })
  expect(gone).toBeNull()
})

test("oversized source is rejected with a 400 (mirrors the compile cap)", async ({ request }) => {
  const huge = "a".repeat(64 * 1024 + 1)
  const res = await request.post("/api/scripts", {
    data: { op: "save", name: "too big", source: huge },
  })
  expect(res.status()).toBe(400)
})
