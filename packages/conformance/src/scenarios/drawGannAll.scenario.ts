// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

// Bundle scenario for Task 13 — emits one drawing per gann kind on the
// first bar (4 emissions). All 4 map to the `other` bucket.
const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "drawGannAll bundle",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            draw.gannBox(
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_030_000_000, price: 120 },
            );
            draw.gannSquareFixed({ time: 1_700_000_000_000, price: 100 });
            draw.gannSquare(
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_030_000_000, price: 120 },
            );
            draw.gannFan(
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_030_000_000, price: 120 },
            );
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "53af58b7b3c5a284c5f359597198a0a1f3f3fb0e7e854bf882cd15167443ae92",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * Task-13 category-bundle conformance scenario. Emits one drawing per
 * gann kind on the first bar (4 emissions) and pins one
 * `drawing-hash` across all 4.
 *
 * @since 0.3
 * @experimental
 * @example
 *     import { DRAW_GANN_ALL_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_GANN_ALL_SCENARIO;
 */
export const DRAW_GANN_ALL_SCENARIO: Scenario = Object.freeze({
    id: "draw-gann-all",
    title: "Task 13 gann-all bundle (all 4 gann kinds on a single bar)",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
