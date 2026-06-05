// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.cmf(20)",
    apiVersion: 1,
    overlay: false,
    compute({ ta, plot }) {
        plot(ta.cmf(20));
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.cmf` conformance scenario. Plots the 20-bar Chaikin Money Flow
 * over the bundled 10 000-bar `goldenBars.json` fixture. CMF is
 * mathematically bounded to `[-1, 1]`; the per-bar property tests
 * pin that invariant — this scenario asserts the conformance-suite
 * contract only (clean run + no alerts).
 *
 * @since 0.2
 * @experimental
 * @example
 *     import { TA_CMF_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_CMF_SCENARIO;
 */
export const TA_CMF_SCENARIO: Scenario = Object.freeze({
    id: "ta-cmf",
    title: "ta.cmf(20)",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
