// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.momentum(close, 10)",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        plot(ta.momentum(bar.close, 10));
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.momentum` conformance scenario. Plots the 10-bar first-difference
 * of `bar.close` (composed via `ta.change`) over the bundled 10 000-bar
 * `goldenBars.json` fixture.
 *
 * @since 0.2
 * @stable
 * @example
 *     import { TA_MOMENTUM_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_MOMENTUM_SCENARIO;
 */
export const TA_MOMENTUM_SCENARIO: Scenario = Object.freeze({
    id: "ta-momentum",
    title: "ta.momentum(close, 10)",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
