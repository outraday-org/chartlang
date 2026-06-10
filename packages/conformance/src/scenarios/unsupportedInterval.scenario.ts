// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "unsupported interval",
    apiVersion: 1,
    compute({ plot, request }) {
        const exotic = request.security({ interval: "37s" });
        plot(exotic.close);
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "plot-hash",
        sha256: "c85bd07eb710e40324234110dfddc4f7455ffacf0fea7bc1d8fca9a7f78035bc",
    },
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-present", code: "unsupported-interval" },
]);

/**
 * `request.security` unsupported interval scenario. The requested `"37s"`
 * interval is absent from the adapter capability bag.
 *
 * @since 0.4
 * @stable
 * @example
 *     import { UNSUPPORTED_INTERVAL_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void UNSUPPORTED_INTERVAL_SCENARIO;
 */
export const UNSUPPORTED_INTERVAL_SCENARIO: Scenario = Object.freeze({
    id: "unsupported-interval",
    title: "request.security unsupported interval",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    candleLimit: 100,
    capabilitiesOverride: Object.freeze({
        intervals: Object.freeze([{ value: "1D", label: "1 day", group: "daily" }]),
        multiTimeframe: true,
    }),
    assertions: ASSERTIONS,
});
