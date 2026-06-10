// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "draw.trianglePattern demo",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            draw.trianglePattern([
                { time: 1_700_000_060_000, price: 110 },
                { time: 1_700_000_000_000, price: 130 },
                { time: 1_700_000_000_000, price: 100 },
            ]);
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "c08033b046a979263d2be76390e753afb30cd64c66098739ba99032d92c00f0d",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * `draw.trianglePattern` conformance scenario. Emits one
 * 3-anchor triangle pattern on the first bar.
 *
 * @since 0.3
 * @stable
 * @example
 *     import { DRAW_TRIANGLE_PATTERN_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_TRIANGLE_PATTERN_SCENARIO;
 */
export const DRAW_TRIANGLE_PATTERN_SCENARIO: Scenario = Object.freeze({
    id: "draw-triangle-pattern",
    title: "draw.trianglePattern(...) on a single bar",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
