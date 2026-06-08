// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "barstate confirmed",
    apiVersion: 1,
    compute({ alert, barstate, plot }) {
        if (barstate.isconfirmed) alert("confirmed");
        plot(barstate.isconfirmed ? 1 : 0);
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "plot-hash",
        sha256: "a18e939565de9c0396de29244b5b3feded28cb8777e04e18f53899298e339df8",
    },
    { kind: "alert-count", count: 1 },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `barstate.isconfirmed` conformance scenario. One initial close emits an
 * alert; subsequent tick events do not.
 *
 * @since 0.4
 * @experimental
 * @example
 *     import { BARSTATE_CONFIRMED_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void BARSTATE_CONFIRMED_SCENARIO;
 */
export const BARSTATE_CONFIRMED_SCENARIO: Scenario = Object.freeze({
    id: "barstate-confirmed",
    title: "barstate.isconfirmed gates alerts",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    candleLimit: 11,
    eventStream: Object.freeze({ kind: "initial-close-then-ticks" }),
    assertions: ASSERTIONS,
});
