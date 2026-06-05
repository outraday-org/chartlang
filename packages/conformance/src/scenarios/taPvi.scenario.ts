// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.pvi()",
    apiVersion: 1,
    overlay: false,
    compute({ ta, plot }) {
        plot(ta.pvi());
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.pvi` conformance scenario. Plots the Positive Volume Index
 * line (cumulative close-pct-change on higher-volume bars only,
 * seeded at 1000 — mirror of {@link TA_NVI_SCENARIO}) over the
 * bundled 10 000-bar `goldenBars.json` fixture in its own pane.
 *
 * @since 0.2
 * @experimental
 * @example
 *     import { TA_PVI_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_PVI_SCENARIO;
 */
export const TA_PVI_SCENARIO: Scenario = Object.freeze({
    id: "ta-pvi",
    title: "ta.pvi()",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
