// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "draw.fibChannel demo",
    apiVersion: 1,
    compute({ bar, draw }) {
        if (bar.time === 1_700_000_000_000) {
            draw.fibChannel(
                [
                    { time: 1_700_000_000_000, price: 100 },
                    { time: 1_700_030_000_000, price: 120 },
                    { time: 1_700_000_000_000, price: 90 },
                ],
                { showLabels: true, color: "#facc15" },
            );
        }
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "drawing-hash",
        sha256: "d7a41beb3394ab550acad458beb592881e1fdaea11007105820dc2a004c78649",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-drawing-kind" },
    { kind: "diagnostic-code-absent", code: "drawing-budget-exceeded" },
]);

/**
 * `draw.fibChannel` conformance scenario. Emits one fib-channel on
 * the first bar with parallel-line offsets at the default fib levels.
 *
 * @since 0.3
 * @stable
 * @example
 *     import { DRAW_FIB_CHANNEL_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DRAW_FIB_CHANNEL_SCENARIO;
 */
export const DRAW_FIB_CHANNEL_SCENARIO: Scenario = Object.freeze({
    id: "draw-fib-channel",
    title: "draw.fibChannel(...) on a single bar",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
