// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";
import { MTF_DAILY_FIXTURE_BARS } from "./mtfFixtures.js";

// EMA length 2 keeps the three-bar reference sequence compact. Pine-compatible
// EMA seeds on the first HTF close, so every aligned value after the first
// secondary close is finite and remains distinct from the NaN fallback.
const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "mtf security expression ema",
    apiVersion: 1,
    compute({ plot, ta, request }) {
        plot(request.security({ interval: "1D" }, (bar) => ta.ema(bar.close, 2)));
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "plot-hash",
        sha256: "9d7725a035c4d1f96248c1bd2588b47548118d8f5e2e20a54b9bd9e0e5035ced",
    },
    { kind: "diagnostic-code-absent", code: "multi-timeframe-not-supported" },
    { kind: "diagnostic-code-absent", code: "unsupported-interval" },
]);

/**
 * Higher-timeframe `request.security` **expression form**: the EMA(2) is
 * computed ON the secondary daily bars (the HTF clock), not on the
 * main-timeline-aligned daily close. The pinned plot-hash captures the
 * runtime's aligned output series; because the secondary fixture closes
 * (510/620/730) live in a different price band than the main golden bars
 * (~100), the hash also proves the value is the HTF-clock EMA rather than
 * a same-length main EMA. The companion regression guard
 * (`mtfSecurityExpressionEma.test.ts`) asserts the mean-absolute difference
 * against a same-length main EMA exceeds a threshold.
 *
 * @since 0.10
 * @stable
 * @example
 *     import { MTF_SECURITY_EXPRESSION_EMA_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void MTF_SECURITY_EXPRESSION_EMA_SCENARIO;
 */
export const MTF_SECURITY_EXPRESSION_EMA_SCENARIO: Scenario = Object.freeze({
    id: "mtf-security-expression-ema",
    title: "MTF request.security expression EMA",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    candleLimit: 10,
    capabilitiesOverride: Object.freeze({
        multiTimeframe: true,
    }),
    secondaryCandles: Object.freeze({
        "1D": MTF_DAILY_FIXTURE_BARS,
    }),
    assertions: ASSERTIONS,
});
