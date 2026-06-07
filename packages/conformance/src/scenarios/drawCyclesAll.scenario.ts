// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

// Bundle scenario for Task 17 — emits one drawing per cycle kind on
// the first bar = 3 emissions total. All 3 map to the `other` bucket.
const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "drawCyclesAll bundle",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            draw.cyclicLines(
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_000_060_000, price: 100 },
            );
            draw.timeCycles(
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_000_060_000, price: 100 },
            );
            draw.sineLine(
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_000_060_000, price: 120 },
            );
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "ef46754f39121d01089c1c53bf1efaeadfd243d849333cc669dd5574e39cc80b",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * Task-17 category-bundle conformance scenario. Emits one drawing per
 * cycle kind on the first bar (3 emissions total) and pins one
 * `drawing-hash` across all 3.
 *
 * @since 0.3
 * @experimental
 * @example
 *     import { DRAW_CYCLES_ALL_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_CYCLES_ALL_SCENARIO;
 */
export const DRAW_CYCLES_ALL_SCENARIO: Scenario = Object.freeze({
    id: "draw-cycles-all",
    title: "Task 17 cycles-all bundle (3 cycle kinds)",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
