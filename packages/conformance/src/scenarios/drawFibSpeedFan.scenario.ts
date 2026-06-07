// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "draw.fibSpeedFan demo",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            draw.fibSpeedFan(
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
        sha256: "97034d13907120d493cdc536d636615d9f3b1008b0ed6eab8ec00d0381e41072",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * `draw.fibSpeedFan` conformance scenario. Emits one fib-speed-fan on
 * the first bar with `goldenBars[0]` and `goldenBars[500]` as the
 * pivot+reference anchors.
 *
 * @since 0.3
 * @experimental
 * @example
 *     import { DRAW_FIB_SPEED_FAN_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_FIB_SPEED_FAN_SCENARIO;
 */
export const DRAW_FIB_SPEED_FAN_SCENARIO: Scenario = Object.freeze({
    id: "draw-fib-speed-fan",
    title: "draw.fibSpeedFan(...) on a single bar",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
