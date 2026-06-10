// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.bb(close, 20, { multiplier: 2 })",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        const b = ta.bb(bar.close, 20, { multiplier: 2 });
        plot(b.upper);
        plot(b.middle);
        plot(b.lower);
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.bb` conformance scenario. Plots the upper / middle / lower
 * bands of Bollinger(close, 20, σ=2) over the bundled 10 000-bar
 * `goldenBars.json` fixture. Distinct from `BOLLINGER_BANDS_SCENARIO`,
 * which targets the curated `bollinger-bands.chart.ts` example — this
 * scenario exists so the §22.10 contract "one dedicated scenario per
 * `ta.*` primitive" holds for `ta.bb`.
 *
 * @since 0.2.2
 * @stable
 * @example
 *     import { TA_BB_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_BB_SCENARIO;
 */
export const TA_BB_SCENARIO: Scenario = Object.freeze({
    id: "ta-bb",
    title: "ta.bb(close, 20, { multiplier: 2 })",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
