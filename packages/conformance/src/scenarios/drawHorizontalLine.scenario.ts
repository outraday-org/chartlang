// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "draw.horizontalLine demo",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            draw.horizontalLine(100, { color: "#ef4444", lineStyle: "dashed" });
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "51fcbd3d8dc83bd12eb0874b914271b0ca95e36dbafe9230ad5304bd44d3aa8f",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * `draw.horizontalLine` conformance scenario. Emits one
 * horizontal-line drawing on the first bar.
 *
 * @since 0.3
 * @stable
 * @example
 *     import { DRAW_HORIZONTAL_LINE_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_HORIZONTAL_LINE_SCENARIO;
 */
export const DRAW_HORIZONTAL_LINE_SCENARIO: Scenario = Object.freeze({
    id: "draw-horizontal-line",
    title: "draw.horizontalLine(...) on a single bar",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
