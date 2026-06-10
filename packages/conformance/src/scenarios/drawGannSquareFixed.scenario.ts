// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "draw.gannSquareFixed demo",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            draw.gannSquareFixed({ time: 1_700_000_000_000, price: 100 });
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "187d8e24b4e27996bbd6f9b7997a6ffb9aad7c3300ed18681ad184c6af5de0fb",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * `draw.gannSquareFixed` conformance scenario. Emits one
 * gann-square-fixed on the first bar with `goldenBars[0]` as the
 * anchor.
 *
 * @since 0.3
 * @stable
 * @example
 *     import { DRAW_GANN_SQUARE_FIXED_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_GANN_SQUARE_FIXED_SCENARIO;
 */
export const DRAW_GANN_SQUARE_FIXED_SCENARIO: Scenario = Object.freeze({
    id: "draw-gann-square-fixed",
    title: "draw.gannSquareFixed(...) on a single bar",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
