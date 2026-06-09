// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "mtf unsupported interval",
    apiVersion: 1,
    compute({ plot, request }) {
        const weekly = request.security({ interval: "7D" });
        plot(weekly.close);
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "diagnostic-code-present", code: "unsupported-interval" },
    {
        kind: "plot-hash",
        sha256: "18fb0cce9a095b255be7570ddec6bd84fb089d34c8e92a1b23b14352d1ebb148",
    },
]);

/**
 * `request.security` scenario for runtime unsupported interval fallback.
 *
 * @since 0.5
 * @experimental
 * @example
 *     import { MTF_UNSUPPORTED_INTERVAL_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void MTF_UNSUPPORTED_INTERVAL_SCENARIO;
 */
export const MTF_UNSUPPORTED_INTERVAL_SCENARIO: Scenario = Object.freeze({
    id: "mtf-unsupported-interval",
    title: "MTF unsupported interval",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    candleLimit: 10,
    capabilitiesOverride: Object.freeze({
        multiTimeframe: true,
    }),
    assertions: ASSERTIONS,
});
