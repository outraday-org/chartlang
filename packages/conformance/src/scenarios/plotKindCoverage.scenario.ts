// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "PlotKind coverage",
    apiVersion: 1,
    overlay: true,
    compute({ bar, plot, hline }) {
        plot(bar.close);
        hline(50);
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "unsupported-plot-kind" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * PlotKind coverage scenario. Exercises the Phase-2
 * `Scenario.inlineSource` extension and the wider
 * `CANVAS2D_CAPABILITIES.plots` surface (9 kinds, post-Task-1) by
 * running a thin inline script through the full
 * compile → runtime → adapter → renderer pipeline.
 *
 * The script itself emits only `line` (from `plot`) and
 * `horizontal-line` (from `hline`) — deliberately. The Phase-2 plot
 * kinds (`histogram` / `bars` / `area` / `filled-band` / `label` /
 * `marker` etc.) have since shipped and each carries its own
 * dedicated `plotKind*.scenario.ts` pair. The point of THIS scenario
 * is to lock in the inline-source path + prove the wider capability
 * surface forwards correctly (no `unsupported-plot-kind` diagnostic
 * for the Phase-1 emissions; no `malformed-emission` from the
 * validator's extended switch).
 *
 * @since 0.2
 * @stable
 * @example
 *     import { PLOT_KIND_COVERAGE_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     // PLOT_KIND_COVERAGE_SCENARIO.inlineSource !== undefined
 *     void PLOT_KIND_COVERAGE_SCENARIO;
 */
export const PLOT_KIND_COVERAGE_SCENARIO: Scenario = Object.freeze({
    id: "plot-kind-coverage",
    title: "PlotKind coverage — inline-source scenario exercising Phase-2 cap surface",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
