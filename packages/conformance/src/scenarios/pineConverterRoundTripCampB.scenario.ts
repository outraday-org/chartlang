// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { readFileSync } from "node:fs";

import { convert } from "@invinite-org/chartlang-pine-converter";

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

// Pine → chartlang Camp B round-trip. The fixture is a `var array<line>` pivot
// ring filled by `array.push(coll, line.new(...))` under a per-bar condition with
// `array.size`-gated FIFO eviction; the converter lowers it to a single
// `useDrawingHandleRing<"line">(K)` push callsite. Because the push fires on a
// per-bar condition (not just `barstate.islast`), the emitted stream is rich —
// many `op: "create"` plus `op: "remove"` evictions across the bar stream.
// Conversion runs once at module load; the harness owns compile + runtime.
const PINE_SOURCE = readFileSync(
    new URL("../../../pine-converter/fixtures/06-camp-b-pivot-lines.pine", import.meta.url),
    "utf-8",
);
const CONVERTED = convert(PINE_SOURCE, { barInterval: 60_000, barIndexOrigin: 1_700_000_000_000 });
/* v8 ignore next 3 — module-load guard: the committed fixture always converts. */
if (CONVERTED.output === null) {
    throw new Error("Pine converter produced no output for the Camp B round-trip fixture");
}
const INLINE_SOURCE = CONVERTED.output;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "9b835038dd9d9472025060ba7f5364be3838b5c671cb62672d5cd72b67f3ec2a",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * Pine → chartlang Camp B round-trip scenario. Converts the bounded-ring pivot
 * fixture, compiles the emitted chartlang, runs it through the runtime, and pins
 * the `drawing-hash` over the full ring create/evict emission stream. The
 * converter-side `ring-eviction-implicit` diagnostic is asserted in the
 * per-fixture golden JSON, not here — the harness only sees runtime diagnostics.
 *
 * @since 0.1
 * @experimental
 * @example
 *     import { PINE_CONVERTER_ROUND_TRIP_CAMP_B_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void PINE_CONVERTER_ROUND_TRIP_CAMP_B_SCENARIO;
 */
export const PINE_CONVERTER_ROUND_TRIP_CAMP_B_SCENARIO: Scenario = Object.freeze({
    id: "pine-converter-round-trip-camp-b",
    title: "Pine converter round-trip Camp B",
    inlineSource: INLINE_SOURCE,
    intervalCount: 100,
    assertions: ASSERTIONS,
});
