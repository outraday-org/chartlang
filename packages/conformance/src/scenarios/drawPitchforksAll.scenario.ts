// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

// Bundle scenario for Task 14 — emits one pitchfork per variant
// (standard / schiff / modifiedSchiff / inside) + one pitchfan on
// the first bar = 5 emissions total. All map to the `polylines`
// bucket.
const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "drawPitchforksAll bundle",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            const anchors = [
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_015_000_000, price: 120 },
                { time: 1_700_030_000_000, price: 90 },
            ];
            draw.pitchfork(anchors, { variant: "standard" });
            draw.pitchfork(anchors, { variant: "schiff" });
            draw.pitchfork(anchors, { variant: "modifiedSchiff" });
            draw.pitchfork(anchors, { variant: "inside" });
            draw.pitchfan(anchors);
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "994ac1756959da4d0474b43e20ea9c2836843445c3bec75f850a2db8f2ab1c2b",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * Task-14 category-bundle conformance scenario. Emits 4 pitchforks
 * (one per variant) + 1 pitchfan on the first bar (5 emissions
 * total) and pins one `drawing-hash` across all 5.
 *
 * @since 0.3
 * @experimental
 * @example
 *     import { DRAW_PITCHFORKS_ALL_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_PITCHFORKS_ALL_SCENARIO;
 */
export const DRAW_PITCHFORKS_ALL_SCENARIO: Scenario = Object.freeze({
    id: "draw-pitchforks-all",
    title: "Task 14 pitchforks-all bundle (4 pitchfork variants + 1 pitchfan)",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
