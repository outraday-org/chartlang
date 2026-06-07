// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "draw.elliottTriangleWave demo",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            draw.elliottTriangleWave([
                { time: 1_700_000_000_000, price: 120 },
                { time: 1_700_000_015_000, price: 100 },
                { time: 1_700_000_030_000, price: 115 },
                { time: 1_700_000_045_000, price: 105 },
                { time: 1_700_000_060_000, price: 110 },
            ]);
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "675ac9ea17dc593e4e2d42672f9f48c0b6dd8b622c795c32aa18a91798a883f4",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * `draw.elliottTriangleWave` conformance scenario. Emits one Elliott
 * five-wave triangle correction (5 anchors) on the first bar.
 *
 * @since 0.3
 * @experimental
 * @example
 *     import { DRAW_ELLIOTT_TRIANGLE_WAVE_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_ELLIOTT_TRIANGLE_WAVE_SCENARIO;
 */
export const DRAW_ELLIOTT_TRIANGLE_WAVE_SCENARIO: Scenario = Object.freeze({
    id: "draw-elliott-triangle-wave",
    title: "draw.elliottTriangleWave(...) on a single bar",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
