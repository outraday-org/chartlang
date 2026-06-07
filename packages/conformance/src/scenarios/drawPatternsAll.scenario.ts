// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

// Bundle scenario for Task 15 — emits one drawing per harmonic
// pattern kind on the first bar = 6 emissions total. All 6 map to
// the `polylines` bucket. The `cypherPattern` kind has no standalone
// invinite tool — its emit + render paths mirror `xabcdPattern`'s
// shape, with the discriminator narrowed to "cypher-pattern".
const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "drawPatternsAll bundle",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            draw.xabcdPattern([
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_000_015_000, price: 120 },
                { time: 1_700_000_030_000, price: 105 },
                { time: 1_700_000_045_000, price: 135 },
                { time: 1_700_000_060_000, price: 115 },
            ]);
            draw.cypherPattern([
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_000_015_000, price: 130 },
                { time: 1_700_000_030_000, price: 110 },
                { time: 1_700_000_045_000, price: 145 },
                { time: 1_700_000_060_000, price: 118 },
            ]);
            draw.headAndShoulders([
                { time: 1_700_000_000_000, price: 120 },
                { time: 1_700_000_015_000, price: 100 },
                { time: 1_700_000_030_000, price: 140 },
                { time: 1_700_000_045_000, price: 100 },
                { time: 1_700_000_060_000, price: 118 },
            ]);
            draw.abcdPattern([
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_000_020_000, price: 120 },
                { time: 1_700_000_040_000, price: 105 },
                { time: 1_700_000_060_000, price: 130 },
            ]);
            draw.trianglePattern([
                { time: 1_700_000_060_000, price: 110 },
                { time: 1_700_000_000_000, price: 130 },
                { time: 1_700_000_000_000, price: 100 },
            ]);
            draw.threeDrivesPattern([
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
        sha256: "0acd983b2520093034554c14483b55731f11ceb732b557999447f21a6b17a234",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * Task-15 category-bundle conformance scenario. Emits one drawing
 * per harmonic-pattern kind on the first bar (6 emissions total) and
 * pins one `drawing-hash` across all 6.
 *
 * @since 0.3
 * @experimental
 * @example
 *     import { DRAW_PATTERNS_ALL_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_PATTERNS_ALL_SCENARIO;
 */
export const DRAW_PATTERNS_ALL_SCENARIO: Scenario = Object.freeze({
    id: "draw-patterns-all",
    title: "Task 15 patterns-all bundle (6 harmonic-pattern kinds)",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
