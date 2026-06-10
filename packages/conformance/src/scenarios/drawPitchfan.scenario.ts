// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "draw.pitchfan demo",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            draw.pitchfan([
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_015_000_000, price: 120 },
                { time: 1_700_030_000_000, price: 90 },
            ]);
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "0d7f55408dd430bd810ce64bea31d6bf246b558ae60799400d5b59c15ccd7234",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * `draw.pitchfan` conformance scenario. Emits one pitchfan on the
 * first bar.
 *
 * @since 0.3
 * @stable
 * @example
 *     import { DRAW_PITCHFAN_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_PITCHFAN_SCENARIO;
 */
export const DRAW_PITCHFAN_SCENARIO: Scenario = Object.freeze({
    id: "draw-pitchfan",
    title: "draw.pitchfan(...) on a single bar",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
