// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "draw.abcdPattern demo",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            draw.abcdPattern([
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_000_020_000, price: 120 },
                { time: 1_700_000_040_000, price: 105 },
                { time: 1_700_000_060_000, price: 130 },
            ]);
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "a780333d6e45813faf13ebfe9564069bbd21afab35a5403127890e2c34fecd54",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * `draw.abcdPattern` conformance scenario. Emits one ABCD measured-
 * move pattern on the first bar.
 *
 * @since 0.3
 * @stable
 * @example
 *     import { DRAW_ABCD_PATTERN_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_ABCD_PATTERN_SCENARIO;
 */
export const DRAW_ABCD_PATTERN_SCENARIO: Scenario = Object.freeze({
    id: "draw-abcd-pattern",
    title: "draw.abcdPattern(...) on a single bar",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
