// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "draw.arrowMarker demo",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            draw.arrowMarker(
                { time: 1_700_000_000_000, price: 100 },
                { color: "#10b981", text: "Long" },
            );
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "ebf7be5f7f7019e57179358995f32b006e8e34e8720a843c65ae53e7a0b8a48e",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * `draw.arrowMarker` conformance scenario. Emits one arrow-marker
 * drawing on the first bar and pins the SHA-256 of the resulting
 * drawing batch.
 *
 * @since 0.3
 * @stable
 * @example
 *     import { DRAW_ARROW_MARKER_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_ARROW_MARKER_SCENARIO;
 */
export const DRAW_ARROW_MARKER_SCENARIO: Scenario = Object.freeze({
    id: "draw-arrow-marker",
    title: "draw.arrowMarker(...) on a single bar",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
