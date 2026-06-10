// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "draw.rotatedRectangle demo",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            draw.rotatedRectangle(
                [
                    { time: 1_700_000_000_000, price: 100 },
                    { time: 1_700_030_000_000, price: 110 },
                    { time: 1_700_060_000_000, price: 100 },
                    { time: 1_700_030_000_000, price: 90 },
                ],
                { stroke: "#22c55e", fill: "#dcfce7", fillAlpha: 0.3 },
            );
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "4a25487846cb81628c96d6b58f11748bea0ff004ccd17135cd876a854cbc5a97",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * `draw.rotatedRectangle` conformance scenario. Emits one rotated
 * rectangle drawing on the first bar with all four corners pinned.
 *
 * @since 0.3
 * @stable
 * @example
 *     import { DRAW_ROTATED_RECTANGLE_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_ROTATED_RECTANGLE_SCENARIO;
 */
export const DRAW_ROTATED_RECTANGLE_SCENARIO: Scenario = Object.freeze({
    id: "draw-rotated-rectangle",
    title: "draw.rotatedRectangle(...) on a single bar",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
