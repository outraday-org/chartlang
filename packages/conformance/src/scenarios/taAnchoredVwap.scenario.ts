// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.anchoredVwap(1_700_000_000_000)",
    apiVersion: 1,
    overlay: true,
    compute({ ta, plot }) {
        plot(ta.anchoredVwap(1_700_000_000_000));
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.anchoredVwap` conformance scenario. Plots an anchored VWAP
 * anchored at `1_700_000_000_000` (a UTC ms epoch coincident with
 * the bundled `goldenBars.json` fixture's first bar). The
 * accumulator never resets — runs from the anchor to the last bar.
 *
 * @since 0.2
 * @stable
 * @example
 *     import { TA_ANCHORED_VWAP_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_ANCHORED_VWAP_SCENARIO;
 */
export const TA_ANCHORED_VWAP_SCENARIO: Scenario = Object.freeze({
    id: "ta-anchored-vwap",
    title: "ta.anchoredVwap(1_700_000_000_000)",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
