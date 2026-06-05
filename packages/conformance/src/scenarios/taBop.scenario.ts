// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.bop()",
    apiVersion: 1,
    overlay: false,
    compute({ ta, plot }) {
        plot(ta.bop());
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.bop` conformance scenario. Plots the raw per-bar Balance of
 * Power `(close - open) / (high - low)` over the bundled 10 000-bar
 * `goldenBars.json` fixture in its own pane.
 *
 * @since 0.2
 * @experimental
 * @example
 *     import { TA_BOP_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_BOP_SCENARIO;
 */
export const TA_BOP_SCENARIO: Scenario = Object.freeze({
    id: "ta-bop",
    title: "ta.bop()",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
