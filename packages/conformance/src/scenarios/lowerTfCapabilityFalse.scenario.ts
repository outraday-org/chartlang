// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";
import { LTF_30S_FIXTURE_BARS } from "./lowerTfFixtures";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "lower tf capability false",
    apiVersion: 1,
    compute({ plot, request }) {
        const buckets = request.lowerTf({ interval: "30s" });
        plot(buckets.current.length);
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "diagnostic-code-present", code: "multi-timeframe-not-supported" },
]);

/**
 * `request.lowerTf` emits a diagnostic when multi-timeframe is disabled.
 *
 * @since 0.6
 * @experimental
 * @example
 *     import { LOWER_TF_CAPABILITY_FALSE_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void LOWER_TF_CAPABILITY_FALSE_SCENARIO;
 */
export const LOWER_TF_CAPABILITY_FALSE_SCENARIO: Scenario = Object.freeze({
    id: "lower-tf-capability-false",
    title: "request.lowerTf multiTimeframe gate",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    candleLimit: 20,
    capabilitiesOverride: Object.freeze({ multiTimeframe: false }),
    secondaryCandles: Object.freeze({ "30s": LTF_30S_FIXTURE_BARS }),
    assertions: ASSERTIONS,
});
