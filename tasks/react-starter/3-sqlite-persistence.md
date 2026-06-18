# SQLite persistence — Drizzle + better-sqlite3

> **Status: TODO**

## Goal

Add the SQLite storage layer to `apps/react-starter`: a Drizzle schema
(saved scripts + the tables Task 4's EOD cache needs), a server-only DB
client over `better-sqlite3`, migrations, and saved-script CRUD exposed
to the UI via server functions / route handlers. After this task the UI
(Task 6) can create / list / load / rename / delete saved scripts
backed by a local `.db` file.

## Prerequisites

- Task 1 (app exists).

## Current Behavior

No persistence. There is no database, schema, or migration anywhere in
the starter.

## Desired Behavior

A single-file SQLite database (`file:./data/starter.db`, git-ignored)
stores user scripts. Drizzle gives a typed schema + migrations. The DB
is touched only on the server; the client calls typed server functions.

## Requirements

### 1. Dependencies + config

- Add `drizzle-orm`, `better-sqlite3`; dev: `drizzle-kit`,
  `@types/better-sqlite3`.
- `drizzle.config.ts` — dialect `sqlite`, schema path
  `src/lib/server/db/schema.ts`, `out: "src/lib/server/db/migrations"`,
  `dbCredentials.url` from `DATABASE_URL` (default `file:./data/starter.db`).
- `.env.example` — `DATABASE_URL=file:./data/starter.db` (plus the
  EODData key placeholder Task 4 adds).
- `.gitignore` — ignore `data/` and `*.db`.
- `package.json` scripts: `db:generate` (`drizzle-kit generate`),
  `db:migrate` (apply migrations on boot — see §3).

### 2. Schema — `src/lib/server/db/schema.ts`

```ts
// scripts the user saves in the editor
export const scripts = sqliteTable("scripts", {
    id: text("id").primaryKey(),              // nanoid/uuid
    name: text("name").notNull(),
    source: text("source").notNull(),         // the .chart.ts text
    symbol: text("symbol"),                    // last symbol used (nullable)
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});
```

Also declare the two tables **Task 4** owns (declared here so one
migration set covers the whole app — Task 4 fills the read/write logic):

```ts
// cached EODData daily bars, keyed by symbol (one row per symbol+range)
export const eodCache = sqliteTable("eod_cache", {
    symbol: text("symbol").notNull(),
    rangeKey: text("range_key").notNull(),     // e.g. "daily:max"
    bars: text("bars", { mode: "json" }).notNull(), // serialized Bar[]
    fetchedAt: integer("fetched_at", { mode: "timestamp_ms" }).notNull(),
}, (t) => ({ pk: primaryKey({ columns: [t.symbol, t.rangeKey] }) }));

// per-UTC-day API call counter to protect the 100/day free quota
export const apiUsage = sqliteTable("api_usage", {
    day: text("day").primaryKey(),             // "2026-06-18" (UTC)
    calls: integer("calls").notNull().default(0),
});
```

### 3. DB client — `src/lib/server/db/index.ts` (server-only)

- Create the `better-sqlite3` connection lazily (singleton) from
  `DATABASE_URL`, `mkdir -p` the parent dir on first open.
- Run pending migrations on first connection (Drizzle `migrate(...)`),
  so a freshly cloned project works with no manual `db:migrate` step.
- Enable WAL (`pragma journal_mode = WAL`) for concurrent reads.
- Export the typed `db` and the `schema`. This module imports
  `better-sqlite3` (native) — it MUST NOT enter the client graph; rely
  on the Task 2 client-only stub boundary + a server-only guard comment.

### 4. Saved-script API — `src/lib/server/db/scripts.ts` + server fns

Pure data functions over `db`:

- `listScripts(): Promise<ScriptMeta[]>` (id, name, symbol, updatedAt —
  **not** the full source, for a cheap sidebar list).
- `getScript(id): Promise<ScriptRow | null>`.
- `saveScript({ id?, name, source, symbol }): Promise<ScriptRow>` —
  upsert; generate id + set `createdAt` when new; bump `updatedAt`.
- `renameScript(id, name)`, `deleteScript(id)`.

Expose them through TanStack Start **server functions** (or
`src/routes/api/scripts.ts` handlers) so components call typed wrappers,
never `db` directly. Validate inputs (non-empty name, source ≤ 64 KiB to
match the compile cap).

### 5. Seed content

On first migrate, insert one starter script (a short SMA-cross example)
so the editor opens with runnable content rather than a blank pane.

### Edge cases

- **Concurrent dev + e2e** opening the same file → WAL handles it; the
  client is a singleton so we don't open N handles.
- **Missing `data/` dir** on a fresh clone → `mkdir -p` before connect.
- **Oversized source** → reject at the server-fn boundary (mirror the
  64 KiB compile cap) before it reaches the DB.
- **Native module in client graph** → assert (build) that
  `better-sqlite3` never resolves in the `client` environment.

### Test (e2e/server)

`tests/scripts.spec.ts` — through the running app: save a script, list
it, load it back (source round-trips), rename, delete; assert the seed
script exists on a fresh DB. (No coverage gate on apps; this is the
functional guard.)

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `apps/react-starter/drizzle.config.ts` | Create | drizzle-kit config |
| `apps/react-starter/src/lib/server/db/schema.ts` | Create | scripts + eodCache + apiUsage |
| `apps/react-starter/src/lib/server/db/index.ts` | Create | server-only client + auto-migrate |
| `apps/react-starter/src/lib/server/db/scripts.ts` | Create | CRUD data functions |
| `apps/react-starter/src/lib/server/db/migrations/**` | Create (generated) | drizzle migrations |
| `apps/react-starter/src/routes/api/scripts.ts` (or server fns) | Create | typed CRUD endpoints |
| `apps/react-starter/.env.example` | Modify | `DATABASE_URL` |
| `apps/react-starter/.gitignore` | Modify | `data/`, `*.db` |
| `apps/react-starter/package.json` | Modify | drizzle deps + db scripts |
| `apps/react-starter/tests/scripts.spec.ts` | Create | CRUD e2e |

## Gates

- `pnpm typecheck`
- `pnpm --filter chartlang-react-starter build`
- `pnpm --filter chartlang-react-starter e2e` (scripts CRUD)
- No coverage/changeset gate (apps-exempt).

## Changeset

None — `apps/*` is changeset-exempt.

## Acceptance Criteria

- A fresh clone auto-creates `data/starter.db`, runs migrations, and
  seeds one example script with no manual step.
- Save / list / get / rename / delete work end-to-end; source round-trips
  byte-for-byte.
- `better-sqlite3` never enters the client bundle.
- `eod_cache` + `api_usage` tables exist for Task 4 to consume.
</content>
