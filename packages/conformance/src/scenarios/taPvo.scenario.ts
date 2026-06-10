// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.pvo()",
    apiVersion: 1,
    overlay: false,
    compute({ ta, plot }) {
        const p = ta.pvo();
        plot(p.pvo);
        plot(p.signal);
        plot(p.hist);
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.pvo` conformance scenario. Plots the PVO line, signal line, and
 * histogram over the bundled 10 000-bar `goldenBars.json` fixture
 * with the canonical Appel-era (12, 26, 9) defaults. The registry
 * records `primarySeriesKey: "pvo"` and `visibleSeriesKeys: ["pvo",
 * "signal", "hist"]` on the metadata layer
 * (`TA_REGISTRY_METADATA.pvo`).
 *
 * @since 0.2
 * @stable
 * @example
 *     import { TA_PVO_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_PVO_SCENARIO;
 */
export const TA_PVO_SCENARIO: Scenario = Object.freeze({
    id: "ta-pvo",
    title: "ta.pvo()",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
