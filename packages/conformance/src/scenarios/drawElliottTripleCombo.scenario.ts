// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "draw.elliottTripleCombo demo",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            draw.elliottTripleCombo([
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_000_010_000, price: 118 },
                { time: 1_700_000_020_000, price: 108 },
                { time: 1_700_000_030_000, price: 128 },
                { time: 1_700_000_040_000, price: 118 },
                { time: 1_700_000_050_000, price: 138 },
                { time: 1_700_000_060_000, price: 126 },
            ]);
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "1938f428cf4cb84ad0be19754d30c4dd6e6acb6a8cd7f414e85d4d01ec6acf7c",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * `draw.elliottTripleCombo` conformance scenario. Emits one Elliott
 * W-X-Y-X-Z triple-three (7 anchors — landed shape) on the first bar.
 *
 * @since 0.3
 * @experimental
 * @example
 *     import { DRAW_ELLIOTT_TRIPLE_COMBO_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_ELLIOTT_TRIPLE_COMBO_SCENARIO;
 */
export const DRAW_ELLIOTT_TRIPLE_COMBO_SCENARIO: Scenario = Object.freeze({
    id: "draw-elliott-triple-combo",
    title: "draw.elliottTripleCombo(...) on a single bar",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
