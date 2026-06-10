// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

// Bundle scenario for Task 16 — emits one drawing per Elliott-wave
// kind on the first bar = 5 emissions total. All 5 map to the
// `polylines` bucket.
const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "drawElliottAll bundle",
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
            draw.elliottCorrectionWave([
                { time: 1_700_000_000_000, price: 120 },
                { time: 1_700_000_030_000, price: 100 },
                { time: 1_700_000_060_000, price: 115 },
            ]);
            draw.elliottTriangleWave([
                { time: 1_700_000_000_000, price: 120 },
                { time: 1_700_000_015_000, price: 100 },
                { time: 1_700_000_030_000, price: 115 },
                { time: 1_700_000_045_000, price: 105 },
                { time: 1_700_000_060_000, price: 110 },
            ]);
            draw.elliottDoubleCombo([
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_000_010_000, price: 115 },
                { time: 1_700_000_020_000, price: 108 },
                { time: 1_700_000_030_000, price: 125 },
                { time: 1_700_000_040_000, price: 116 },
                { time: 1_700_000_050_000, price: 135 },
                { time: 1_700_000_060_000, price: 124 },
            ]);
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
        sha256: "ace1588ded9e0b23bcfdcae9cd76683b11e9c7ff5b4cfbdbdec13f693e9c6e65",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * Task-16 category-bundle conformance scenario. Emits one drawing per
 * Elliott-wave kind on the first bar (5 emissions total) and pins one
 * `drawing-hash` across all 5.
 *
 * @since 0.3
 * @stable
 * @example
 *     import { DRAW_ELLIOTT_ALL_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_ELLIOTT_ALL_SCENARIO;
 */
export const DRAW_ELLIOTT_ALL_SCENARIO: Scenario = Object.freeze({
    id: "draw-elliott-all",
    title: "Task 16 elliott-all bundle (5 Elliott-wave kinds)",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
