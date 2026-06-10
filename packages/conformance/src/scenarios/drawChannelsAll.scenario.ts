// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

// Bundle scenario for Task 10 — one emission per channel kind on the
// first bar. Per README §22.10 Task 10 collapses the 4 channel kinds
// (trend-channel / flat-top-bottom / disjoint-channel /
// regression-trend) into ONE bundle. All 4 map to the `polylines`
// bucket.
const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "drawChannelsAll bundle",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            draw.trendChannel(
                [
                    { time: 1_700_000_000_000, price: 100 },
                    { time: 1_700_030_000_000, price: 120 },
                    { time: 1_700_000_000_000, price: 90 },
                ],
                { color: "#3b82f6", lineWidth: 2 },
            );
            draw.flatTopBottom(
                [
                    { time: 1_700_000_000_000, price: 115 },
                    { time: 1_700_030_000_000, price: 115 },
                    { time: 1_700_000_000_000, price: 95 },
                ],
                { color: "#3b82f6", lineStyle: "dashed" },
            );
            draw.disjointChannel(
                [
                    { time: 1_700_000_000_000, price: 80 },
                    { time: 1_700_030_000_000, price: 95 },
                    { time: 1_700_000_000_000, price: 70 },
                    { time: 1_700_030_000_000, price: 88 },
                ],
                { color: "#3b82f6", lineWidth: 2 },
            );
            draw.regressionTrend(
                { time: 1_700_006_000_000, price: 100 },
                { time: 1_700_012_000_000, price: 110 },
                {
                    source: "close",
                    stdevMultiplier: 2,
                    showUpperBand: true,
                    showLowerBand: true,
                    color: "#3b82f6",
                },
            );
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "dc6754d4cb2f1197354140c048d69a1b34516b249570149574fbdac8aad21592",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * Task-10 category-bundle conformance scenario. Emits one drawing per
 * channel kind on the first bar — `trend-channel` / `flat-top-bottom`
 * / `disjoint-channel` / `regression-trend` — and pins one
 * `drawing-hash` across all 4 emissions. Per README §22.10 Task 10
 * collapses the category into this single bundle.
 *
 * @since 0.3
 * @stable
 * @example
 *     import { DRAW_CHANNELS_ALL_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_CHANNELS_ALL_SCENARIO;
 */
export const DRAW_CHANNELS_ALL_SCENARIO: Scenario = Object.freeze({
    id: "draw-channels-all",
    title: "Task 10 channels bundle (all 4 kinds on a single bar)",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
