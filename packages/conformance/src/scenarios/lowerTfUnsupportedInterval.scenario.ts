// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "lower tf unsupported interval",
    apiVersion: 1,
    compute({ plot, request }) {
        const buckets = request.lowerTf({ interval: "1s" });
        plot(buckets.current.length);
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "diagnostic-code-present", code: "unsupported-interval" },
]);

/**
 * `request.lowerTf` emits a diagnostic for intervals outside capabilities.
 *
 * @since 0.6
 * @experimental
 * @example
 *     import { LOWER_TF_UNSUPPORTED_INTERVAL_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void LOWER_TF_UNSUPPORTED_INTERVAL_SCENARIO;
 */
export const LOWER_TF_UNSUPPORTED_INTERVAL_SCENARIO: Scenario = Object.freeze({
    id: "lower-tf-unsupported-interval",
    title: "request.lowerTf unsupported interval",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    candleLimit: 20,
    capabilitiesOverride: Object.freeze({ multiTimeframe: true }),
    assertions: ASSERTIONS,
});
