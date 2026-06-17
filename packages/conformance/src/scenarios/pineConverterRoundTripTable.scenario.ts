// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { readFileSync } from "node:fs";

import { convert } from "@invinite-org/chartlang-pine-converter";

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

// Pine → chartlang table round-trip. The fixture is a 2-col × 5-row dashboard
// rebuilt each `barstate.islast` tick via `table.new` + a literal-bound
// `for i = 0 to 4` cell loop; the converter lowers it to a
// `useDrawingHandleSlot<"table">()` create + an immutable `draw.table({...})`
// rebuild. Conversion runs once at module load; the harness owns compile +
// runtime and pins the rebuilt-per-bar table emission stream.
const PINE_SOURCE = readFileSync(
    new URL("../../../pine-converter/fixtures/11-table-dashboard.pine", import.meta.url),
    "utf-8",
);
const CONVERTED = convert(PINE_SOURCE, { barInterval: 60_000, barIndexOrigin: 1_700_000_000_000 });
/* v8 ignore next 3 — module-load guard: the committed fixture always converts. */
if (CONVERTED.output === null) {
    throw new Error("Pine converter produced no output for the table round-trip fixture");
}
const INLINE_SOURCE = CONVERTED.output;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "3c27354272203f03c6ba25a533d66ce450a066267a8cad2655b0a850ceb97e1f",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * Pine → chartlang table round-trip scenario. Converts the dashboard-table
 * fixture, compiles the emitted chartlang, runs it through the runtime, and pins
 * the `drawing-hash` over the rebuilt-per-bar table emission stream.
 *
 * @since 0.1
 * @experimental
 * @example
 *     import { PINE_CONVERTER_ROUND_TRIP_TABLE_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void PINE_CONVERTER_ROUND_TRIP_TABLE_SCENARIO;
 */
export const PINE_CONVERTER_ROUND_TRIP_TABLE_SCENARIO: Scenario = Object.freeze({
    id: "pine-converter-round-trip-table",
    title: "Pine converter round-trip table",
    inlineSource: INLINE_SOURCE,
    intervalCount: 100,
    assertions: ASSERTIONS,
});
