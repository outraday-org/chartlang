// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.supertrend({ length: 10, multiplier: 3 })",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        const s = ta.supertrend({ length: 10, multiplier: 3 });
        plot(s.line);
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.supertrend` conformance scenario. Plots the trailing-stop line
 * of `ta.supertrend({ length: 10, multiplier: 3 })` over the bundled
 * 10 000-bar `goldenBars.json` fixture. The per-bar `direction` flip
 * behaviour is pinned by the unit and property tests
 * (`supertrend.test.ts` / `supertrend.property.test.ts`); this
 * scenario asserts the conformance-suite contract only (clean run +
 * no alerts).
 *
 * @since 0.2
 * @experimental
 * @example
 *     import { TA_SUPERTREND_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_SUPERTREND_SCENARIO;
 */
export const TA_SUPERTREND_SCENARIO: Scenario = Object.freeze({
    id: "ta-supertrend",
    title: "ta.supertrend({ length: 10, multiplier: 3 })",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
