// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "draw.polyline demo",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            draw.polyline(
                [
                    { time: 1_700_000_000_000, price: 100 },
                    { time: 1_700_030_000_000, price: 110 },
                    { time: 1_700_060_000_000, price: 105 },
                ],
                { color: "#a855f7", lineWidth: 2 },
            );
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "702b06cdf241516b01ec509a3adce23ad076ff0ba8a300bb2f04a2fbe740f989",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * `draw.polyline` conformance scenario. Emits one auto-closed
 * 3-anchor polyline drawing on the first bar. Validator pins
 * `3 ≤ anchors.length ≤ 20`.
 *
 * @since 0.3
 * @stable
 * @example
 *     import { DRAW_POLYLINE_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_POLYLINE_SCENARIO;
 */
export const DRAW_POLYLINE_SCENARIO: Scenario = Object.freeze({
    id: "draw-polyline",
    title: "draw.polyline(...) on a single bar",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
