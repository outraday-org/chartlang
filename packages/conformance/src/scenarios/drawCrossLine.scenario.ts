// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "draw.crossLine demo",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            draw.crossLine(
                { time: 1_700_030_000_000, price: 100 },
                { color: "#a855f7" },
            );
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "353d7613a8eb9e7c1e10a896ad0cafcf921c2e1fc64f291223135e0214c57683",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * `draw.crossLine` conformance scenario. Emits one cross-line drawing
 * on the first bar.
 *
 * @since 0.3
 * @stable
 * @example
 *     import { DRAW_CROSS_LINE_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_CROSS_LINE_SCENARIO;
 */
export const DRAW_CROSS_LINE_SCENARIO: Scenario = Object.freeze({
    id: "draw-cross-line",
    title: "draw.crossLine(...) on a single bar",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
