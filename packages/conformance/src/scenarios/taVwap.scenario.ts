// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.vwap()",
    apiVersion: 1,
    overlay: true,
    compute({ ta, plot }) {
        plot(ta.vwap({ source: "hlc3" }));
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.vwap` conformance scenario. Plots a UTC-day-anchored VWAP
 * over the bundled 10 000-bar `goldenBars.json` fixture. Phase 2
 * keys the session reset off `floor(bar.time / 86_400_000)` —
 * Phase 4 will lift the boundary to `syminfo.session.regularStart`.
 *
 * @since 0.2
 * @stable
 * @example
 *     import { TA_VWAP_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_VWAP_SCENARIO;
 */
export const TA_VWAP_SCENARIO: Scenario = Object.freeze({
    id: "ta-vwap",
    title: "ta.vwap({ source: 'hlc3' })",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
