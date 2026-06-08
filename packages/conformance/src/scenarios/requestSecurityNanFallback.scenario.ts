// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "request security nan",
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
        sha256: "c85bd07eb710e40324234110dfddc4f7455ffacf0fea7bc1d8fca9a7f78035bc",
    },
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-present", code: "multi-timeframe-not-supported" },
]);

/**
 * `request.security` NaN fallback scenario. A single-stream adapter declares
 * the requested interval but not multi-timeframe support.
 *
 * @since 0.4
 * @experimental
 * @example
 *     import { REQUEST_SECURITY_NAN_FALLBACK_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void REQUEST_SECURITY_NAN_FALLBACK_SCENARIO;
 */
export const REQUEST_SECURITY_NAN_FALLBACK_SCENARIO: Scenario = Object.freeze({
    id: "request-security-nan-fallback",
    title: "request.security NaN fallback",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    candleLimit: 100,
    capabilitiesOverride: Object.freeze({
        intervals: Object.freeze([{ value: "1D", label: "1 day", group: "daily" }]),
        multiTimeframe: false,
    }),
    assertions: ASSERTIONS,
});
