// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.nvi()",
    apiVersion: 1,
    overlay: false,
    compute({ ta, plot }) {
        plot(ta.nvi());
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.nvi` conformance scenario. Plots the Negative Volume Index
 * line (cumulative close-pct-change on lower-volume bars only,
 * seeded at 1000) over the bundled 10 000-bar `goldenBars.json`
 * fixture in its own pane.
 *
 * @since 0.2
 * @stable
 * @example
 *     import { TA_NVI_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_NVI_SCENARIO;
 */
export const TA_NVI_SCENARIO: Scenario = Object.freeze({
    id: "ta-nvi",
    title: "ta.nvi()",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
