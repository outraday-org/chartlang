// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.massIndex()",
    apiVersion: 1,
    overlay: false,
    compute({ ta, plot }) {
        plot(ta.massIndex());
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.massIndex` conformance scenario. Plots Mass Index (defaults:
 * emaLength=9, sumLength=25) over the bundled 10 000-bar
 * `goldenBars.json` fixture.
 *
 * @since 0.2
 * @stable
 * @example
 *     import { TA_MASS_INDEX_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_MASS_INDEX_SCENARIO;
 */
export const TA_MASS_INDEX_SCENARIO: Scenario = Object.freeze({
    id: "ta-massIndex",
    title: "ta.massIndex()",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
