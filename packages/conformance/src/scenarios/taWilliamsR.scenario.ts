// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.williamsR(14)",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot }) {
        plot(ta.williamsR(14));
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.williamsR` conformance scenario. Plots a 14-bar Williams %R
 * over the bundled 10 000-bar `goldenBars.json` fixture. Y-range is
 * pinned `[-100, 0]` via `TA_REGISTRY_METADATA.williamsR.yDomain`.
 *
 * @since 0.2
 * @experimental
 * @example
 *     import { TA_WILLIAMS_R_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_WILLIAMS_R_SCENARIO;
 */
export const TA_WILLIAMS_R_SCENARIO: Scenario = Object.freeze({
    id: "ta-williams-r",
    title: "ta.williamsR(14)",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
