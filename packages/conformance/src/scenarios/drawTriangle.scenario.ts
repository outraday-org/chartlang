// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "draw.triangle demo",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            draw.triangle(
                [
                    { time: 1_700_000_000_000, price: 100 },
                    { time: 1_700_030_000_000, price: 120 },
                    { time: 1_700_060_000_000, price: 100 },
                ],
                { stroke: "#ef4444", fill: "#fee2e2", fillAlpha: 0.5 },
            );
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "96761e70492232956d644b42f8661a68ee660dc1d038632a696388df666e5386",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * `draw.triangle` conformance scenario. Emits one three-vertex
 * triangle drawing on the first bar. Distinct from
 * `draw.trianglePattern` (Task 15) which is a five-anchor harmonic
 * pattern.
 *
 * @since 0.3
 * @stable
 * @example
 *     import { DRAW_TRIANGLE_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_TRIANGLE_SCENARIO;
 */
export const DRAW_TRIANGLE_SCENARIO: Scenario = Object.freeze({
    id: "draw-triangle",
    title: "draw.triangle(...) on a single bar",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
