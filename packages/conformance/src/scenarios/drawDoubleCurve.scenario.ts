// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

// One `draw.doubleCurve(...)` call on the first bar against the
// bundled 10 000-bar `goldenBars.json` fixture. The 5 anchors are
// `[P0, P1, mid, P3, P4]` — the renderer paints a single cubic Bezier
// from P0 to P4 with off-curve controls P1 and P3; `mid` is the
// stitch point preserved in state for future split-rendering.
const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "draw.doubleCurve demo",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            draw.doubleCurve(
                [
                    { time: 1_700_000_000_000, price: 100 },
                    { time: 1_700_015_000_000, price: 130 },
                    { time: 1_700_030_000_000, price: 100 },
                    { time: 1_700_045_000_000, price: 70 },
                    { time: 1_700_060_000_000, price: 100 },
                ],
                { color: "#a855f7", lineWidth: 2 },
            );
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "189121046f4555af048049a3faefc0c59187f97252c1080d109e9d411554772f",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * `draw.doubleCurve` conformance scenario. Emits one cubic-Bezier
 * double-curve drawing on the first bar and pins the SHA-256 of the
 * resulting drawing batch.
 *
 * @since 0.3
 * @experimental
 * @example
 *     import { DRAW_DOUBLE_CURVE_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_DOUBLE_CURVE_SCENARIO;
 */
export const DRAW_DOUBLE_CURVE_SCENARIO: Scenario = Object.freeze({
    id: "draw-double-curve",
    title: "draw.doubleCurve(...) on a single bar",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
