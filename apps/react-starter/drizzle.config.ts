// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// drizzle-kit config — drives `pnpm db:generate` (emit migration SQL from
// schema.ts) and `pnpm db:migrate`. The runtime auto-migrates on first DB
// open (src/lib/server/db/index.ts), so `db:migrate` is only needed when
// you want to apply migrations without booting the app. This file is run
// by the drizzle-kit CLI in Node; it never enters the app bundle.

import { defineConfig } from "drizzle-kit"

// Mirror the runtime default so `db:generate`/`db:migrate` hit the same
// file the app opens. `file:` URLs are accepted as-is by drizzle-kit.
const url = process.env.DATABASE_URL ?? "file:./data/starter.db"

export default defineConfig({
  dialect: "sqlite",
  schema: "src/lib/server/db/schema.ts",
  out: "src/lib/server/db/migrations",
  dbCredentials: { url },
})
