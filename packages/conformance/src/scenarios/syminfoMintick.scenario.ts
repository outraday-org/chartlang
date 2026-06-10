// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "syminfo mintick",
    apiVersion: 1,
    compute({ bar, plot, syminfo }) {
        const snapped = Math.round(bar.close / syminfo.mintick) * syminfo.mintick;
        plot(snapped);
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "plot-hash",
        sha256: "5d0c33a5a380d51df8f3186f5504157234e3b6380a5191d59df19dadb55084ed",
    },
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `syminfo.mintick` conformance scenario. Snaps close prices to the adapter's
 * tick size and pins the plot sequence.
 *
 * @since 0.4
 * @stable
 * @example
 *     import { SYMINFO_MINTICK_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void SYMINFO_MINTICK_SCENARIO;
 */
export const SYMINFO_MINTICK_SCENARIO: Scenario = Object.freeze({
    id: "syminfo-mintick",
    title: "syminfo.mintick snapping",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
