// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "draw.fibCircles demo",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            draw.fibCircles(
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_030_000_000, price: 120 },
                { showLabels: true },
            );
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "ab5fb7280e9441aa41321b3adf3464a8f2ec1aa484b71038393e486b2d9a3f7e",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * `draw.fibCircles` conformance scenario. Emits one fib-circles on the
 * first bar with `goldenBars[0]` and `goldenBars[500]` as the centre
 * + radius-point anchors.
 *
 * @since 0.3
 * @stable
 * @example
 *     import { DRAW_FIB_CIRCLES_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_FIB_CIRCLES_SCENARIO;
 */
export const DRAW_FIB_CIRCLES_SCENARIO: Scenario = Object.freeze({
    id: "draw-fib-circles",
    title: "draw.fibCircles(...) on a single bar",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
