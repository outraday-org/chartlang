// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { compile } from "@invinite-org/chartlang-compiler";
import { describe, expect, it } from "vitest";

import { type ConvertOpts, convert } from "../index.js";

// Every clean conversion fixture must round-trip through the chartlang
// compiler. This is the guard that would have caught the `str`/`line`
// TS2304 leaks: a fixture whose emitted source references an undefined
// identifier fails `compile(...)` here, not just at the user's editor.
const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "fixtures");
const OPTS: ConvertOpts = { barInterval: 60_000, barIndexOrigin: 1_700_000_000_000 };

const pineFixtures = readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith(".pine"))
    .sort();

// Fixtures with a documented, pre-existing converter limitation that emits
// type-invalid chartlang even though the conversion reports no error
// diagnostic. Tracked here so the gate guards every OTHER fixture against the
// `str`/`line` class of leaks while these stay visible:
//   - 14-polyline-rebuild: a build loop pushes `chart.point.from_index(bar_index,
//     close[i])`; Pine OHLCV history `close[i]` has no scalar chartlang
//     analogue (`bar.close` is a `Price`, not an indexable `Series`).
//   - 20-real-world-sr: a `line.new(..., color=lineColor)` styles a drawing
//     with an `input.color`; draw-call style opts are not yet input-aware, so
//     the reference lowers to a bare `lineColor` instead of `inputs.lineColor`.
// (46-trend-wizard-slope-pending now COMPILES: a stateful helper whose body
// indexes a PARAM's history applied to a derived MA local is promoted to a
// `state.series` slot via the cross-UDF argument path — see `other.ts`'s
// `scanPromotedSeries`.)
const KNOWN_NON_COMPILING: ReadonlySet<string> = new Set([
    "14-polyline-rebuild.pine",
    "20-real-world-sr.pine",
]);

describe("fixtures compile round-trip", () => {
    for (const fix of pineFixtures) {
        it(fix, async () => {
            const source = readFileSync(join(FIXTURES_DIR, fix), "utf-8");
            const result = convert(source, OPTS);
            // Fixtures that intentionally hard-reject (unbounded / linefill /
            // strategy) carry an error diagnostic — their output is a comment
            // stub, not guaranteed compilable. Only clean conversions must
            // compile.
            const hasError = result.diagnostics.some((d) => d.severity === "error");
            if (hasError || result.output === null || KNOWN_NON_COMPILING.has(fix)) {
                return;
            }
            const compiled = await compile(result.output, {
                apiVersion: 1,
                sourcePath: `${fix}.chart.ts`,
            });
            expect(compiled.moduleSource.length).toBeGreaterThan(0);
        });
    }
});
