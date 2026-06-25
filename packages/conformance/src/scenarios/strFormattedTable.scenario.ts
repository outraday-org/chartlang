// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

// The `str` namespace is pure compute: `str.format` / `str.tostring` build the
// plain `string`s that flow straight into the already-shipped `draw.table`
// hole. The scenario renders a small OHLC HUD whose cell text is composed with
// `str.format`, `str.tostring("#.##")`, and `str.upper`, then pins the emitted
// `DrawingState` (which carries the cell text payload). Because the namespace
// emits NO new wire primitive, registering the scenario proves the formatted
// text is byte-stable across EVERY adapter the runner replays (canvas2d /
// echarts / konva / lightweight-charts / uplot / webgl) — the all-adapter proof
// the namespace owes, by verification not re-implementation (no adapter code).
const INLINE_SOURCE = `import { defineIndicator, str } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "str formatted table",
    apiVersion: 1,
    overlay: true,
    compute({ bar, draw }) {
        draw.table({
            position: "top-right",
            cells: [
                [
                    {
                        text: str.format("{0} · {1}", str.upper(bar.symbol), bar.interval),
                        bgColor: "#0f172a",
                        textColor: "#f8fafc",
                    },
                    {
                        text: str.tostring(bar.close, "#.##"),
                        bgColor: "#0f172a",
                        textColor: "#f8fafc",
                        textHalign: "right",
                    },
                ],
                [
                    { text: str.format("H {0}", str.tostring(bar.high, "#.##")), textColor: "#22c55e" },
                    { text: str.format("L {0}", str.tostring(bar.low, "#.##")), textColor: "#ef4444", textHalign: "right" },
                ],
            ],
            borderColor: "#94a3b8",
            borderWidth: 1,
        });
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "d6d8c9110f08186c6576802d68efcdd1f486848a6b13d9bd6966f169f5f9820e",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `str.*` formatted-table conformance scenario. Builds a `draw.table` HUD whose
 * cell text comes from `str.format` / `str.tostring("#.##")` / `str.upper`, then
 * pins the emitted drawing payload so the pure-compute string namespace stays
 * byte-stable across every adapter the runner replays.
 *
 * @since 1.4
 * @stable
 * @example
 *     import { STR_FORMATTED_TABLE_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void STR_FORMATTED_TABLE_SCENARIO;
 */
export const STR_FORMATTED_TABLE_SCENARIO: Scenario = Object.freeze({
    id: "str-formatted-table",
    title: "str.format / str.tostring HUD → draw.table",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    candleLimit: 3,
    assertions: ASSERTIONS,
});
