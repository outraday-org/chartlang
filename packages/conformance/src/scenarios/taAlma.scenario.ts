// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.alma(close, 9, {offset:0.85, sigma:6})",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        plot(ta.alma(bar.close, 9, { offset: 0.85, sigma: 6 }));
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.alma` conformance scenario. Plots a 9-bar Arnaud Legoux MA with
 * the Pine-canonical Gaussian-centre / sigma defaults over the
 * bundled 10 000-bar `goldenBars.json` fixture. `opts.offset` here is
 * the Gaussian-centre position in `[0, 1]` — NOT the universal
 * bar-shift (which lives on `opts.barShift` for ALMA).
 *
 * @since 0.2
 * @stable
 * @example
 *     import { TA_ALMA_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_ALMA_SCENARIO;
 */
export const TA_ALMA_SCENARIO: Scenario = Object.freeze({
    id: "ta-alma",
    title: "ta.alma(close, 9, {offset:0.85, sigma:6})",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
