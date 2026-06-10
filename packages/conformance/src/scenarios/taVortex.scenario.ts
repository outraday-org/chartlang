// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.vortex(14)",
    apiVersion: 1,
    overlay: false,
    compute({ ta, plot }) {
        const v = ta.vortex(14);
        plot(v.plus);
        plot(v.minus);
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.vortex` conformance scenario. Plots the +VI and −VI lines of
 * Vortex(14) over the bundled 10 000-bar `goldenBars.json` fixture.
 *
 * @since 0.2
 * @stable
 * @example
 *     import { TA_VORTEX_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_VORTEX_SCENARIO;
 */
export const TA_VORTEX_SCENARIO: Scenario = Object.freeze({
    id: "ta-vortex",
    title: "ta.vortex(14)",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
