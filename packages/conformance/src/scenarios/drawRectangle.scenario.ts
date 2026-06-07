// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

// One `draw.rectangle(...)` call on the first bar against the bundled
// 10 000-bar `goldenBars.json` fixture. Pricing is hardcoded so the
// emitted state is deterministic across runs.
const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "draw.rectangle demo",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            draw.rectangle(
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_030_000_000, price: 110 },
                { stroke: "#3b82f6", fill: "#dbeafe", fillAlpha: 0.4 },
            );
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "da3396f6646e35764eef6dbc5ccedc51727cd7a9d188ce8dc2b66cface07f2f0",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * `draw.rectangle` conformance scenario. Emits one rectangle drawing
 * on the first bar and pins the SHA-256 of the resulting drawing batch.
 *
 * @since 0.3
 * @experimental
 * @example
 *     import { DRAW_RECTANGLE_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_RECTANGLE_SCENARIO;
 */
export const DRAW_RECTANGLE_SCENARIO: Scenario = Object.freeze({
    id: "draw-rectangle",
    title: "draw.rectangle(...) on a single bar",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
