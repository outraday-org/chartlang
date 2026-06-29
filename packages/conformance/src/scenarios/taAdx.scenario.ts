// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.adx(14)",
    apiVersion: 1,
    overlay: false,
    compute({ ta, plot }) {
        plot(ta.adx(14));
    },
});
`;

// Value-pins the REAL-path ADX series over the bundled golden bars. ADX reads
// `bar.high`/`bar.low`/`bar.close` (number-coercible series-view proxies)
// directly; the proxy-coercion fix makes the directional helpers see real
// numbers instead of an always-NaN proxy. Re-pin via the runner's "expected vs
// actual" message if the golden bars change.
const ADX_HASH = "efc249b558d175200718a207d3567a79a50bec1c9b1fe899786715b4ab263472";

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "plot-hash", slotId: "<inline:ta-adx>.chart.ts:7:9#0", sha256: ADX_HASH },
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.adx` conformance scenario. Plots Wilder's ADX(14) over the
 * bundled 10 000-bar `goldenBars.json` fixture.
 *
 * @since 0.2
 * @stable
 * @example
 *     import { TA_ADX_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_ADX_SCENARIO;
 */
export const TA_ADX_SCENARIO: Scenario = Object.freeze({
    id: "ta-adx",
    title: "ta.adx(14)",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
