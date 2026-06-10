// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.williamsFractal()",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        const f = ta.williamsFractal();
        plot(f.up, { style: { kind: "marker", shape: "triangle-up", size: 6 } });
        plot(f.down, { style: { kind: "marker", shape: "triangle-down", size: 6 } });
    },
});
`;

// Note: `unsupported-plot-kind` is intentionally NOT asserted absent
// here (mirrors Task 21's `taVol.scenario.ts` convention for the
// `histogram` PlotKind). The shared `runConformanceSuite` test
// capability set carries only `line` + `horizontal-line`, so a
// marker emit would fire that diagnostic under the test adapter. The
// canvas2d reference adapter (which carries
// `capabilities.allPhase2Plots()` per Task 1) renders the marker
// end-to-end without the diagnostic. The cap-gated marker dispatch
// path is unit-covered in `packages/runtime/src/emit/plot.test.ts`
// (the marker-branch case) and the adapter-kit's
// `validateEmission.test.ts` (marker shape + size validation).
const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.williamsFractal` conformance scenario. Plots the up / down
 * fractal markers with the new `marker` PlotStyle (Task 1 + Task 26
 * extension) — the first port-task scenario to exercise the marker
 * plot kind end-to-end. Asserts no `malformed-emission` (proves
 * `validateEmission`'s marker branch accepts the payload) and no
 * `lookback-exceeded`.
 *
 * @since 0.2
 * @stable
 * @example
 *     import { TA_WILLIAMS_FRACTAL_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_WILLIAMS_FRACTAL_SCENARIO;
 */
export const TA_WILLIAMS_FRACTAL_SCENARIO: Scenario = Object.freeze({
    id: "ta-williamsFractal",
    title: "ta.williamsFractal() — marker plot",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
