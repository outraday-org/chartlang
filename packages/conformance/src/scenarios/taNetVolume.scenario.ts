// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.netVolume()",
    apiVersion: 1,
    overlay: false,
    compute({ ta, plot }) {
        plot(ta.netVolume());
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.netVolume` conformance scenario. Plots the cumulative signed-
 * volume series over the bundled 10 000-bar `goldenBars.json` fixture
 * in its own pane. Math equals `ta.obv` (deliberate dup for Pine /
 * invinite naming parity — see `netVolume.ts` JSDoc).
 *
 * @since 0.2
 * @stable
 * @example
 *     import { TA_NET_VOLUME_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_NET_VOLUME_SCENARIO;
 */
export const TA_NET_VOLUME_SCENARIO: Scenario = Object.freeze({
    id: "ta-netVolume",
    title: "ta.netVolume()",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
