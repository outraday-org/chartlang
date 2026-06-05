// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.rvgi()",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot }) {
        const r = ta.rvgi();
        plot(r.rvgi);
        plot(r.signal);
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.rvgi` conformance scenario. Plots the Relative Vigor Index +
 * its 4-bar weighted signal over the bundled 10 000-bar
 * `goldenBars.json` fixture with default `length = 10`.
 * `primarySeriesKey: "rvgi"` is recorded on the registry's metadata
 * layer (`TA_REGISTRY_METADATA.rvgi`).
 *
 * @since 0.2
 * @experimental
 * @example
 *     import { TA_RVGI_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_RVGI_SCENARIO;
 */
export const TA_RVGI_SCENARIO: Scenario = Object.freeze({
    id: "ta-rvgi",
    title: "ta.rvgi()",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
