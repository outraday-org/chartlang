// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "draw.cyclicLines demo",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            draw.cyclicLines(
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_000_060_000, price: 100 },
                { color: "#0ea5e9" },
            );
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "975166fec07c2534eb9e4387cd1335e78e45a6f8391cbca3981da9e2fffaae16",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * `draw.cyclicLines` conformance scenario. Emits one cyclic-lines
 * drawing (2 anchors, period = 60s) on the first bar.
 *
 * @since 0.3
 * @stable
 * @example
 *     import { DRAW_CYCLIC_LINES_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_CYCLIC_LINES_SCENARIO;
 */
export const DRAW_CYCLIC_LINES_SCENARIO: Scenario = Object.freeze({
    id: "draw-cyclic-lines",
    title: "draw.cyclicLines(...) on a single bar",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
