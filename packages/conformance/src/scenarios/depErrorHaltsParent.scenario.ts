// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator, plot, runtime, state } from "@invinite-org/chartlang-core";

const flaky = defineIndicator({
    name: "flaky dep",
    apiVersion: 1,
    overlay: true,
    compute({ bar, plot, runtime, state }) {
        const seen = state.int(0);
        seen.value += 1;
        if (seen.value === 5) {
            runtime.error("dep failed on bar 5");
        }
        plot(bar.close, { title: "line" });
    },
});

export default defineIndicator({
    name: "halt-on-dep-error consumer",
    apiVersion: 1,
    overlay: true,
    compute({ bar, plot }) {
        const trend = flaky.output("line");
        plot(trend.current - bar.close, { title: "gap" });
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "plot-hash",
        sha256: "95b4c58d8aab2f6b6d1236af773f4c1a124c5c2eb4bc6eeb2c98fa15bd60369c",
    },
    { kind: "diagnostic-code-present", code: "dep-error" },
]);

/**
 * Phase-7 indicator-composition scenario — dep error halts parent.
 * The dep's `compute` calls `runtime.error(...)` on bar index 5;
 * the consumer's emissions for that bar drop, subsequent bars
 * resume. Pins the consumer's plot stream + asserts the
 * `dep-error` diagnostic surfaces.
 *
 * @since 0.7
 * @stable
 * @example
 *     import { DEP_ERROR_HALTS_PARENT_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void DEP_ERROR_HALTS_PARENT_SCENARIO;
 */
export const DEP_ERROR_HALTS_PARENT_SCENARIO: Scenario = Object.freeze({
    id: "dep-error-halts-parent",
    title: "Dep error halts the consumer's emissions for the failing bar",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    candleLimit: 10,
    assertions: ASSERTIONS,
});
