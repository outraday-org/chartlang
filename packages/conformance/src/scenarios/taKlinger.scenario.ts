// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.klinger()",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot }) {
        const k = ta.klinger();
        plot(k.klinger);
        plot(k.signal);
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.klinger` conformance scenario. Plots the Klinger Volume
 * Oscillator + its EMA signal over the bundled 10 000-bar
 * `goldenBars.json` fixture with default opts (34, 55, 13).
 * `primarySeriesKey: "klinger"` is recorded on the registry's
 * metadata layer (`TA_REGISTRY_METADATA.klinger`).
 *
 * @since 0.2
 * @experimental
 * @example
 *     import { TA_KLINGER_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_KLINGER_SCENARIO;
 */
export const TA_KLINGER_SCENARIO: Scenario = Object.freeze({
    id: "ta-klinger",
    title: "ta.klinger()",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
