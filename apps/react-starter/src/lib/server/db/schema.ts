// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Drizzle schema for the starter's single-file SQLite DB. One migration
// set covers the whole app, so the two tables Task 4 (EODData) owns are
// declared here alongside the saved-script table — Task 4 fills in the
// read/write logic over `eodCache` + `apiUsage`; this task only uses
// `scripts`.

import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core"

/** Scripts the user saves in the editor. */
export const scripts = sqliteTable("scripts", {
  id: text("id").primaryKey(), // crypto.randomUUID()
  name: text("name").notNull(),
  source: text("source").notNull(), // the .chart.ts text
  symbol: text("symbol"), // last symbol used (nullable)
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
})

/**
 * Cached EODData daily bars, keyed by symbol (one row per symbol+range).
 * Owned by Task 4 — declared here so the migration set is whole. `bars`
 * holds a serialized `Bar[]` (`@invinite-org/chartlang-core`).
 */
export const eodCache = sqliteTable(
  "eod_cache",
  {
    symbol: text("symbol").notNull(),
    rangeKey: text("range_key").notNull(), // e.g. "daily:max", "symbols:US"
    bars: text("bars", { mode: "json" }).notNull(),
    fetchedAt: integer("fetched_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.symbol, t.rangeKey] })],
)

/**
 * Per-UTC-day API-call counter protecting the EODData free tier's 100/day
 * quota. Owned by Task 4. `day` is the UTC `YYYY-MM-DD` key.
 */
export const apiUsage = sqliteTable("api_usage", {
  day: text("day").primaryKey(), // "2026-06-21" (UTC)
  calls: integer("calls").notNull().default(0),
})

/** A persisted script row (all columns). */
export type ScriptRow = typeof scripts.$inferSelect
/** Insert shape for a script row. */
export type NewScriptRow = typeof scripts.$inferInsert
