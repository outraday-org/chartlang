// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "draw.group demo",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            const a = draw.line(
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_000_060_000, price: 110 },
            );
            const b = draw.line(
                { time: 1_700_000_000_000, price: 110 },
                { time: 1_700_000_060_000, price: 100 },
            );
            draw.group([a.id, b.id]);
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "6e32e387543ef421d1e53c1c15612cc32a814c85c2d969ad86d9f47b8d0359a2",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * `draw.group` conformance scenario. Emits 2 line drawings, then
 * groups them by handle id on the first bar (3 emissions total —
 * 2 lines + 1 group). The group is metadata-only at the wire level
 * and the canvas2d renderer is a pure no-op (Phase-3 contract).
 *
 * @since 0.3
 * @experimental
 * @example
 *     import { DRAW_GROUP_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_GROUP_SCENARIO;
 */
export const DRAW_GROUP_SCENARIO: Scenario = Object.freeze({
    id: "draw-group",
    title: "draw.group(...) on a single bar",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
