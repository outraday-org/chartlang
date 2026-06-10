// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator, input } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "input interval",
    apiVersion: 1,
    inputs: {
        tf: input.interval("1D"),
    },
    compute({ inputs, plot }) {
        plot(inputs.tf === "1D" ? 1 : 0);
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "plot-hash",
        sha256: "b281e6d6fc79a5704a4056bce267b472938599bf436ba9aac4912e6897c97c8e",
    },
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "input-coercion-failed" },
]);

/**
 * `input.interval` conformance scenario. Verifies the manifest exposes a
 * user-pickable interval and the runtime default resolves to `"1D"`.
 *
 * @since 0.4
 * @stable
 * @example
 *     import { INPUT_INTERVAL_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void INPUT_INTERVAL_SCENARIO;
 */
export const INPUT_INTERVAL_SCENARIO: Scenario = Object.freeze({
    id: "input-interval",
    title: "input.interval default resolution",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
