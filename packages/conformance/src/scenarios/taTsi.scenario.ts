// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.tsi(close)",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot }) {
        const t = ta.tsi(bar.close);
        plot(t.tsi);
        plot(t.signal);
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.tsi` conformance scenario. Plots both `tsi` and `signal` of
 * William Blau's momentum True Strength Index over the bundled
 * 10 000-bar `goldenBars.json` fixture with default opts (25, 13, 13).
 * `primarySeriesKey: "tsi"` on `TA_REGISTRY_METADATA.tsi`.
 *
 * Note: this is the **momentum**-class TSI shipped by Task 14. The
 * **trend**-class True Strength Index ships in Task 17 as
 * `ta.trendStrengthIndex`.
 *
 * @since 0.2
 * @stable
 * @example
 *     import { TA_TSI_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_TSI_SCENARIO;
 */
export const TA_TSI_SCENARIO: Scenario = Object.freeze({
    id: "ta-tsi",
    title: "ta.tsi(close)",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
