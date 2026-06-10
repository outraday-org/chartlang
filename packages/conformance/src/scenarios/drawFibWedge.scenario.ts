// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "draw.fibWedge demo",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            draw.fibWedge(
                [
                    { time: 1_700_000_000_000, price: 100 },
                    { time: 1_700_030_000_000, price: 130 },
                    { time: 1_700_030_000_000, price: 70 },
                ],
                { showLabels: true },
            );
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "c2e270f45aa76b8d39ca16364c3505cae8bd35f845043887ebb55ec2d743cd26",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * `draw.fibWedge` conformance scenario. Emits one fib-wedge on the
 * first bar with a pivot at `goldenBars[0]` and range anchors above
 * and below at `goldenBars[500]`.
 *
 * @since 0.3
 * @stable
 * @example
 *     import { DRAW_FIB_WEDGE_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_FIB_WEDGE_SCENARIO;
 */
export const DRAW_FIB_WEDGE_SCENARIO: Scenario = Object.freeze({
    id: "draw-fib-wedge",
    title: "draw.fibWedge(...) on a single bar",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
