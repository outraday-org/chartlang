// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "draw.fibSpeedArcs demo",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            draw.fibSpeedArcs(
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
        sha256: "6a50f79e6e69bade583acfb83a564667c5116a4bf1fe515ca17c8dd21bd8e8d8",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * `draw.fibSpeedArcs` conformance scenario. Emits one fib-speed-arcs on
 * the first bar with `goldenBars[0]` and `goldenBars[500]` as the
 * centre + edge anchors.
 *
 * @since 0.3
 * @experimental
 * @example
 *     import { DRAW_FIB_SPEED_ARCS_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_FIB_SPEED_ARCS_SCENARIO;
 */
export const DRAW_FIB_SPEED_ARCS_SCENARIO: Scenario = Object.freeze({
    id: "draw-fib-speed-arcs",
    title: "draw.fibSpeedArcs(...) on a single bar",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
