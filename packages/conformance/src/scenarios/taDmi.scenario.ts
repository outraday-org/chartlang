// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.dmi(14)",
    apiVersion: 1,
    overlay: false,
    compute({ ta, plot }) {
        const d = ta.dmi(14);
        plot(d.plusDi);
        plot(d.minusDi);
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.dmi` conformance scenario. Plots Wilder's `+DI` / `−DI` pair
 * over the bundled 10 000-bar `goldenBars.json` fixture.
 *
 * @since 0.2
 * @experimental
 * @example
 *     import { TA_DMI_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_DMI_SCENARIO;
 */
export const TA_DMI_SCENARIO: Scenario = Object.freeze({
    id: "ta-dmi",
    title: "ta.dmi(14)",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
