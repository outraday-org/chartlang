// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.pmo(close)",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot }) {
        const p = ta.pmo(bar.close);
        plot(p.pmo);
        plot(p.signal);
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.pmo` conformance scenario. Plots both `pmo` and `signal` of Carl
 * Swenlin's Price Momentum Oscillator over the bundled 10 000-bar
 * `goldenBars.json` fixture with default opts (35, 20, 10).
 * `primarySeriesKey: "pmo"` is recorded on the registry's metadata
 * layer (`TA_REGISTRY_METADATA.pmo`).
 *
 * @since 0.2
 * @stable
 * @example
 *     import { TA_PMO_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_PMO_SCENARIO;
 */
export const TA_PMO_SCENARIO: Scenario = Object.freeze({
    id: "ta-pmo",
    title: "ta.pmo(close)",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
