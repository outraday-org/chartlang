// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

// Bundle scenario for Task 18 — emits one drawing per container kind
// on the first bar = 2 emissions total (frame + group). Both map to
// the `other` bucket.
const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "drawContainersAll bundle",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            const f = draw.frame(
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_000_060_000, price: 120 },
                { label: "Box", bgColor: "#f1f5f9" },
            );
            draw.group([f.id]);
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "e6ba183dfc04145a5126e6ea75a4cb7117694adc13eea84853239c68810e91fe",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * Task-18 category-bundle conformance scenario. Emits one drawing per
 * container kind on the first bar (2 emissions total) and pins one
 * `drawing-hash` across both.
 *
 * @since 0.3
 * @experimental
 * @example
 *     import { DRAW_CONTAINERS_ALL_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_CONTAINERS_ALL_SCENARIO;
 */
export const DRAW_CONTAINERS_ALL_SCENARIO: Scenario = Object.freeze({
    id: "draw-containers-all",
    title: "Task 18 containers-all bundle (2 container kinds)",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
