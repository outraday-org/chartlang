// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "tick counter",
    apiVersion: 1,
    compute({ alert, barstate, plot, state }) {
        const ticks = state.tick.int(0);
        if (barstate.isrealtime) ticks.value += 1;
        if (ticks.value === 20) alert("twenty ticks");
        plot(ticks.value);
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "plot-hash",
        sha256: "aa252484890a2fc35a4f8a08129b30753e0a2869fab8559a9e82fd3acd138ec6",
    },
    { kind: "alert-count", count: 1 },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `state.tick.int` conformance scenario. Counts twenty tick events after one
 * initial close and emits one alert at the final counter value.
 *
 * @since 0.4
 * @experimental
 * @example
 *     import { STATE_TICK_COUNTER_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void STATE_TICK_COUNTER_SCENARIO;
 */
export const STATE_TICK_COUNTER_SCENARIO: Scenario = Object.freeze({
    id: "state-tick-counter",
    title: "state.tick.int tick counter",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    candleLimit: 21,
    eventStream: Object.freeze({ kind: "initial-close-then-ticks" }),
    assertions: ASSERTIONS,
});
