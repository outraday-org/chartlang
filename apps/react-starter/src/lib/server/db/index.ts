// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// server-only — this module imports `better-sqlite3` (a native addon) and
// MUST NOT enter the client graph. It is reached only through the
// `src/routes/api/scripts.ts` (and Task 4's `api/eod.ts`) server-route
// handlers, which TanStack Start keeps in the server bundle. Do NOT import
// it from any `src/components/*` file. (Task 2's client-only stub aliases
// are not relied on here — the server-route import boundary is what keeps
// the native module out of the browser.)

import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"

import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import { migrate } from "drizzle-orm/better-sqlite3/migrator"

import * as schema from "./schema"
import { seedIfEmpty } from "./seed"

/** The typed Drizzle client bound to the starter schema. */
export type StarterDb = ReturnType<typeof drizzle<typeof schema>>

const DEFAULT_URL = "file:./data/starter.db"

// Embed the generated migration files into the bundle at build time. The
// Vite/SSR server bundle does NOT ship the `migrations/` data files
// alongside the emitted JS, so resolving them relative to the module (or
// cwd) breaks in `vite build` output. Glob-importing them as raw strings
// makes them part of the JS, and we re-materialize the folder Drizzle's
// `migrate()` expects into an OS temp dir on first boot. Keys are paths
// relative to this module, e.g. "./migrations/0000_x.sql",
// "./migrations/meta/_journal.json".
const MIGRATION_FILES = import.meta.glob("./migrations/**/*.{sql,json}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>

let cached: StarterDb | null = null

// Reconstruct the on-disk migrations folder Drizzle reads (`meta/_journal.json`
// + each `<tag>.sql`) from the embedded strings, returning the temp folder
// path to hand to `migrate()`.
function materializeMigrationsFolder(): string {
  const root = mkdtempSync(join(tmpdir(), "chartlang-starter-migrations-"))
  for (const [key, contents] of Object.entries(MIGRATION_FILES)) {
    const rel = key.replace(/^\.\/migrations\//, "")
    const dest = join(root, rel)
    mkdirSync(dirname(dest), { recursive: true })
    writeFileSync(dest, contents)
  }
  return root
}

// Accept either a bare path or a `file:`-prefixed URL (drizzle-kit + the
// `.env` sample both use `file:./data/starter.db`); better-sqlite3 wants a
// filesystem path.
function resolveDbPath(): string {
  const url = process.env.DATABASE_URL ?? DEFAULT_URL
  return url.startsWith("file:") ? url.slice("file:".length) : url
}

/**
 * Lazily open (and memoize) the SQLite connection. On first open it:
 *   1. `mkdir -p`s the parent dir so a fresh clone has nowhere-to-write
 *      fixed up automatically;
 *   2. enables WAL so dev + e2e can read concurrently against one handle;
 *   3. runs any pending migrations (no manual `db:migrate` on a clone);
 *   4. seeds one starter script when the table is empty.
 * Subsequent calls return the same singleton — N callers, one handle.
 */
export function getDb(): StarterDb {
  if (cached) return cached

  const dbPath = resolveDbPath()
  const dir = dirname(dbPath)
  if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true })

  const sqlite = new Database(dbPath)
  sqlite.pragma("journal_mode = WAL")

  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: materializeMigrationsFolder() })
  seedIfEmpty(db)

  cached = db
  return db
}

export { schema }
