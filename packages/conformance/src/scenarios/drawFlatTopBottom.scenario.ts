// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "draw.flatTopBottom demo",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            draw.flatTopBottom(
                [
                    { time: 1_700_000_000_000, price: 115 },
                    { time: 1_700_030_000_000, price: 115 },
                    { time: 1_700_000_000_000, price: 95 },
                ],
                { color: "#3b82f6", lineStyle: "dashed" },
            );
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "884612b9cfafed09949de015e013efd32e5c267bc364f19efbf20c00cd088df1",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * `draw.flatTopBottom` conformance scenario. Emits one flat-top-bottom
 * channel drawing on the first bar (3-anchor horizontal-rail pair) and
 * pins the SHA-256 of the resulting drawing batch.
 *
 * @since 0.3
 * @stable
 * @example
 *     import { DRAW_FLAT_TOP_BOTTOM_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_FLAT_TOP_BOTTOM_SCENARIO;
 */
export const DRAW_FLAT_TOP_BOTTOM_SCENARIO: Scenario = Object.freeze({
    id: "draw-flat-top-bottom",
    title: "draw.flatTopBottom(...) on a single bar",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
