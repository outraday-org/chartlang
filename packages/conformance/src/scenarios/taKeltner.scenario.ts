// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.keltner({ length: 20, multiplier: 2 })",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        const k = ta.keltner({ length: 20, multiplier: 2 });
        plot(k.upper);
        plot(k.middle);
        plot(k.lower);
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.keltner` conformance scenario. Plots the upper / middle / lower
 * bands of Keltner Channels (length=20, multiplier=2, default
 * maType=ema) over the bundled 10 000-bar `goldenBars.json` fixture.
 *
 * @since 0.2
 * @experimental
 * @example
 *     import { TA_KELTNER_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_KELTNER_SCENARIO;
 */
export const TA_KELTNER_SCENARIO: Scenario = Object.freeze({
    id: "ta-keltner",
    title: "ta.keltner({ length: 20, multiplier: 2 })",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
