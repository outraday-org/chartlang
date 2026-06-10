// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

// Bundle scenario for Tasks 6 + 7 — one emission per box-family kind
// on the first bar. Supersedes Task 6's `drawBoxesA.scenario.ts` per
// README §22.10 (Task 7 widens the bundle to cover all 8 box kinds:
// rectangle / rotated-rectangle / triangle / polyline from Task 6 +
// circle / ellipse / path / marker from Task 7). Verifies the 8
// kinds coexist on the wire across the `boxes` / `polylines` /
// `labels` buckets without budget overflow.
const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "drawBoxesAll bundle",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            draw.rectangle(
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_030_000_000, price: 110 },
                { stroke: "#3b82f6" },
            );
            draw.rotatedRectangle(
                [
                    { time: 1_700_000_000_000, price: 100 },
                    { time: 1_700_030_000_000, price: 110 },
                    { time: 1_700_060_000_000, price: 100 },
                    { time: 1_700_030_000_000, price: 90 },
                ],
                { stroke: "#22c55e" },
            );
            draw.triangle(
                [
                    { time: 1_700_000_000_000, price: 100 },
                    { time: 1_700_030_000_000, price: 120 },
                    { time: 1_700_060_000_000, price: 100 },
                ],
                { stroke: "#ef4444" },
            );
            draw.polyline(
                [
                    { time: 1_700_000_000_000, price: 100 },
                    { time: 1_700_030_000_000, price: 110 },
                    { time: 1_700_060_000_000, price: 105 },
                ],
                { color: "#a855f7" },
            );
            draw.circle(
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_030_000_000, price: 105 },
                { stroke: "#0ea5e9" },
            );
            draw.ellipse(
                { time: 1_700_000_000_000, price: 90 },
                { time: 1_700_060_000_000, price: 110 },
                { stroke: "#14b8a6" },
            );
            draw.path(
                [
                    { time: 1_700_000_000_000, price: 100 },
                    { time: 1_700_030_000_000, price: 105 },
                    { time: 1_700_060_000_000, price: 110 },
                ],
                { color: "#f97316" },
            );
            draw.marker(
                { time: 1_700_000_000_000, price: 100 },
                { text: "B", size: "large", color: "#10b981" },
            );
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "a35f502843488fd0efecac843d1a168d5def242ca89cef144dd48915aab82ce5",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * Task-7 category-bundle conformance scenario. Supersedes the Task-6
 * `DRAW_BOXES_A_SCENARIO`. Emits one drawing per box kind across all
 * 8 Phase-3 box-family kinds (rectangle / rotated-rectangle /
 * triangle / polyline from Task 6 + circle / ellipse / path / marker
 * from Task 7) on the first bar and pins one `drawing-hash` across
 * all 8 emissions.
 *
 * @since 0.3
 * @stable
 * @example
 *     import { DRAW_BOXES_ALL_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_BOXES_ALL_SCENARIO;
 */
export const DRAW_BOXES_ALL_SCENARIO: Scenario = Object.freeze({
    id: "draw-boxes-all",
    title: "Task 6 + 7 box bundle (all 8 box kinds on a single bar)",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
