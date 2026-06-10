// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";
import { MTF_DAILY_FIXTURE_BARS } from "./mtfFixtures.js";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "mtf capability false",
    apiVersion: 1,
    compute({ plot, request }) {
        const daily = request.security({ interval: "1D" });
        plot(daily.close);
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "diagnostic-code-present", code: "multi-timeframe-not-supported" },
    {
        kind: "plot-hash",
        sha256: "18fb0cce9a095b255be7570ddec6bd84fb089d34c8e92a1b23b14352d1ebb148",
    },
]);

/**
 * `request.security` scenario for `multiTimeframe: false` fallback.
 *
 * @since 0.5
 * @stable
 * @example
 *     import { MTF_CAPABILITY_FALSE_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void MTF_CAPABILITY_FALSE_SCENARIO;
 */
export const MTF_CAPABILITY_FALSE_SCENARIO: Scenario = Object.freeze({
    id: "mtf-capability-false",
    title: "MTF capability false",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    candleLimit: 10,
    capabilitiesOverride: Object.freeze({
        multiTimeframe: false,
    }),
    secondaryCandles: Object.freeze({
        "1D": MTF_DAILY_FIXTURE_BARS,
    }),
    assertions: ASSERTIONS,
});
