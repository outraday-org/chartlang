// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";
import { plotKindSource } from "./plotKindFixtures";

const INLINE_SOURCE = plotKindSource(
    "PlotKind arrow",
    'plot(bar.close, { style: { kind: "arrow", direction: "up", size: 10 } });',
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
 * Phase 5 conformance scenario for plot kind arrow scenario.
 *
 * @since 0.5
 * @experimental
 * @example
 *     import { PLOT_KIND_ARROW_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void PLOT_KIND_ARROW_SCENARIO;
 */
export const PLOT_KIND_ARROW_SCENARIO: Scenario = Object.freeze({
    id: "plot-kind-arrow",
    title: "PlotKind arrow",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    candleLimit: 5,
    assertions: ASSERTIONS,
});
