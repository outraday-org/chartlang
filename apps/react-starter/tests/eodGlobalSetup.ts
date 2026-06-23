// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// Playwright globalSetup — delete the dedicated e2e SQLite DB (+ its WAL
// sidecars) before the run so the daily-bars cache starts clean every time.
// Without this, a re-run would see prior cache hits and the eod assertions
// (source:"network" on the first load, then "cache" on the repeat) would be
// non-deterministic. The app re-creates + migrates + seeds the DB on first
// boot, so deleting it is safe. Matches DATABASE_URL=file:./data/e2e.db in
// playwright.config.ts.

import { rmSync } from "node:fs"

export default function globalSetup(): void {
  for (const suffix of ["", "-wal", "-shm"]) {
    rmSync(`data/e2e.db${suffix}`, { force: true })
  }
}
