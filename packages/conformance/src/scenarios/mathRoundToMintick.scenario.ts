// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

// `math.roundToMintick` is pure scalar compute: it snaps a price level to the
// symbol's tick size, and the snapped number flows straight into the existing
// `draw.horizontalLine` hole. The scenario computes two support/resistance
// levels off the first bar's close (a slightly-above and slightly-below band),
// snaps each to `syminfo.mintick`, and draws one horizontal line per level on
// bar 0. Because the namespace emits NO new wire primitive, registering the
// scenario proves byte-stable drawing output across EVERY adapter the runner
// replays (canvas2d / echarts / konva / lightweight-charts / uplot / webgl) —
// the all-adapter proof the namespace owes, by verification not re-implementation.
const INLINE_SOURCE = `import { defineIndicator, math } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "math.roundToMintick levels",
    apiVersion: 1,
    compute({ bar, draw, syminfo }) {
        if (bar.time === 1_700_000_000_000) {
            const base = bar.close;
            const resistance = math.roundToMintick(base * 1.013, syminfo.mintick);
            const support = math.roundToMintick(base * 0.987, syminfo.mintick);
            draw.horizontalLine(resistance, { color: "#ef4444", lineStyle: "dashed" });
            draw.horizontalLine(support, { color: "#22c55e", lineStyle: "dashed" });
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "38b4e1a21c67fe5787548435e21413b07d5b9121dee0ced0b0b4fbf50bf71010",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `math.roundToMintick` conformance scenario. Snaps two price levels to the
 * symbol's tick size and draws one `draw.horizontalLine` per level on the first
 * bar, pinning the drawing payload so the pure-scalar namespace stays
 * byte-stable across every adapter the runner replays.
 *
 * @since 1.4
 * @stable
 * @example
 *     import { MATH_ROUND_TO_MINTICK_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void MATH_ROUND_TO_MINTICK_SCENARIO;
 */
export const MATH_ROUND_TO_MINTICK_SCENARIO: Scenario = Object.freeze({
    id: "math-round-to-mintick",
    title: "math.roundToMintick snapped levels → draw.horizontalLine",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
