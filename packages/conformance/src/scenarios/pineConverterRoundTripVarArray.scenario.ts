// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { readFileSync } from "node:fs";

import { convert } from "@invinite-org/chartlang-pine-converter";

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

// Pine → chartlang round-trip for the bounded numeric `var array<float>` →
// `state.array` lowering. The fixture is a `var array<float>` ring with FIFO
// eviction (`array.push` + `if array.size(win) > 20` → `array.shift`); the
// converter lowers it to `const win = state.array<number>(20)` with the
// eviction block elided and `array.last`/`array.get`/`array.size` rewritten to
// the handle methods, which the harness compiles via
// `@invinite-org/chartlang-compiler` and runs through the runtime. Conversion
// runs once at module load so `INLINE_SOURCE` is a static string the harness
// can compile — the scenario never drives the runtime itself.
const PINE_SOURCE = readFileSync(
    new URL("../../../pine-converter/fixtures/31-var-array-window.pine", import.meta.url),
    "utf-8",
);
const CONVERTED = convert(PINE_SOURCE, { barInterval: 60_000, barIndexOrigin: 1_700_000_000_000 });
/* v8 ignore next 3 — module-load guard: the committed fixture always converts. */
if (CONVERTED.output === null) {
    throw new Error("Pine converter produced no output for the var-array round-trip fixture");
}
const INLINE_SOURCE = CONVERTED.output;

// `plot((newest + prevDay) / count)` is the only plot callsite — pinned over
// the full `{ bar, value }` emission stream, the proof that the lowered
// `state.array` accumulates, FIFO-evicts, and reads back (`last`/`get`/`size`)
// across convert → compile → runtime. Re-pin via the runner's "expected vs
// actual" message if the golden bars change.
const WINDOW_HASH = "bf1768c25b35f86b1e09b01ffcb0563075e2e4695a223591d10bd8747296785c";

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "plot-hash",
        slotId: "<inline:pine-converter-round-trip-var-array>.chart.ts:23:13#0",
        sha256: WINDOW_HASH,
    },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
]);

/**
 * Pine → chartlang round-trip scenario for the bounded numeric `var array` →
 * `state.array` lowering. Converts the `31-var-array-window` fixture (a
 * `var array<float>` ring with FIFO eviction), compiles the emitted chartlang,
 * runs it through the runtime, and pins the window plot over the full
 * `{ bar, value }` emission stream.
 *
 * @since 1.4
 * @stable
 * @example
 *     import { PINE_CONVERTER_ROUND_TRIP_VAR_ARRAY_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void PINE_CONVERTER_ROUND_TRIP_VAR_ARRAY_SCENARIO;
 */
export const PINE_CONVERTER_ROUND_TRIP_VAR_ARRAY_SCENARIO: Scenario = Object.freeze({
    id: "pine-converter-round-trip-var-array",
    title: "Pine converter round-trip var array → state.array",
    inlineSource: INLINE_SOURCE,
    intervalCount: 100,
    assertions: ASSERTIONS,
});
