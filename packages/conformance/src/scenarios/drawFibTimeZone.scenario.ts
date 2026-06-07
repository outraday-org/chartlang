// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "draw.fibTimeZone demo",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            draw.fibTimeZone(
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_030_000_000, price: 100 },
                { showLabels: true },
            );
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "a373bd4339f8166312f5d6818a0fc78cd23462a899b9a90e6b0d73b51d52dd0a",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * `draw.fibTimeZone` conformance scenario. Emits one fib-time-zone
 * on the first bar with vertical zones at the default fib-ratio
 * spacings between `goldenBars[0]` and `goldenBars[500]`.
 *
 * @since 0.3
 * @experimental
 * @example
 *     import { DRAW_FIB_TIME_ZONE_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_FIB_TIME_ZONE_SCENARIO;
 */
export const DRAW_FIB_TIME_ZONE_SCENARIO: Scenario = Object.freeze({
    id: "draw-fib-time-zone",
    title: "draw.fibTimeZone(...) on a single bar",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
