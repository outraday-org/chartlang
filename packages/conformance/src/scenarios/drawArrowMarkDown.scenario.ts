// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "draw.arrowMarkDown demo",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            draw.arrowMarkDown({ time: 1_700_000_000_000, price: 100 });
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "38ae53ebcd3ec306197006a911363e18e7d726ef22b0fd337086b5322bcec9cf",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * `draw.arrowMarkDown` conformance scenario. Emits one
 * arrow-mark-down drawing on the first bar (default red chevron) and
 * pins the SHA-256 of the resulting drawing batch.
 *
 * @since 0.3
 * @stable
 * @example
 *     import { DRAW_ARROW_MARK_DOWN_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_ARROW_MARK_DOWN_SCENARIO;
 */
export const DRAW_ARROW_MARK_DOWN_SCENARIO: Scenario = Object.freeze({
    id: "draw-arrow-mark-down",
    title: "draw.arrowMarkDown(...) on a single bar",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
