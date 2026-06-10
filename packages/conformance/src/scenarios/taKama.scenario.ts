// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.kama(close, {length:10, fastLength:2, slowLength:30})",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        plot(ta.kama(bar.close, { length: 10, fastLength: 2, slowLength: 30 }));
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.kama` conformance scenario. Plots Kaufman's Adaptive MA with the
 * Pine-canonical defaults over the bundled 10 000-bar `goldenBars.json`
 * fixture.
 *
 * @since 0.2
 * @stable
 * @example
 *     import { TA_KAMA_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_KAMA_SCENARIO;
 */
export const TA_KAMA_SCENARIO: Scenario = Object.freeze({
    id: "ta-kama",
    title: "ta.kama(close, {length:10, fastLength:2, slowLength:30})",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
