// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "draw.cypherPattern demo",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            draw.cypherPattern([
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_000_015_000, price: 130 },
                { time: 1_700_000_030_000, price: 110 },
                { time: 1_700_000_045_000, price: 145 },
                { time: 1_700_000_060_000, price: 118 },
            ]);
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "9fb05048d5d9151a9fc99156799a2181c05f64d66196615363d90298620a4583",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * `draw.cypherPattern` conformance scenario. Emits one cypher
 * harmonic pattern on the first bar. The cypher-pattern kind has no
 * standalone invinite tool — it lives only as a `defineDrawing`
 * surface and the y-doc-bridge type.
 *
 * @since 0.3
 * @experimental
 * @example
 *     import { DRAW_CYPHER_PATTERN_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_CYPHER_PATTERN_SCENARIO;
 */
export const DRAW_CYPHER_PATTERN_SCENARIO: Scenario = Object.freeze({
    id: "draw-cypher-pattern",
    title: "draw.cypherPattern(...) on a single bar",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
