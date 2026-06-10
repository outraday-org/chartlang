// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator, plot, runtime } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "runtime error",
    apiVersion: 1,
    compute({ bar, plot, runtime }) {
        plot(bar.close);
        runtime.log.info("before halt");
        runtime.error("invariant");
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "plot-hash",
        sha256: "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945",
    },
    { kind: "log-emission-count", expected: 0 },
    { kind: "diagnostic-code-present", code: "runtime-error-thrown" },
]);

/**
 * Phase 5 conformance scenario for runtime error scenario.
 *
 * @since 0.5
 * @stable
 * @example
 *     import { RUNTIME_ERROR_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void RUNTIME_ERROR_SCENARIO;
 */
export const RUNTIME_ERROR_SCENARIO: Scenario = Object.freeze({
    id: "runtime-error",
    title: "runtime.error halts current bar",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    candleLimit: 1,
    assertions: ASSERTIONS,
});
