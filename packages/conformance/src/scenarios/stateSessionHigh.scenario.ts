// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "session high",
    apiVersion: 1,
    compute({ bar, barstate, plot, state }) {
        const high = state.float(NaN);
        if (barstate.isfirst || Number.isNaN(high.value) || bar.high > high.value) {
            high.value = bar.high;
        }
        plot(high.value);
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "plot-hash",
        sha256: "e00e82e5657d3df0225dff00e0e274b6fdf453d210f92fc466006290ac5b531b",
    },
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `state.float` conformance scenario. Tracks the session high and pins the
 * resulting per-bar plot sequence.
 *
 * @since 0.4
 * @stable
 * @example
 *     import { STATE_SESSION_HIGH_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void STATE_SESSION_HIGH_SCENARIO;
 */
export const STATE_SESSION_HIGH_SCENARIO: Scenario = Object.freeze({
    id: "state-session-high",
    title: "state.float session-high tracker",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
