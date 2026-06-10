// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator, runtime } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "runtime log gated",
    apiVersion: 1,
    compute({ runtime }) {
        runtime.log.warn("hidden");
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "log-emission-count", expected: 0 },
    { kind: "diagnostic-code-absent", code: "runtime-log-budget-exceeded" },
]);

/**
 * Phase 5 conformance scenario for runtime log gated scenario.
 *
 * @since 0.5
 * @stable
 * @example
 *     import { RUNTIME_LOG_GATED_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void RUNTIME_LOG_GATED_SCENARIO;
 */
export const RUNTIME_LOG_GATED_SCENARIO: Scenario = Object.freeze({
    id: "runtime-log-gated",
    title: "runtime.log gated",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    candleLimit: 3,
    capabilitiesOverride: { logs: false },
    assertions: ASSERTIONS,
});
