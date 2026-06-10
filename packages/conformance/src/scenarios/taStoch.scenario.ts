// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.stoch(14, 3, 3)",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot }) {
        const s = ta.stoch({ kLength: 14, kSmoothing: 3, dLength: 3 });
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
 * `ta.stoch` conformance scenario. Plots both `%K` and `%D` over the
 * bundled 10 000-bar `goldenBars.json` fixture with the canonical
 * Stochastic (14, 3, 3) settings. `primarySeriesKey: "k"` is recorded
 * on the registry's metadata layer (`TA_REGISTRY_METADATA.stoch`).
 *
 * @since 0.2
 * @stable
 * @example
 *     import { TA_STOCH_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_STOCH_SCENARIO;
 */
export const TA_STOCH_SCENARIO: Scenario = Object.freeze({
    id: "ta-stoch",
    title: "ta.stoch(14, 3, 3)",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
