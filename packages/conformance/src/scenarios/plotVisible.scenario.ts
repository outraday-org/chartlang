// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

// Three line plots so the slot ordinals follow source order:
//   slot 0 → plot(bar.close)                    — `visible` absent (the default)
//   slot 1 → plot(bar.hl2,  { visible: false }) — hidden by the authoring opt
//   slot 2 → plot(bar.hlc3, { visible: true })  — explicit `true`
// `visible` is a `plot()` authoring opt (Pine's `display = display.all |
// display.none`). The runtime threads it onto the appended-optional
// `PlotEmission.visible` wire field with the omit-when-default idiom: it
// carries `false` ONLY, dropping `true`/absent so a no-`visible` emission is
// byte-identical to the pre-feature wire (and to a host-override-hidden slot —
// `applyPlotOverride` also only ever writes `false`).
//
// The conformance harness drives the RUNTIME directly and never renders, so it
// pins the WIRE contract that every adapter honors — NOT a per-pixel render.
// `visible === false` is the normative cross-adapter contract (skip the mark +
// exclude from y-scale, never NaN-substitute); the per-adapter render/skip +
// autoscale proofs live in the adapter render tests. The persistent-legend
// "keep slot listed" behaviour is an adapter SHOULD, not a universal guarantee,
// so it is deliberately NOT asserted here.
const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "Plot visible",
    apiVersion: 1,
    overlay: true,
    compute({ bar, plot }) {
        plot(bar.close);
        plot(bar.hl2, { visible: false });
        plot(bar.hlc3, { visible: true });
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    // (a) The control `plot(bar.close)` slot carries the close value verbatim —
    // `visible` is presentation-only and is NOT part of the `{ bar, value }`
    // hash tuple, so the hidden / explicit-`true` siblings never perturb this
    // numeric series. Minted from the runner's expected-vs-actual message over
    // the first 5 golden bars.
    {
        kind: "plot-hash",
        slotId: "<inline:plot-visible>.chart.ts:7:9#0",
        sha256: "5fbfff9c0d90ba4641588fe0d681da09d826d791dc212dcd9a1752983f8946b2",
    },
    // (b) The hidden slot threads `visible: false` onto the wire — the
    // universal cross-adapter contract (suppress the mark + exclude from
    // y-scale). `bar.hl2` is finite from bar 0, so bar 0 is warm.
    { kind: "plot-field", slotIndex: 1, bar: 0, field: "visible", expected: false },
    // (c) Both the absent slot AND the explicit-`true` slot omit the field —
    // proving `visible` absent OR `true` ⇒ byte-identical to the no-field wire.
    { kind: "plot-field", slotIndex: 0, bar: 0, field: "visible", expected: undefined },
    { kind: "plot-field", slotIndex: 2, bar: 0, field: "visible", expected: undefined },
    // No diagnostic noise: the visibility field is never capability-gated.
    { kind: "diagnostic-code-absent", code: "unsupported-plot-kind" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * Conformance scenario pinning the plot `visible` → `PlotEmission.visible`
 * authoring contract: `plot(value, { visible: false })` emits `visible: false`
 * (the universal cross-adapter "suppress the mark + exclude from y-scale"
 * contract), while a plot with no `visible` AND a plot with `visible: true`
 * both omit the field entirely (byte-identical to the pre-feature wire). A
 * `plot-hash` on the control `plot(bar.close)` slot proves `visible` is
 * presentation-only — the numeric `{ bar, value }` series is never part of the
 * hash tuple.
 *
 * The harness drives the runtime directly (it never renders), so it asserts
 * the WIRE contract only. The per-adapter render/skip + autoscale-exclusion
 * proofs live in the adapter render tests; the persistent-legend "keep slot
 * listed" behaviour is an adapter SHOULD and is intentionally NOT asserted
 * here.
 *
 * @since 1.5
 * @stable
 * @example
 *     import { PLOT_VISIBLE_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void PLOT_VISIBLE_SCENARIO;
 */
export const PLOT_VISIBLE_SCENARIO: Scenario = Object.freeze({
    id: "plot-visible",
    title: "Plot visible → PlotEmission.visible (false present, absent/true omitted)",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    candleLimit: 5,
    assertions: ASSERTIONS,
});
