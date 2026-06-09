// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { PlotKind } from "@invinite-org/chartlang-adapter-kit";
import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";
import { plotKindSource } from "./plotKindFixtures";

const INLINE_SOURCE = plotKindSource(
    "PlotKind bar override gated",
    'plot(bar.close, { style: { kind: "bar-override", color: "#f59e0b" } });',
);

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "plot-hash",
        sha256: "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945",
    },
    { kind: "diagnostic-code-present", code: "unsupported-plot-kind" },
]);
const LINE_ONLY_PLOTS: ReadonlySet<PlotKind> = new Set(["line"]);

/**
 * Phase 5 conformance scenario for plot kind bar override gated scenario.
 *
 * @since 0.5
 * @experimental
 * @example
 *     import { PLOT_KIND_BAR_OVERRIDE_GATED_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void PLOT_KIND_BAR_OVERRIDE_GATED_SCENARIO;
 */
export const PLOT_KIND_BAR_OVERRIDE_GATED_SCENARIO: Scenario = Object.freeze({
    id: "plot-kind-bar-override-gated",
    title: "PlotKind bar override gated",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    candleLimit: 5,
    capabilitiesOverride: { plots: LINE_ONLY_PLOTS },
    assertions: ASSERTIONS,
});
