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
        // Re-pinned for the readable-identifier rename (`__lvls_ring` → `lvls`,
        // `__h` → `element`, ring helper `__HandleRing`/`__buf`/… → readable).
        // op/state/bar are byte-identical (verified by a normalised-handleId
        // rename diff); only the `handleId` callsite column shifted.
        sha256: "f357b9e5586f3813e2f50c3b2e34e78ec572a0129b5b2389dff1ed04cbca67c5",
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
 * @stable
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
