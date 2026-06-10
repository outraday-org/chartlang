// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

// One `draw.line(...)` call on the first bar against the bundled
// 10 000-bar `goldenBars.json` fixture. The anchor times are
// `bars[0].time` (1_700_000_000_000) and `bars[500].time`
// (1_700_000_000_000 + 500 * 60_000). Pricing is hardcoded so the
// emitted state is deterministic across runs (the goldenBars fixture's
// `close` values are random-walk noise — pinning them in-line would
// drift if the fixture changed).
const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "draw.line demo",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            draw.line(
                { time: 1_700_000_000_000, price: 100 },
                { time: 1_700_030_000_000, price: 110 },
                { color: "#3b82f6", lineWidth: 2 },
            );
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "794eb0436d765dc5db556cabf99489c8686f7d2174185fd1c026513269c58080",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * `draw.line` conformance scenario. Emits one line drawing on the
 * first bar and pins the SHA-256 of the resulting drawing batch.
 *
 * @since 0.3
 * @stable
 * @example
 *     import { DRAW_LINE_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_LINE_SCENARIO;
 */
export const DRAW_LINE_SCENARIO: Scenario = Object.freeze({
    id: "draw-line",
    title: "draw.line(...) on a single bar",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
