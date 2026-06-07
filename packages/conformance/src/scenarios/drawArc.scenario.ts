// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

// One `draw.arc(...)` call on the first bar against the bundled
// 10 000-bar `goldenBars.json` fixture. The 3 anchors are
// `[from, apex, to]` — the renderer derives the Bezier control via
// inverse-quadratic interpolation so the curve passes through `apex`
// at t = 0.5 (distinct from `curve` whose middle anchor IS the
// control).
const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "draw.arc demo",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            draw.arc(
                [
                    { time: 1_700_000_000_000, price: 100 },
                    { time: 1_700_030_000_000, price: 120 },
                    { time: 1_700_060_000_000, price: 100 },
                ],
                { color: "#3b82f6", lineWidth: 2 },
            );
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "8af79bcf210dfe7491e37964010d5d7ef87cf329e0321894ed72135b9f27d627",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * `draw.arc` conformance scenario. Emits one arc drawing on the first
 * bar and pins the SHA-256 of the resulting drawing batch.
 *
 * @since 0.3
 * @experimental
 * @example
 *     import { DRAW_ARC_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_ARC_SCENARIO;
 */
export const DRAW_ARC_SCENARIO: Scenario = Object.freeze({
    id: "draw-arc",
    title: "draw.arc(...) on a single bar",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
