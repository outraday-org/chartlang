// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.psar()",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        const p = ta.psar();
        plot(p.sar);
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.psar` conformance scenario. Plots the SAR series of the default
 * Parabolic SAR over the bundled 10 000-bar `goldenBars.json` fixture.
 * The per-bar `direction` flip behaviour is pinned by the unit and
 * property tests (`psar.test.ts` / `psar.property.test.ts`); this
 * scenario asserts the conformance-suite contract only (clean run +
 * no alerts).
 *
 * @since 0.2
 * @stable
 * @example
 *     import { TA_PSAR_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_PSAR_SCENARIO;
 */
export const TA_PSAR_SCENARIO: Scenario = Object.freeze({
    id: "ta-psar",
    title: "ta.psar()",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
