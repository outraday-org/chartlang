// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "draw.trendChannel demo",
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
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "e06c44869c2f16def093b6ab85cb0a00120fd8c1512c1f8e920f34d33efb0c4e",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * `draw.trendChannel` conformance scenario. Emits one trend-channel
 * drawing on the first bar (3-anchor parallel-line channel) and pins
 * the SHA-256 of the resulting drawing batch.
 *
 * @since 0.3
 * @stable
 * @example
 *     import { DRAW_TREND_CHANNEL_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_TREND_CHANNEL_SCENARIO;
 */
export const DRAW_TREND_CHANNEL_SCENARIO: Scenario = Object.freeze({
    id: "draw-trend-channel",
    title: "draw.trendChannel(...) on a single bar",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
