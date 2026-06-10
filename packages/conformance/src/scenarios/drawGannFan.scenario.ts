// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "draw.gannFan demo",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
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
        sha256: "edbb0157e39987b28e75ed4b6e51eb8ce44cc7c1308c1a7167d6bb63f29cce75",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * `draw.gannFan` conformance scenario. Emits one gann-fan on the first
 * bar with `goldenBars[0]` as the pivot and `goldenBars[500]` as the
 * reference point.
 *
 * @since 0.3
 * @stable
 * @example
 *     import { DRAW_GANN_FAN_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_GANN_FAN_SCENARIO;
 */
export const DRAW_GANN_FAN_SCENARIO: Scenario = Object.freeze({
    id: "draw-gann-fan",
    title: "draw.gannFan(...) on a single bar",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
