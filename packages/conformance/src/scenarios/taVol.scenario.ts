// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "ta.vol()",
    apiVersion: 1,
    overlay: true,
    compute({ ta, plot }) {
        plot(ta.vol(), { style: { kind: "histogram", baseline: 0 } });
    },
});
`;

// Note: `unsupported-plot-kind` is intentionally NOT asserted absent
// here — the shared `runConformanceSuite` test capability set carries
// only `line` + `horizontal-line`, so the histogram emit fires that
// diagnostic under the test adapter. The canvas2d reference adapter
// (which carries `capabilities.allPhase2Plots()` per Task 1) renders
// the histogram end-to-end without the diagnostic. This scenario's
// purpose is to wire the histogram emit path through the runtime + the
// adapter dispatch; the cap-gated path is unit-covered in
// `packages/runtime/src/emit/plot.test.ts` and
// `examples/canvas2d-adapter/src/createCanvas2dAdapter.test.ts`.
const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    { kind: "alert-count", count: 0 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * `ta.vol` conformance scenario. Plots the per-bar volume as a
 * histogram over the bundled 10 000-bar `goldenBars.json` fixture.
 * First Phase-2 scenario to exercise the `histogram` PlotKind
 * end-to-end (Task-1 renderer wired by Task-21's runtime + canvas2d
 * emit-path extension).
 *
 * @since 0.2
 * @stable
 * @example
 *     import { TA_VOL_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void TA_VOL_SCENARIO;
 */
export const TA_VOL_SCENARIO: Scenario = Object.freeze({
    id: "ta-vol",
    title: "ta.vol() — histogram",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    assertions: ASSERTIONS,
});
