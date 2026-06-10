// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

// One `draw.highlighter(...)` call on the first bar against the
// bundled 10 000-bar `goldenBars.json` fixture. Both `color` and
// `alpha` are required by `HighlighterStyle`.
const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "draw.highlighter demo",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            draw.highlighter(
                [
                    { time: 1_700_000_000_000, price: 100 },
                    { time: 1_700_030_000_000, price: 110 },
                    { time: 1_700_060_000_000, price: 105 },
                    { time: 1_700_090_000_000, price: 115 },
                ],
                { color: "#facc15", alpha: 0.3 },
            );
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "8d4843bf6ad9f0125d908482373093e676a16a76a10baf16b8d2424857e49f1e",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * `draw.highlighter` conformance scenario. Emits one translucent
 * highlighter stroke on the first bar and pins the SHA-256 of the
 * resulting drawing batch.
 *
 * @since 0.3
 * @stable
 * @example
 *     import { DRAW_HIGHLIGHTER_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_HIGHLIGHTER_SCENARIO;
 */
export const DRAW_HIGHLIGHTER_SCENARIO: Scenario = Object.freeze({
    id: "draw-highlighter",
    title: "draw.highlighter(...) on a single bar",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
