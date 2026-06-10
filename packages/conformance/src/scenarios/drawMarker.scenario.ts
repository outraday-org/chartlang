// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "draw.marker demo",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
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
        sha256: "f6413c533a9c662ccbce998d4a61569d872ae57cca0f00318347ab0b9bbacb53",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * `draw.marker` conformance scenario. Emits one marker drawing on
 * the first bar and pins the SHA-256 of the resulting drawing batch.
 *
 * @since 0.3
 * @stable
 * @example
 *     import { DRAW_MARKER_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_MARKER_SCENARIO;
 */
export const DRAW_MARKER_SCENARIO: Scenario = Object.freeze({
    id: "draw-marker",
    title: "draw.marker(...) on a single bar",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
