// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "draw.horizontalRay demo",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            draw.horizontalRay(
                { time: 1_700_000_000_000, price: 105 },
                { color: "#10b981" },
            );
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "80118c5bb952d7091aa0fd4e78dbd7b44f34d51814f4b5fa3e9ecba92aa53ec5",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * `draw.horizontalRay` conformance scenario. Emits one horizontal-ray
 * drawing on the first bar.
 *
 * @since 0.3
 * @stable
 * @example
 *     import { DRAW_HORIZONTAL_RAY_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_HORIZONTAL_RAY_SCENARIO;
 */
export const DRAW_HORIZONTAL_RAY_SCENARIO: Scenario = Object.freeze({
    id: "draw-horizontal-ray",
    title: "draw.horizontalRay(...) on a single bar",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
