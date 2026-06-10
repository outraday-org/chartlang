// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "draw.frame demo",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            draw.frame(
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_000_060_000, price: 120 },
                { label: "Trade idea", bgColor: "#f1f5f9" },
            );
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "4b54e0b6e75ad40904e0f70ac5b34067afa6c1237d43060823889f04b86d900b",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * `draw.frame` conformance scenario. Emits one labelled frame on the
 * first bar with a background fill colour.
 *
 * @since 0.3
 * @stable
 * @example
 *     import { DRAW_FRAME_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_FRAME_SCENARIO;
 */
export const DRAW_FRAME_SCENARIO: Scenario = Object.freeze({
    id: "draw-frame",
    title: "draw.frame(...) on a single bar",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
