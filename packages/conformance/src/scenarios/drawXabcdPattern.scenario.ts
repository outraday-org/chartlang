// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "draw.xabcdPattern demo",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            draw.xabcdPattern([
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_000_015_000, price: 120 },
                { time: 1_700_000_030_000, price: 105 },
                { time: 1_700_000_045_000, price: 135 },
                { time: 1_700_000_060_000, price: 115 },
            ]);
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "1a5f91cc83517c84dd22ab22bb6a8246477387c2cba7e77dc900784c4ba0d865",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * `draw.xabcdPattern` conformance scenario. Emits one xabcd harmonic
 * pattern on the first bar.
 *
 * @since 0.3
 * @stable
 * @example
 *     import { DRAW_XABCD_PATTERN_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_XABCD_PATTERN_SCENARIO;
 */
export const DRAW_XABCD_PATTERN_SCENARIO: Scenario = Object.freeze({
    id: "draw-xabcd-pattern",
    title: "draw.xabcdPattern(...) on a single bar",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
