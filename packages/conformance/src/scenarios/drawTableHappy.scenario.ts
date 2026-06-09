// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "draw.table happy",
    apiVersion: 1,
    overlay: true,
    compute({ bar, draw }) {
        draw.table({
            position: "top-right",
            cells: [
                [
                    { text: "Metric", bgColor: "#0f172a", textColor: "#f8fafc", textSize: "small" },
                    { text: "Value", bgColor: "#0f172a", textColor: "#f8fafc", textHalign: "right", textSize: "small" },
                ],
                [
                    { text: "Close", textColor: "#334155" },
                    { text: String(bar.close), textColor: "#2563eb", textHalign: "right" },
                ],
                [
                    { text: "P&L", textColor: "#334155" },
                    { text: "+12.5%", textColor: "#16a34a", textHalign: "right", textSize: "large" },
                ],
            ],
            borderColor: "#94a3b8",
            borderWidth: 1,
            frame: { color: "#475569", width: 2 },
        });
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "156838567049ab401349d8aa27456706ee21e421b61e7d9b917db59e96883d00",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * Phase 5 conformance scenario for draw table happy scenario.
 *
 * @since 0.5
 * @experimental
 * @example
 *     import { DRAW_TABLE_HAPPY_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_TABLE_HAPPY_SCENARIO;
 */
export const DRAW_TABLE_HAPPY_SCENARIO: Scenario = Object.freeze({
    id: "draw-table-happy",
    title: "draw.table happy",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    candleLimit: 3,
    assertions: ASSERTIONS,
});
