// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.envelope(close)",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        const e = ta.envelope(bar.close);
        plot(e.upper);
        plot(e.middle);
        plot(e.lower);
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.envelope` conformance scenario. Plots the upper / middle / lower
 * bands of a 20-period SMA envelope with the default 10% offset over
 * the bundled 10 000-bar `goldenBars.json` fixture.
 *
 * @since 0.2
 * @stable
 * @example
 *     import { TA_ENVELOPE_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_ENVELOPE_SCENARIO;
 */
export const TA_ENVELOPE_SCENARIO: Scenario = Object.freeze({
    id: "ta-envelope",
    title: "ta.envelope(close)",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
