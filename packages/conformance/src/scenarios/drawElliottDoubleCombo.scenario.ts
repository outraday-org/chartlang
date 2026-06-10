// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "draw.elliottDoubleCombo demo",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            draw.elliottDoubleCombo([
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_000_010_000, price: 115 },
                { time: 1_700_000_020_000, price: 108 },
                { time: 1_700_000_030_000, price: 125 },
                { time: 1_700_000_040_000, price: 116 },
                { time: 1_700_000_050_000, price: 135 },
                { time: 1_700_000_060_000, price: 124 },
            ]);
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "83814c1079b036eeb9a158dd84799403157a5fb4fad067bd3b4dd446713aad37",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * `draw.elliottDoubleCombo` conformance scenario. Emits one Elliott
 * W-X-Y double-three (7 anchors) on the first bar.
 *
 * @since 0.3
 * @stable
 * @example
 *     import { DRAW_ELLIOTT_DOUBLE_COMBO_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_ELLIOTT_DOUBLE_COMBO_SCENARIO;
 */
export const DRAW_ELLIOTT_DOUBLE_COMBO_SCENARIO: Scenario = Object.freeze({
    id: "draw-elliott-double-combo",
    title: "draw.elliottDoubleCombo(...) on a single bar",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
