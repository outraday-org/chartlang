// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "draw.timeCycles demo",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            draw.timeCycles(
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_000_060_000, price: 100 },
                { color: "#0ea5e9" },
            );
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "1bdaca36ce76bcdede3835d86143884c13d1f7477e2205548be11ff08c3d88c0",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * `draw.timeCycles` conformance scenario. Emits one time-cycles
 * drawing (2 anchors defining the arc diameter) on the first bar.
 *
 * @since 0.3
 * @stable
 * @example
 *     import { DRAW_TIME_CYCLES_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_TIME_CYCLES_SCENARIO;
 */
export const DRAW_TIME_CYCLES_SCENARIO: Scenario = Object.freeze({
    id: "draw-time-cycles",
    title: "draw.timeCycles(...) on a single bar",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
