// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "draw.headAndShoulders demo",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            draw.headAndShoulders([
                { time: 1_700_000_000_000, price: 120 },
                { time: 1_700_000_015_000, price: 100 },
                { time: 1_700_000_030_000, price: 140 },
                { time: 1_700_000_045_000, price: 100 },
                { time: 1_700_000_060_000, price: 118 },
            ]);
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "14055eeb8afe273d4605f6edb80d645efb5bd8af4097f1636f76a116a77b49a5",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * `draw.headAndShoulders` conformance scenario. Emits one
 * head-and-shoulders pattern on the first bar.
 *
 * @since 0.3
 * @stable
 * @example
 *     import { DRAW_HEAD_AND_SHOULDERS_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_HEAD_AND_SHOULDERS_SCENARIO;
 */
export const DRAW_HEAD_AND_SHOULDERS_SCENARIO: Scenario = Object.freeze({
    id: "draw-head-and-shoulders",
    title: "draw.headAndShoulders(...) on a single bar",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
