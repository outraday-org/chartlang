// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "draw.verticalLine demo",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            draw.verticalLine(1_700_030_000_000, { color: "#f97316", lineStyle: "dotted" });
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "eccfee48cb2956dce3f38668b1560bd7eec96c3ec367de44ddcc7dfe8b7f49ab",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * `draw.verticalLine` conformance scenario. Emits one vertical-line
 * drawing on the first bar.
 *
 * @since 0.3
 * @stable
 * @example
 *     import { DRAW_VERTICAL_LINE_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_VERTICAL_LINE_SCENARIO;
 */
export const DRAW_VERTICAL_LINE_SCENARIO: Scenario = Object.freeze({
    id: "draw-vertical-line",
    title: "draw.verticalLine(...) on a single bar",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
