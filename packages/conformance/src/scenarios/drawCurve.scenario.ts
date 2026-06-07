// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

// One `draw.curve(...)` call on the first bar against the bundled
// 10 000-bar `goldenBars.json` fixture. The 3 anchors are
// `[from, control, to]` — the middle anchor IS the off-curve Bezier
// control point (curve does NOT pass through it).
const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "draw.curve demo",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            draw.curve(
                [
                    { time: 1_700_000_000_000, price: 100 },
                    { time: 1_700_030_000_000, price: 130 },
                    { time: 1_700_060_000_000, price: 100 },
                ],
                { color: "#22c55e", lineWidth: 1 },
            );
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "32d38107ccf645b4f803156fac341ce45036858a2051c0673fa4fe277bb28e36",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * `draw.curve` conformance scenario. Emits one quadratic-Bezier curve
 * drawing on the first bar and pins the SHA-256 of the resulting
 * drawing batch.
 *
 * @since 0.3
 * @experimental
 * @example
 *     import { DRAW_CURVE_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_CURVE_SCENARIO;
 */
export const DRAW_CURVE_SCENARIO: Scenario = Object.freeze({
    id: "draw-curve",
    title: "draw.curve(...) on a single bar",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
