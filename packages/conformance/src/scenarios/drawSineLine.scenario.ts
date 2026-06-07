// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "draw.sineLine demo",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            draw.sineLine(
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_000_060_000, price: 120 },
                { color: "#0ea5e9" },
            );
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "9f88b6894058a1e48e2fff80f14c1d98fa6e480b28da73a3be1205927b6e3ba8",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * `draw.sineLine` conformance scenario. Emits one sine-line drawing
 * (2 anchors defining the half-period and amplitude) on the first bar.
 *
 * @since 0.3
 * @experimental
 * @example
 *     import { DRAW_SINE_LINE_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_SINE_LINE_SCENARIO;
 */
export const DRAW_SINE_LINE_SCENARIO: Scenario = Object.freeze({
    id: "draw-sine-line",
    title: "draw.sineLine(...) on a single bar",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
