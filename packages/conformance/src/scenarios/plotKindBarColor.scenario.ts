// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";
import { plotKindSource } from "./plotKindFixtures";

const INLINE_SOURCE = plotKindSource(
    "PlotKind bar color",
    'plot(bar.close, { style: { kind: "bar-color", color: "#a855f7" } });',
);

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "plot-hash",
        sha256: "5fbfff9c0d90ba4641588fe0d681da09d826d791dc212dcd9a1752983f8946b2",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-plot-kind" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * Phase 5 conformance scenario for plot kind bar color scenario.
 *
 * @since 0.5
 * @stable
 * @example
 *     import { PLOT_KIND_BAR_COLOR_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void PLOT_KIND_BAR_COLOR_SCENARIO;
 */
export const PLOT_KIND_BAR_COLOR_SCENARIO: Scenario = Object.freeze({
    id: "plot-kind-bar-color",
    title: "PlotKind bar color",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    candleLimit: 5,
    assertions: ASSERTIONS,
});
