// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.falling(close, 3)",
    apiVersion: 1,
    overlay: false,
    compute({ bar, ta, plot }) {
        // ta.falling returns Series<boolean>; surface it as a plottable
        // Series<number> via ta.barssince so the runtime still steps the
        // underlying boolean slot per bar.
        plot(ta.barssince(ta.falling(bar.close, 3)));
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.falling` conformance scenario. Flags every bar whose close fell on
 * each of the trailing 3 bars and surfaces the boolean via `ta.barssince`
 * so it plots in its own pane over the bundled 10 000-bar
 * `goldenBars.json` fixture. Exists so the §22.10 contract "one dedicated
 * scenario per `ta.*` primitive" holds for `ta.falling`.
 *
 * @since 1.8
 * @stable
 * @example
 *     import { TA_FALLING_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_FALLING_SCENARIO;
 */
export const TA_FALLING_SCENARIO: Scenario = Object.freeze({
    id: "ta-falling",
    title: "ta.falling(close, 3)",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
