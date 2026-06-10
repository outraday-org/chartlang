// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.nz(ta.change(close), 0)",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        plot(ta.nz(ta.change(bar.close).current, 0));
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.nz` conformance scenario. Drives the stateless NaN-replacement
 * primitive inside an inline-source `defineIndicator` shell — wraps a
 * `ta.change(bar.close).current` (which is NaN at bar 0) in
 * `ta.nz(..., 0)` so the plot stream is fully finite from bar 0
 * onwards.
 *
 * @since 0.2
 * @stable
 * @example
 *     import { TA_NZ_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_NZ_SCENARIO;
 */
export const TA_NZ_SCENARIO: Scenario = Object.freeze({
    id: "ta-nz",
    title: "ta.nz(ta.change(close).current, 0)",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
