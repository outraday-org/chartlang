// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.mfi(14)",
    apiVersion: 1,
    overlay: false,
    compute({ ta, plot }) {
        plot(ta.mfi(14));
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.mfi` conformance scenario. Plots the Money Flow Index over the
 * bundled 10 000-bar `goldenBars.json` fixture (`length = 14`,
 * Pine-canonical). Bounded `[0, 100]`; rendered in its own pane.
 *
 * @since 0.2
 * @stable
 * @example
 *     import { TA_MFI_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_MFI_SCENARIO;
 */
export const TA_MFI_SCENARIO: Scenario = Object.freeze({
    id: "ta-mfi",
    title: "ta.mfi(14)",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
