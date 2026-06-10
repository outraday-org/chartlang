// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.ppo(close)",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot }) {
        const p = ta.ppo(bar.close);
        plot(p.ppo);
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
 * `ta.ppo` conformance scenario. Plots the PPO line, signal line, and
 * histogram over the bundled 10 000-bar `goldenBars.json` fixture
 * with the canonical Appel-era (12, 26, 9) defaults. The registry
 * records `primarySeriesKey: "ppo"` and `visibleSeriesKeys: ["ppo",
 * "signal", "hist"]` on the metadata layer
 * (`TA_REGISTRY_METADATA.ppo`).
 *
 * @since 0.2
 * @stable
 * @example
 *     import { TA_PPO_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_PPO_SCENARIO;
 */
export const TA_PPO_SCENARIO: Scenario = Object.freeze({
    id: "ta-ppo",
    title: "ta.ppo(close)",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
