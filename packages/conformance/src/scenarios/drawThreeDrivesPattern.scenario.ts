// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "draw.threeDrivesPattern demo",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            draw.threeDrivesPattern([
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_000_010_000, price: 115 },
                { time: 1_700_000_020_000, price: 108 },
                { time: 1_700_000_030_000, price: 125 },
                { time: 1_700_000_040_000, price: 116 },
                { time: 1_700_000_050_000, price: 135 },
                { time: 1_700_000_060_000, price: 124 },
            ]);
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "0ca12be1f5a915b31e28ec3a9945f6c377c8ecb697d4ebbf2a9830592c5fa767",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * `draw.threeDrivesPattern` conformance scenario. Emits one
 * three-drives reversal pattern (7 anchors) on the first bar.
 *
 * @since 0.3
 * @stable
 * @example
 *     import { DRAW_THREE_DRIVES_PATTERN_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_THREE_DRIVES_PATTERN_SCENARIO;
 */
export const DRAW_THREE_DRIVES_PATTERN_SCENARIO: Scenario = Object.freeze({
    id: "draw-three-drives-pattern",
    title: "draw.threeDrivesPattern(...) on a single bar",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
