// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "plot-hash",
        slotId: "examples/scripts/bollinger-bands.chart.ts:12:9#0",
        sha256: "a06ec1568e2d466aa2a6e987290adadd4f552d51de5635051ad18484b1477b1e",
    },
    {
        kind: "plot-hash",
        slotId: "examples/scripts/bollinger-bands.chart.ts:13:9#0",
        sha256: "bf60790aa6a62e044a7147c1f3b1dd1ec702978a77ebe67fd032495797d87190",
    },
    {
        kind: "plot-hash",
        slotId: "examples/scripts/bollinger-bands.chart.ts:14:9#0",
        sha256: "90ef3867f1682baceab9de578e0ac4b1d2d1d08fb8b267550514d393c5b431ae",
    },
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "unsupported-plot-kind" },
]);

/**
 * Bollinger-bands scenario. Pins the upper/middle/lower band plot
 * series, asserts zero alerts, and verifies the
 * `unsupported-plot-kind` diagnostic does not surface (the script
 * uses only `line` plots, which are in the canvas2d capability bag).
 * Mirrors `examples/scripts/bollinger-bands.chart.ts`.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { BOLLINGER_BANDS_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     // BOLLINGER_BANDS_SCENARIO.assertions.length === 5
 *     void BOLLINGER_BANDS_SCENARIO;
 */
export const BOLLINGER_BANDS_SCENARIO: Scenario = Object.freeze({
    id: "bollinger-bands",
    title: "Bollinger Bands — upper/middle/lower line plots",
    scriptPath: "examples/scripts/bollinger-bands.chart.ts",
    intervalCount: 1,
    assertions: ASSERTIONS,
});
