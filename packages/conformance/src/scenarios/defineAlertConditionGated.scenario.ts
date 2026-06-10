// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineAlertCondition } from "@invinite-org/chartlang-core";
export default defineAlertCondition({
    name: "condition gated",
    apiVersion: 1,
    conditions: {
        up: { title: "Up", description: "Close > open", defaultMessage: "{{ticker}} up" },
    },
    compute({ signal }) {
        signal?.("up", true);
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-condition-fired-at-bar", expected: [] },
    { kind: "diagnostic-code-present", code: "alert-conditions-not-supported" },
]);

/**
 * Phase 5 conformance scenario for define alert condition gated scenario.
 *
 * @since 0.5
 * @stable
 * @example
 *     import { DEFINE_ALERT_CONDITION_GATED_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DEFINE_ALERT_CONDITION_GATED_SCENARIO;
 */
export const DEFINE_ALERT_CONDITION_GATED_SCENARIO: Scenario = Object.freeze({
    id: "define-alert-condition-gated",
    title: "defineAlertCondition gated",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    candleLimit: 3,
    capabilitiesOverride: { alertConditions: false },
    assertions: ASSERTIONS,
});
