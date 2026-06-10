// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "draw.arrowMarkUp demo",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            draw.arrowMarkUp({ time: 1_700_000_000_000, price: 100 });
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "40603ef3e62b420ab814183080bc55ce90064ff5f07227c2574d01f48a9e85dc",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * `draw.arrowMarkUp` conformance scenario. Emits one arrow-mark-up
 * drawing on the first bar (default green chevron) and pins the
 * SHA-256 of the resulting drawing batch.
 *
 * @since 0.3
 * @stable
 * @example
 *     import { DRAW_ARROW_MARK_UP_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_ARROW_MARK_UP_SCENARIO;
 */
export const DRAW_ARROW_MARK_UP_SCENARIO: Scenario = Object.freeze({
    id: "draw-arrow-mark-up",
    title: "draw.arrowMarkUp(...) on a single bar",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
