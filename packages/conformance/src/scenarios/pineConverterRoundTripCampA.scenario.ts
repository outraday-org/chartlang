// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { readFileSync } from "node:fs";

import { convert } from "@invinite-org/chartlang-pine-converter";

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

// Pine → chartlang Camp A round-trip. The fixture is a `var line lvl = na`
// single-handle script gated on `barstate.islast`; the converter lowers it to
// a `useDrawingHandleSlot<"line">()` create + setter-fold update, which the
// harness compiles via `@invinite-org/chartlang-compiler` and runs through the
// runtime. Conversion runs once at module load so `INLINE_SOURCE` is a static
// string the harness can compile — the scenario never drives the runtime itself.
const PINE_SOURCE = readFileSync(
    new URL("../../../pine-converter/fixtures/02-camp-a-single-line.pine", import.meta.url),
    "utf-8",
);
const CONVERTED = convert(PINE_SOURCE, { barInterval: 60_000, barIndexOrigin: 1_700_000_000_000 });
/* v8 ignore next 3 — module-load guard: the committed fixture always converts. */
if (CONVERTED.output === null) {
    throw new Error("Pine converter produced no output for the Camp A round-trip fixture");
}
const INLINE_SOURCE = CONVERTED.output;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "90e6f81251917c9ce756d28113ea0ae85dc20f6f780834b76b9961969cabb9d5",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * Pine → chartlang Camp A round-trip scenario. Converts the `var line` /
 * `barstate.islast` fixture, compiles the emitted chartlang, runs it through the
 * runtime, and pins the `drawing-hash` over the full drawing-emission stream.
 *
 * @since 0.1
 * @experimental
 * @example
 *     import { PINE_CONVERTER_ROUND_TRIP_CAMP_A_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void PINE_CONVERTER_ROUND_TRIP_CAMP_A_SCENARIO;
 */
export const PINE_CONVERTER_ROUND_TRIP_CAMP_A_SCENARIO: Scenario = Object.freeze({
    id: "pine-converter-round-trip-camp-a",
    title: "Pine converter round-trip Camp A",
    inlineSource: INLINE_SOURCE,
    intervalCount: 100,
    assertions: ASSERTIONS,
});
