// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.pvt()",
    apiVersion: 1,
    overlay: false,
    compute({ ta, plot }) {
        plot(ta.pvt());
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.pvt` conformance scenario. Plots the cumulative Price Volume
 * Trend (`volume · close-pct-change`) over the bundled 10 000-bar
 * `goldenBars.json` fixture in its own pane. The first bar emits 0;
 * zero-prevClose bars emit NaN.
 *
 * @since 0.2
 * @stable
 * @example
 *     import { TA_PVT_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_PVT_SCENARIO;
 */
export const TA_PVT_SCENARIO: Scenario = Object.freeze({
    id: "ta-pvt",
    title: "ta.pvt()",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
