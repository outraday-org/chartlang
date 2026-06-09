// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";
import { MTF_DAILY_FIXTURE_BARS } from "./mtfFixtures";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "mtf request security close",
    apiVersion: 1,
    compute({ plot, request }) {
        const daily = request.security({ interval: "1D" });
        plot(daily.close);
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "plot-hash",
        sha256: "6e20792358fec6699d7ffa387ccee1796f676be456cf5f03efce6d311ab79c86",
    },
    { kind: "diagnostic-code-absent", code: "multi-timeframe-not-supported" },
    { kind: "diagnostic-code-absent", code: "unsupported-interval" },
]);

/**
 * Happy-path `request.security` scenario with aligned secondary daily close.
 *
 * @since 0.5
 * @experimental
 * @example
 *     import { MTF_REQUEST_SECURITY_CLOSE_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void MTF_REQUEST_SECURITY_CLOSE_SCENARIO;
 */
export const MTF_REQUEST_SECURITY_CLOSE_SCENARIO: Scenario = Object.freeze({
    id: "mtf-request-security-close",
    title: "MTF request.security close",
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
