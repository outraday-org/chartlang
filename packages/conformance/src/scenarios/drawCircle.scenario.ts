// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

// One `draw.circle(...)` call on the first bar against the bundled
// 10 000-bar `goldenBars.json` fixture. The two anchors define centre
// + radius; the renderer derives the pixel radius from
// `|edge - centre|` at paint time.
const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "draw.circle demo",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            draw.circle(
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_030_000_000, price: 105 },
                { stroke: "#3b82f6", fill: "#dbeafe", fillAlpha: 0.3 },
            );
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "633bf2595d16504fd6a5e984e92b51f0b0ba4fef3041b7626b1e7e988f84a1cd",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * `draw.circle` conformance scenario. Emits one circle drawing on the
 * first bar and pins the SHA-256 of the resulting drawing batch.
 *
 * @since 0.3
 * @experimental
 * @example
 *     import { DRAW_CIRCLE_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_CIRCLE_SCENARIO;
 */
export const DRAW_CIRCLE_SCENARIO: Scenario = Object.freeze({
    id: "draw-circle",
    title: "draw.circle(...) on a single bar",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
