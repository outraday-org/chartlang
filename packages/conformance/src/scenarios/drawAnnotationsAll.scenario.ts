// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

// Bundle scenario for Task 9 — one emission per annotation kind on
// the first bar. Per README §22.10 Task 9 collapses the 5 annotation
// kinds (text / arrow / arrow-marker / arrow-mark-up /
// arrow-mark-down) into ONE bundle. All 5 map to the `labels` bucket.
const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "drawAnnotationsAll bundle",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            draw.text(
                { time: 1_700_000_000_000, price: 100 },
                "Inverse Head and Shoulders Confirmed",
                { color: "#1e293b", size: "normal" },
            );
            draw.arrow(
                { time: 1_700_000_000_000, price: 105 },
                { time: 1_700_030_000_000, price: 115 },
                { color: "#dc2626", lineWidth: 2, label: "Sell" },
            );
            draw.arrowMarker(
                { time: 1_700_030_000_000, price: 100 },
                { color: "#10b981", text: "Long" },
            );
            draw.arrowMarkUp({ time: 1_700_060_000_000, price: 95 });
            draw.arrowMarkDown({ time: 1_700_060_000_000, price: 120 });
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "0fab3d86a9c83695c3753b5810ca0d3b569c1149b52d8e10894bfcbc59e3ad03",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * Task-9 category-bundle conformance scenario. Emits one drawing per
 * annotation kind on the first bar — `text` / `arrow` / `arrow-marker`
 * / `arrow-mark-up` / `arrow-mark-down` — and pins one `drawing-hash`
 * across all 5 emissions. Per README §22.10 Task 9 collapses the
 * category into this single bundle.
 *
 * @since 0.3
 * @stable
 * @example
 *     import { DRAW_ANNOTATIONS_ALL_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_ANNOTATIONS_ALL_SCENARIO;
 */
export const DRAW_ANNOTATIONS_ALL_SCENARIO: Scenario = Object.freeze({
    id: "draw-annotations-all",
    title: "Task 9 annotations bundle (all 5 kinds on a single bar)",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
