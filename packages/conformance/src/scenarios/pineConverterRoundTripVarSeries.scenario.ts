// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { readFileSync } from "node:fs";

import { convert } from "@invinite-org/chartlang-pine-converter";

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

// Pine → chartlang round-trip for the `var x := …; x[1]` → `state.series`
// lowering. The fixture is a `var float prev = na` scalar read with history
// (`prev[1]`); the converter lowers it to `const prev = state.series(Number
// .NaN)` with bare `prev[1]` history, which the harness compiles via
// `@invinite-org/chartlang-compiler` and runs through the runtime. Conversion
// runs once at module load so `INLINE_SOURCE` is a static string the harness
// can compile — the scenario never drives the runtime itself.
const PINE_SOURCE = readFileSync(
    new URL("../../../pine-converter/fixtures/30-var-series-history.pine", import.meta.url),
    "utf-8",
);
const CONVERTED = convert(PINE_SOURCE, { barInterval: 60_000, barIndexOrigin: 1_700_000_000_000 });
/* v8 ignore next 3 — module-load guard: the committed fixture always converts. */
if (CONVERTED.output === null) {
    throw new Error("Pine converter produced no output for the var-series round-trip fixture");
}
const INLINE_SOURCE = CONVERTED.output;

// `plot(delta)` is the first plot callsite; `plot(prev[1])` the second. Both
// are pinned over the full `{ bar, value }` emission stream — the proof that
// the lowered `state.series` carries history that survives convert → compile →
// runtime. Re-pin via the runner's "expected vs actual" message if the golden
// bars change.
const DELTA_HASH = "74980a551c882e7696ea55bc7b7b7fd7426eb90c142ccc27a4d5b2fbb7df6c65";
const PREV_LAG_HASH = "39483f5ebaee134fd37d020d2cf261d3e39d9ddc254ee3999c74ad8f4b400691";

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "plot-hash",
        slotId: "<inline:pine-converter-round-trip-var-series>.chart.ts:21:13#0",
        sha256: DELTA_HASH,
    },
    {
        kind: "plot-hash",
        slotId: "<inline:pine-converter-round-trip-var-series>.chart.ts:22:13#0",
        sha256: PREV_LAG_HASH,
    },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
]);

/**
 * Pine → chartlang round-trip scenario for the history-indexed `var` →
 * `state.series` lowering. Converts the `30-var-series-history` fixture (a
 * `var float prev = na` scalar read with `prev[1]`), compiles the emitted
 * chartlang, runs it through the runtime, and pins both plots (`delta` and the
 * lagged `prev[1]`) over the full `{ bar, value }` emission stream.
 *
 * @since 1.4
 * @stable
 * @example
 *     import { PINE_CONVERTER_ROUND_TRIP_VAR_SERIES_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void PINE_CONVERTER_ROUND_TRIP_VAR_SERIES_SCENARIO;
 */
export const PINE_CONVERTER_ROUND_TRIP_VAR_SERIES_SCENARIO: Scenario = Object.freeze({
    id: "pine-converter-round-trip-var-series",
    title: "Pine converter round-trip var → state.series history",
    inlineSource: INLINE_SOURCE,
    intervalCount: 100,
    assertions: ASSERTIONS,
});
