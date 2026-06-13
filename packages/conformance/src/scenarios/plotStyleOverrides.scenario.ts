// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

// Two line plots so slot 0 and slot 1 are line-family kinds (lineWidth /
// lineStyle overrides apply). Slot ordinals follow source order:
//   slot 0 → plot(bar.close)
//   slot 1 → plot(bar.hl2)
const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "Plot style overrides",
    apiVersion: 1,
    overlay: true,
    compute({ bar, plot }) {
        plot(bar.close, { title: "Close" });
        plot(bar.hl2, { title: "HL2" });
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    // (a) Empty-override parity: slot 1 is recolored (a presentation-only
    // change), so its `{ bar, value }` series is byte-identical to the
    // no-override baseline. `plot-hash` deliberately ignores color, so this
    // pins that the override path never perturbs the numeric series.
    {
        kind: "plot-hash",
        slotId: "<inline:plot-style-overrides>.chart.ts:8:9#0",
        sha256: "232ef794472906157a3c0517eff10aa96f59d394fb8a381b657854665dd607c1",
    },
    // (b) Mount overrides: slot 0 hidden, slot 1 recolored + thicker.
    { kind: "plot-field", slotIndex: 0, bar: 0, field: "visible", expected: false },
    { kind: "plot-field", slotIndex: 1, bar: 0, field: "color", expected: "#ff0000" },
    { kind: "plot-field", slotIndex: 1, bar: 0, field: "lineWidth", expected: 3 },
    // (c) Live update clears the hide at bar 3; the next drains carry slot 0
    // with no `visible` field again (visible is only ever written as false).
    { kind: "plot-field", slotIndex: 0, bar: 4, field: "visible", expected: undefined },
]);

/**
 * Phase-8 conformance scenario pinning the plot-override channel end to
 * end: mount-time `visible: false` + `color` + `lineWidth` overrides keyed
 * by `manifest.plots` ordinal, a live `setPlotOverrides` flip that clears
 * the hide mid-stream, and empty-override numeric-series parity. Drives the
 * runtime directly (the conformance harness is host-agnostic); cross-host
 * byte-identical parity for overrides is pinned in
 * `packages/host-quickjs/src/integration.test.ts`.
 *
 * @since 0.8
 * @stable
 * @example
 *     import { PLOT_STYLE_OVERRIDES_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void PLOT_STYLE_OVERRIDES_SCENARIO;
 */
export const PLOT_STYLE_OVERRIDES_SCENARIO: Scenario = Object.freeze({
    id: "plot-style-overrides",
    title: "Plot style overrides",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    candleLimit: 5,
    plotOverrides: [
        { slotIndex: 0, override: { visible: false } },
        { slotIndex: 1, override: { color: "#ff0000", lineWidth: 3 } },
    ],
    overrideEvents: [{ atBar: 3, overrides: [{ slotIndex: 0, override: { visible: true } }] }],
    assertions: ASSERTIONS,
});
