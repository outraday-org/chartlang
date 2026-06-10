// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "draw.fibTrendExtension demo",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            draw.fibTrendExtension(
                [
                    { time: 1_700_000_000_000, price: 100 },
                    { time: 1_700_030_000_000, price: 130 },
                    { time: 1_700_060_000_000, price: 115 },
                ],
                { showLabels: true },
            );
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "f6a1c867fbcf168e00688929d867e17a3e05d03d805be36ac7c4e9a8ba33a7ab",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * `draw.fibTrendExtension` conformance scenario. Emits one
 * fib-trend-extension on the first bar with anchors at `goldenBars[0]`,
 * `goldenBars[500]`, and `goldenBars[1000]`.
 *
 * @since 0.3
 * @stable
 * @example
 *     import { DRAW_FIB_TREND_EXTENSION_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_FIB_TREND_EXTENSION_SCENARIO;
 */
export const DRAW_FIB_TREND_EXTENSION_SCENARIO: Scenario = Object.freeze({
    id: "draw-fib-trend-extension",
    title: "draw.fibTrendExtension(...) on a single bar",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
