// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineAlertCondition } from "@invinite-org/chartlang-core";
export default defineAlertCondition({
    name: "condition fires",
    apiVersion: 1,
    conditions: {
        up: { title: "Up", description: "Close > open", defaultMessage: "{{ticker}} up" },
        down: { title: "Down", description: "Close < open", defaultMessage: "{{ticker}} down" },
    },
    compute({ bar, signal }) {
        signal?.("up", bar.close > bar.open);
        signal?.("down", bar.close < bar.open);
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "alert-condition-fired-at-bar",
        expected: [
            { conditionId: "up", fired: true, bar: 0 },
            { conditionId: "down", fired: false, bar: 0 },
            { conditionId: "up", fired: true, bar: 1 },
            { conditionId: "down", fired: false, bar: 1 },
            { conditionId: "up", fired: false, bar: 2 },
            { conditionId: "down", fired: true, bar: 2 },
        ],
    },
    { kind: "diagnostic-code-absent", code: "unknown-alert-condition" },
]);

/**
 * Phase 5 conformance scenario for define alert condition fires scenario.
 *
 * @since 0.5
 * @stable
 * @example
 *     import { DEFINE_ALERT_CONDITION_FIRES_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DEFINE_ALERT_CONDITION_FIRES_SCENARIO;
 */
export const DEFINE_ALERT_CONDITION_FIRES_SCENARIO: Scenario = Object.freeze({
    id: "define-alert-condition-fires",
    title: "defineAlertCondition fires",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    candleLimit: 3,
    assertions: ASSERTIONS,
});
