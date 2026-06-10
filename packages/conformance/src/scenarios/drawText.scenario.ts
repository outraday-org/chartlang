// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

// One `draw.text(...)` call on the first bar against the bundled
// 10 000-bar `goldenBars.json` fixture. The body is the spec's
// representative "Inverse Head and Shoulders Confirmed" string (well
// under the 256-char cap).
const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "draw.text demo",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            draw.text(
                { time: 1_700_000_000_000, price: 100 },
                "Inverse Head and Shoulders Confirmed",
                { color: "#1e293b", size: "normal" },
            );
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "46d3fab09cc408e1f3600609fc7376cf2b91f3da64a9b802147e8c148822e581",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * `draw.text` conformance scenario. Emits one text drawing on the
 * first bar and pins the SHA-256 of the resulting drawing batch.
 *
 * @since 0.3
 * @stable
 * @example
 *     import { DRAW_TEXT_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_TEXT_SCENARIO;
 */
export const DRAW_TEXT_SCENARIO: Scenario = Object.freeze({
    id: "draw-text",
    title: "draw.text(...) on a single bar",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
