// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "draw.fibSpiral demo",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            draw.fibSpiral(
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
        sha256: "a4b312589399ce7102de3b8111146861ee79f62d03713da911483e5f301cf048",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * `draw.fibSpiral` conformance scenario. Emits one fib-spiral on the
 * first bar with `goldenBars[0]` and `goldenBars[500]` as the centre
 * + initial-radius edge anchors.
 *
 * @since 0.3
 * @stable
 * @example
 *     import { DRAW_FIB_SPIRAL_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_FIB_SPIRAL_SCENARIO;
 */
export const DRAW_FIB_SPIRAL_SCENARIO: Scenario = Object.freeze({
    id: "draw-fib-spiral",
    title: "draw.fibSpiral(...) on a single bar",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
