// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "draw.elliottCorrectionWave demo",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            draw.elliottCorrectionWave([
                { time: 1_700_000_000_000, price: 120 },
                { time: 1_700_000_030_000, price: 100 },
                { time: 1_700_000_060_000, price: 115 },
            ]);
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "addc1a5b101e1be51d48dc116114f5d420a390fcc0364ad055c708e9a800aafd",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * `draw.elliottCorrectionWave` conformance scenario. Emits one Elliott
 * A-B-C correction (3 anchors) on the first bar.
 *
 * @since 0.3
 * @experimental
 * @example
 *     import { DRAW_ELLIOTT_CORRECTION_WAVE_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_ELLIOTT_CORRECTION_WAVE_SCENARIO;
 */
export const DRAW_ELLIOTT_CORRECTION_WAVE_SCENARIO: Scenario = Object.freeze({
    id: "draw-elliott-correction-wave",
    title: "draw.elliottCorrectionWave(...) on a single bar",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
