// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.stochRsi(close)",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot }) {
        const s = ta.stochRsi(bar.close);
        plot(s.k);
        plot(s.d);
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.stochRsi` conformance scenario. Plots both `%K` and `%D` of the
 * Stochastic RSI over the bundled 10 000-bar `goldenBars.json` fixture
 * with default opts (14, 14, 3, 3). `primarySeriesKey: "k"` is recorded
 * on the registry's metadata layer (`TA_REGISTRY_METADATA.stochRsi`).
 *
 * @since 0.2
 * @experimental
 * @example
 *     import { TA_STOCH_RSI_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_STOCH_RSI_SCENARIO;
 */
export const TA_STOCH_RSI_SCENARIO: Scenario = Object.freeze({
    id: "ta-stochRsi",
    title: "ta.stochRsi(close)",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
