// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "draw.ellipse demo",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            draw.ellipse(
                { time: 1_700_000_000_000, price: 90 },
                { time: 1_700_060_000_000, price: 110 },
                { stroke: "#22c55e", fill: "#dcfce7", fillAlpha: 0.3 },
            );
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "ca7ce8e3d5d66d8f75d45c24f9814d92ec96e7797761b2f70cca6237f86a7686",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * `draw.ellipse` conformance scenario. Emits one ellipse drawing on
 * the first bar and pins the SHA-256 of the resulting drawing batch.
 *
 * @since 0.3
 * @stable
 * @example
 *     import { DRAW_ELLIPSE_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_ELLIPSE_SCENARIO;
 */
export const DRAW_ELLIPSE_SCENARIO: Scenario = Object.freeze({
    id: "draw-ellipse",
    title: "draw.ellipse(...) on a single bar",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
