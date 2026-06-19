// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

// One `draw.fillBetween(...)` call on the first bar against the bundled
// 10 000-bar `goldenBars.json` fixture. The two edges are hardcoded so the
// emitted state is deterministic across runs (the goldenBars fixture's
// `close` values are random-walk noise — pinning them in-line would drift
// if the fixture changed).
const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "draw.fillBetween demo",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            draw.fillBetween(
                [
                    { time: 1_700_000_000_000, price: 110 },
                    { time: 1_700_030_000_000, price: 120 },
                ],
                [
                    { time: 1_700_000_000_000, price: 100 },
                    { time: 1_700_030_000_000, price: 105 },
                ],
                { fill: "#3b82f6", fillAlpha: 0.2 },
            );
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "45359849cf2bc5b5463a6512d458e35f577cc5d56ff77a1070d99abc942cd051",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * `draw.fillBetween` conformance scenario. Emits one fill-between drawing on
 * the first bar and pins the SHA-256 of the resulting drawing batch.
 *
 * @since 0.4
 * @stable
 * @example
 *     import { DRAW_FILL_BETWEEN_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_FILL_BETWEEN_SCENARIO;
 */
export const DRAW_FILL_BETWEEN_SCENARIO: Scenario = Object.freeze({
    id: "draw-fill-between",
    title: "draw.fillBetween(...) on a single bar",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
