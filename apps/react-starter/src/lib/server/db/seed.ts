// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.
//
// server-only — first-boot seed for the saved-scripts table. Imported only
// by the DB client (index.ts), which the api/scripts route reaches; never
// part of the client graph.

import { sql } from "drizzle-orm"

import type { StarterDb } from "./index"
import { scripts } from "./schema"

// A short, runnable SMA-cross indicator so the editor opens with real
// content rather than a blank pane. Authored inline (the app bundle can't
// read example files from disk); mirrors the `defineIndicator` / `ta.sma` /
// `plot` / `ta.crossover` surface of examples/scripts/ema-cross.chart.ts.
export const SEED_SCRIPT_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "SMA Cross",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot, alert }) {
        const fast = ta.sma(bar.close, 10);
        const slow = ta.sma(bar.close, 30);

        plot(fast, { color: "#26a69a", title: "SMA(10)" });
        plot(slow, { color: "#ef5350", title: "SMA(30)" });

        if (ta.crossover(fast, slow).current) {
            alert("SMA(10) crossed above SMA(30)", { severity: "info" });
        }
        if (ta.crossunder(fast, slow).current) {
            alert("SMA(10) crossed below SMA(30)", { severity: "warning" });
        }
    },
});
`

/**
 * Insert the starter script iff the `scripts` table is empty. Idempotent:
 * a re-open of an existing DB (or a DB the user has already populated)
 * leaves it untouched, so the seed never clobbers user content.
 */
export function seedIfEmpty(db: StarterDb): void {
  const [{ count }] = db
    .select({ count: sql<number>`count(*)` })
    .from(scripts)
    .all()
  if (count > 0) return

  const now = new Date()
  db.insert(scripts)
    .values({
      id: crypto.randomUUID(),
      name: "SMA Cross",
      source: SEED_SCRIPT_SOURCE,
      symbol: null,
      createdAt: now,
      updatedAt: now,
    })
    .run()
}
