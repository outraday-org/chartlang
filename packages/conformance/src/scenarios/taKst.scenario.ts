// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.kst(close)",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot }) {
        const k = ta.kst(bar.close);
        plot(k.kst);
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
 * `ta.kst` conformance scenario. Plots the Know Sure Thing line + its
 * SMA signal over the bundled 10 000-bar `goldenBars.json` fixture
 * with default opts (10, 15, 20, 30, 10, 10, 10, 15, 9).
 * `primarySeriesKey: "kst"` is recorded on the registry's metadata
 * layer (`TA_REGISTRY_METADATA.kst`).
 *
 * @since 0.2
 * @stable
 * @example
 *     import { TA_KST_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_KST_SCENARIO;
 */
export const TA_KST_SCENARIO: Scenario = Object.freeze({
    id: "ta-kst",
    title: "ta.kst(close)",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
