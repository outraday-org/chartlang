// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

// One `draw.pen(...)` call on the first bar against the bundled
// 10 000-bar `goldenBars.json` fixture. A hand-curated 4-anchor
// stroke matches the spec's "hand-curated 4-point stroke at known
// canvas pixels for predictable hashing" guidance.
const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "draw.pen demo",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            draw.pen(
                [
                    { time: 1_700_000_000_000, price: 100 },
                    { time: 1_700_030_000_000, price: 110 },
                    { time: 1_700_060_000_000, price: 105 },
                    { time: 1_700_090_000_000, price: 115 },
                ],
                { color: "#1e293b", lineWidth: 2 },
            );
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "f4da8f516d35b1abc25decadb432784cce6c9fb61f365faf7a0517ad376c326f",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * `draw.pen` conformance scenario. Emits one freehand pen stroke on
 * the first bar and pins the SHA-256 of the resulting drawing batch.
 *
 * @since 0.3
 * @stable
 * @example
 *     import { DRAW_PEN_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_PEN_SCENARIO;
 */
export const DRAW_PEN_SCENARIO: Scenario = Object.freeze({
    id: "draw-pen",
    title: "draw.pen(...) on a single bar",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
