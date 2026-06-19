// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

// Three line plots so the slot ordinals follow source order:
//   slot 0 → plot(bar.close)                      — no offset (unshifted)
//   slot 1 → plot(ta.sma(bar.close, 5, +3))       — display-shifted right
//   slot 2 → plot(ta.sma(bar.close, 5, -3))       — display-shifted left
// The shifted lines carry `offset` on the `ta.*` opts (A-stay); the runtime
// threads it to `PlotEmission.xShift` as a presentation display shift while
// leaving the numeric value series unshifted.
const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "Plot offset xShift",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        plot(bar.close, { title: "Close" });
        plot(ta.sma(bar.close, 5, { offset: 3 }), { title: "SMA +3" });
        plot(ta.sma(bar.close, 5, { offset: -3 }), { title: "SMA -3" });
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    // (a) The unshifted `plot(bar.close)` slot carries the close value
    // verbatim — `offset` never transforms a value series, so this hash is
    // byte-identical to a no-offset plot of the same source. Minted from the
    // runner's expected-vs-actual message.
    {
        kind: "plot-hash",
        slotId: "<inline:plot-offset-xshift>.chart.ts:7:9#0",
        sha256: "857ce0c6e4c62ad60892d8ff745cb4dad146168446dba2c232113827def1a16f",
    },
    // (b) The +3 / -3 lines thread the signed offset onto the emission as a
    // presentation `xShift`; the no-offset slot omits the field entirely.
    // Bar 6 is warm for the SMA(5) (warms by bar 4).
    { kind: "plot-field", slotIndex: 1, bar: 6, field: "xShift", expected: 3 },
    { kind: "plot-field", slotIndex: 2, bar: 6, field: "xShift", expected: -3 },
    { kind: "plot-field", slotIndex: 0, bar: 6, field: "xShift", expected: undefined },
]);

/**
 * Conformance scenario pinning the bidirectional plot `offset` →
 * `PlotEmission.xShift` contract: a `+3` offset emits `xShift: 3`
 * (renders 3 bars right), a `−3` offset emits `xShift: -3` (renders 3 bars
 * left), and a no-offset plot omits the field. A `plot-hash` on the
 * unshifted `plot(bar.close)` slot proves `offset` is presentation-only —
 * the numeric value series is never transformed by it.
 *
 * @since 0.4
 * @stable
 * @example
 *     import { PLOT_OFFSET_XSHIFT_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void PLOT_OFFSET_XSHIFT_SCENARIO;
 */
export const PLOT_OFFSET_XSHIFT_SCENARIO: Scenario = Object.freeze({
    id: "plot-offset-xshift",
    title: "Plot offset → xShift (both directions, unshifted value)",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    candleLimit: 8,
    assertions: ASSERTIONS,
});
