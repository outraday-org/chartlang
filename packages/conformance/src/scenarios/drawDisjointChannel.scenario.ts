// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "draw.disjointChannel demo",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            draw.disjointChannel(
                [
                    { time: 1_700_000_000_000, price: 100 },
                    { time: 1_700_030_000_000, price: 110 },
                    { time: 1_700_000_000_000, price: 90 },
                    { time: 1_700_030_000_000, price: 105 },
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
        sha256: "6718c188c25731d1594006922bc37c968fd997969510e3eed4f04b83addb0955",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * `draw.disjointChannel` conformance scenario. Emits one
 * disjoint-channel drawing on the first bar (4-anchor pair of
 * independent line segments) and pins the SHA-256 of the resulting
 * drawing batch.
 *
 * @since 0.3
 * @stable
 * @example
 *     import { DRAW_DISJOINT_CHANNEL_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_DISJOINT_CHANNEL_SCENARIO;
 */
export const DRAW_DISJOINT_CHANNEL_SCENARIO: Scenario = Object.freeze({
    id: "draw-disjoint-channel",
    title: "draw.disjointChannel(...) on a single bar",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
