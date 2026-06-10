// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";
import { LTF_30S_FIXTURE_BARS } from "./lowerTfFixtures";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "lower tf happy path",
    apiVersion: 1,
    compute({ plot, request }) {
        const buckets = request.lowerTf({ interval: "30s" });
        plot(buckets.current.length);
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "plot-hash",
        sha256: "ca81b7dd29d334e310a47f67ff5e44a7a1b81331aa67727862d7e1873c7e5f98",
    },
    { kind: "diagnostic-code-absent", code: "multi-timeframe-not-supported" },
    { kind: "diagnostic-code-absent", code: "unsupported-interval" },
    { kind: "diagnostic-code-absent", code: "unknown-secondary-stream" },
]);

/**
 * Happy-path `request.lowerTf` scenario with bucketed 30-second bars.
 *
 * @since 0.6
 * @stable
 * @example
 *     import { LOWER_TF_HAPPY_PATH_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void LOWER_TF_HAPPY_PATH_SCENARIO;
 */
export const LOWER_TF_HAPPY_PATH_SCENARIO: Scenario = Object.freeze({
    id: "lower-tf-happy-path",
    title: "request.lowerTf bucketed bars",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    candleLimit: 100,
    capabilitiesOverride: Object.freeze({ multiTimeframe: true }),
    secondaryCandles: Object.freeze({ "30s": LTF_30S_FIXTURE_BARS }),
    assertions: ASSERTIONS,
});
