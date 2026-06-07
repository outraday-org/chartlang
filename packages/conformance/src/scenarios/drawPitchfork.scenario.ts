// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "draw.pitchfork demo",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            draw.pitchfork([
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_015_000_000, price: 120 },
                { time: 1_700_030_000_000, price: 90 },
            ]);
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "347784683f74d61bde7919f4402a180bd451c237623f70ae3837ae7c1983fba5",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * `draw.pitchfork` conformance scenario. Emits one pitchfork
 * (default `standard` variant) on the first bar. The bundle
 * scenario `DRAW_PITCHFORKS_ALL_SCENARIO` covers the other three
 * variants (`schiff` / `modifiedSchiff` / `inside`) plus `pitchfan`.
 *
 * @since 0.3
 * @experimental
 * @example
 *     import { DRAW_PITCHFORK_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_PITCHFORK_SCENARIO;
 */
export const DRAW_PITCHFORK_SCENARIO: Scenario = Object.freeze({
    id: "draw-pitchfork",
    title: "draw.pitchfork(standard) on a single bar",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
