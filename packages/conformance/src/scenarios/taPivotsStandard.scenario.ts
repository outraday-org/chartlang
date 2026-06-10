// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.pivotsStandard()",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        const p = ta.pivotsStandard();
        plot(p.pp);
        plot(p.r1);
        plot(p.s1);
        plot(p.r2);
        plot(p.s2);
        plot(p.r3);
        plot(p.s3);
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.pivotsStandard` conformance scenario. Plots the seven daily
 * pivot-point levels (P + R1..R3 + S1..S3) over the bundled 10 000-
 * bar `goldenBars.json` fixture. Asserts the conformance-suite
 * contract only — clean run with no alerts and no validation
 * diagnostics.
 *
 * @since 0.2
 * @stable
 * @example
 *     import { TA_PIVOTS_STANDARD_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_PIVOTS_STANDARD_SCENARIO;
 */
export const TA_PIVOTS_STANDARD_SCENARIO: Scenario = Object.freeze({
    id: "ta-pivotsStandard",
    title: "ta.pivotsStandard()",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
