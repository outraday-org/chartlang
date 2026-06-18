// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";
import { MTF_DAILY_FIXTURE_BARS } from "./mtfFixtures.js";

// EMA length 2 (not 10): the shared 3-bar daily fixture warms a 2-period
// EMA in two HTF closes, so the aligned series carries FINITE values — a
// length-10 EMA over only three HTF bars would be all-NaN (Pine-style
// warmup), a degenerate golden indistinguishable from the NaN fallback and
// unable to prove the distinctness contract.
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
        sha256: "e105d8e00333c1d152d6ce5a40b5ea93077c5342457a125b141abf21a2299aaa",
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
