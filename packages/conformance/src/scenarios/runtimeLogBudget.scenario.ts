// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator, runtime } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "runtime log budget",
    apiVersion: 1,
    compute({ runtime }) {
        Array.from({ length: 1100 }, (_, i) => runtime.log.info("log", { i }));
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "log-emission-count", expected: 1000 },
    { kind: "diagnostic-code-present", code: "runtime-log-budget-exceeded" },
]);

/**
 * Phase 5 conformance scenario for runtime log budget scenario.
 *
 * @since 0.5
 * @stable
 * @example
 *     import { RUNTIME_LOG_BUDGET_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void RUNTIME_LOG_BUDGET_SCENARIO;
 */
export const RUNTIME_LOG_BUDGET_SCENARIO: Scenario = Object.freeze({
    id: "runtime-log-budget",
    title: "runtime.log budget",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    candleLimit: 1,
    assertions: ASSERTIONS,
});
