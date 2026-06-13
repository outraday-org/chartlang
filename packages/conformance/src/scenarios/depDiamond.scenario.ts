// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator, plot, ta } from "@invinite-org/chartlang-core";

const fastTrend = defineIndicator({
    name: "diamond fast",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        plot(ta.ema(bar.close, 8), { title: "line" });
    },
});

const slowTrend = defineIndicator({
    name: "diamond slow",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        plot(ta.ema(bar.close, 21), { title: "line" });
    },
});

// Default consumer reads from both private deps. Both run per bar with
// their own state slot section in the runner snapshot (Task 5 prefixing).
export default defineIndicator({
    name: "diamond consumer",
    apiVersion: 1,
    overlay: true,
    compute({ bar, plot }) {
        const fast = fastTrend.output("line").current;
        const slow = slowTrend.output("line").current;
        plot((fast + slow) / 2 - bar.close, { title: "diamond gap" });
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "plot-hash",
        sha256: "f9aebd15337ab978e8fcfb01f5aab84919d9578b588580a0fa3c4e0a777c7ade",
    },
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "dep-error" },
]);

/**
 * Phase-7 indicator-composition scenario — two private deps in one
 * file feed a default-export consumer. Each dep gets its own
 * `DepRunner` + slot-store section in the runner snapshot (Task 5
 * `dep:<localId>/` prefixing). Pins the consumer's plot stream
 * against the canvas2d capability bag.
 *
 * @since 0.7
 * @stable
 * @example
 *     import { DEP_DIAMOND_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DEP_DIAMOND_SCENARIO;
 */
export const DEP_DIAMOND_SCENARIO: Scenario = Object.freeze({
    id: "dep-diamond",
    title: "Two private deps in one file feed one consumer",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    candleLimit: 50,
    assertions: ASSERTIONS,
});
