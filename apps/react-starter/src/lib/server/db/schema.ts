// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Drizzle schema for the starter's single-file SQLite DB. One migration
// set covers the whole app: the saved-script table plus the `eodCache`
// table that backs the daily-bar read-through cache.
//
// NOTE: the baseline migration also created a legacy `api_usage` table for an
// earlier metered data source; the app no longer reads or writes it (the Yahoo
// source is unmetered), so it is intentionally absent from this schema. The
// table is harmlessly left in any existing DB.

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
 * Cached daily bars, keyed by symbol (one row per symbol+range). `bars` holds
 * a serialized `Bar[]` (`@invinite-org/chartlang-core`); the read-through cache
 * (`src/lib/server/eod/cache.ts`) refreshes each symbol once a day.
 */
export const eodCache = sqliteTable(
  "eod_cache",
  {
    symbol: text("symbol").notNull(),
    rangeKey: text("range_key").notNull(), // e.g. "daily:max"
    bars: text("bars", { mode: "json" }).notNull(),
    fetchedAt: integer("fetched_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.symbol, t.rangeKey] })],
)

/** A persisted script row (all columns). */
export type ScriptRow = typeof scripts.$inferSelect
/** Insert shape for a script row. */
export type NewScriptRow = typeof scripts.$inferInsert
