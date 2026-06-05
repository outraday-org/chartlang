// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.fisher(10)",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot }) {
        const f = ta.fisher(10);
        plot(f.fisher);
        plot(f.trigger);
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.fisher` conformance scenario. Plots the Fisher Transform line +
 * its 1-bar-lagged `trigger` over the bundled 10 000-bar
 * `goldenBars.json` fixture with `length = 10`. `primarySeriesKey:
 * "fisher"` is recorded on the registry's metadata layer
 * (`TA_REGISTRY_METADATA.fisher`).
 *
 * @since 0.2
 * @experimental
 * @example
 *     import { TA_FISHER_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_FISHER_SCENARIO;
 */
export const TA_FISHER_SCENARIO: Scenario = Object.freeze({
    id: "ta-fisher",
    title: "ta.fisher(10)",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
