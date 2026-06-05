// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.smi()",
    apiVersion: 1,
    overlay: false,
    compute({ ta, plot }) {
        const s = ta.smi();
        plot(s.smi);
        plot(s.signal);
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.smi` conformance scenario. Plots both `smi` and `signal` of
 * William Blau's Stochastic Momentum Index over the bundled 10 000-bar
 * `goldenBars.json` fixture with default opts (10, 3, 5, 3). Bounded
 * `[-100, 100]` (`yDomain: { kind: "fixed", min: -100, max: 100 }`
 * on `TA_REGISTRY_METADATA.smi`).
 *
 * @since 0.2
 * @experimental
 * @example
 *     import { TA_SMI_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_SMI_SCENARIO;
 */
export const TA_SMI_SCENARIO: Scenario = Object.freeze({
    id: "ta-smi",
    title: "ta.smi()",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
