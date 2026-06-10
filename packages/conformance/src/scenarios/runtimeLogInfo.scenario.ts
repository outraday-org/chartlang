// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator, runtime } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "runtime log info",
    apiVersion: 1,
    compute({ bar, runtime }) {
        runtime.log.info("bar close", { close: bar.close });
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "log-emission-count", expected: 3 },
]);

/**
 * Phase 5 conformance scenario for runtime log info scenario.
 *
 * @since 0.5
 * @stable
 * @example
 *     import { RUNTIME_LOG_INFO_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void RUNTIME_LOG_INFO_SCENARIO;
 */
export const RUNTIME_LOG_INFO_SCENARIO: Scenario = Object.freeze({
    id: "runtime-log-info",
    title: "runtime.log.info emits",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    candleLimit: 3,
    assertions: ASSERTIONS,
});
