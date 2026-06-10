// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

// One `draw.brush(...)` call on the first bar against the bundled
// 10 000-bar `goldenBars.json` fixture. Both `stroke` and `fill` are
// required by `BrushStyle`; the renderer paints fill before stroke.
const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "draw.brush demo",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            draw.brush(
                [
                    { time: 1_700_000_000_000, price: 100 },
                    { time: 1_700_030_000_000, price: 120 },
                    { time: 1_700_060_000_000, price: 100 },
                    { time: 1_700_090_000_000, price: 80 },
                ],
                { stroke: "#000000", fill: "#dbeafe" },
            );
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "3de92c946801dd916821fea3bc04bef99f536a885ba9d0fbe4de4820d1d526e5",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * `draw.brush` conformance scenario. Emits one stroked + filled brush
 * stroke on the first bar and pins the SHA-256 of the resulting
 * drawing batch.
 *
 * @since 0.3
 * @stable
 * @example
 *     import { DRAW_BRUSH_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_BRUSH_SCENARIO;
 */
export const DRAW_BRUSH_SCENARIO: Scenario = Object.freeze({
    id: "draw-brush",
    title: "draw.brush(...) on a single bar",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
