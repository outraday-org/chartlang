// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

// Bundle scenario for Task 5 — one emission per line-family kind on
// the first bar of the goldenBars fixture. Verifies all 6 kinds
// coexist on the wire and share the `lines` bucket without budget
// overflow.
const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "drawLinesAndRays bundle",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            draw.line(
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_030_000_000, price: 110 },
                { color: "#3b82f6" },
            );
            draw.horizontalLine(105, { color: "#ef4444" });
            draw.horizontalRay(
                { time: 1_700_000_000_000, price: 95 },
                { color: "#10b981" },
            );
            draw.verticalLine(1_700_030_000_000, { color: "#f97316" });
            draw.crossLine(
                { time: 1_700_060_000_000, price: 100 },
                { color: "#a855f7" },
            );
            draw.trendAngle(
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_030_000_000, price: 120 },
                { color: "#22c55e" },
            );
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "62792b9ed1eb85c7769ac50aa00c25bdf3e311383d199a3877f69337acfb1106",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * Task-5 category-bundle conformance scenario. Emits one drawing per
 * line-family kind on the first bar and pins one `drawing-hash` across
 * all 6 emissions.
 *
 * @since 0.3
 * @stable
 * @example
 *     import { DRAW_LINES_AND_RAYS_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_LINES_AND_RAYS_SCENARIO;
 */
export const DRAW_LINES_AND_RAYS_SCENARIO: Scenario = Object.freeze({
    id: "draw-lines-and-rays",
    title: "Task 5 line-family bundle (6 kinds on a single bar)",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
