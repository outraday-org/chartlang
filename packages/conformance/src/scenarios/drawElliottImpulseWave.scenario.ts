// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "draw.elliottImpulseWave demo",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            draw.elliottImpulseWave([
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_000_015_000, price: 120 },
                { time: 1_700_000_030_000, price: 105 },
                { time: 1_700_000_045_000, price: 135 },
                { time: 1_700_000_060_000, price: 115 },
            ]);
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "31e7c3bbd38d301992fdd342ea6231857cbcc0e1ceb72277a29a1fd912e7ba82",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * `draw.elliottImpulseWave` conformance scenario. Emits one Elliott
 * five-wave impulse (5 anchors) on the first bar.
 *
 * @since 0.3
 * @stable
 * @example
 *     import { DRAW_ELLIOTT_IMPULSE_WAVE_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_ELLIOTT_IMPULSE_WAVE_SCENARIO;
 */
export const DRAW_ELLIOTT_IMPULSE_WAVE_SCENARIO: Scenario = Object.freeze({
    id: "draw-elliott-impulse-wave",
    title: "draw.elliottImpulseWave(...) on a single bar",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
