// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.adr({ length: 14 })",
    apiVersion: 1,
    overlay: false,
    compute({ ta, plot }) {
        plot(ta.adr({ length: 14 }));
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.adr` conformance scenario. Plots a 14-day Average Daily Range
 * over the bundled 10 000-bar `goldenBars.json` fixture (1m cadence;
 * the calendar-day aggregator emits NaN until 14 distinct UTC days
 * have committed — likely the full run on this fixture).
 *
 * @since 0.2
 * @stable
 * @example
 *     import { TA_ADR_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_ADR_SCENARIO;
 */
export const TA_ADR_SCENARIO: Scenario = Object.freeze({
    id: "ta-adr",
    title: "ta.adr({ length: 14 })",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
