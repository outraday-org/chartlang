// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

// Per task spec: anchors leg = `bars[0].time` → `bars[500].time`.
// goldenBars[0].time = 1_700_000_000_000; goldenBars[500].time =
// 1_700_030_000_000 (60s bars, 60_000 ms each).
const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "draw.fibRetracement demo",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            draw.fibRetracement(
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_030_000_000, price: 120 },
                { showLabels: true, extendRight: true },
            );
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "434a63b1bc4ad70a8a4bdbc003802dfbf8496c2490fc18f34e5fb70e7b2b739b",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * `draw.fibRetracement` conformance scenario. Emits one fib-retracement
 * on the first bar using `goldenBars[0]` → `goldenBars[500]` as the
 * swing leg, with the default {@link FIB_LEVELS} array and right-edge
 * extension.
 *
 * @since 0.3
 * @stable
 * @example
 *     import { DRAW_FIB_RETRACEMENT_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_FIB_RETRACEMENT_SCENARIO;
 */
export const DRAW_FIB_RETRACEMENT_SCENARIO: Scenario = Object.freeze({
    id: "draw-fib-retracement",
    title: "draw.fibRetracement(...) on a single bar",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
