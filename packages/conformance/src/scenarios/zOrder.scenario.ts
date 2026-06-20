// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

// Two line plots so the slot ordinals follow source order:
//   slot 0 → plot(bar.close)                    — no z (default, omitted)
//   slot 1 → plot(ta.sma(bar.close, 5), z: -1)  — render-order key z = -1
// `z` is a direct `plot()` call option (a presentation render-order key);
// the runtime threads it onto `PlotEmission.z`, omitting it when `0` /
// undefined so a no-`z` plot stays byte-identical to the pre-feature
// baseline. Drawing-`z` is NOT asserted here — there is no `drawing-field`
// assertion kind and `drawing-hash` hashes `DrawingState`, which does not
// carry the top-level `z`; drawing-`z` is covered by the Task 4 runtime
// unit test and the Task 5 adapter render test.
const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "Z order",
    apiVersion: 1,
    overlay: true,
    compute({ bar, ta, plot }) {
        plot(bar.close, { title: "Close" });
        plot(ta.sma(bar.close, 5), { title: "SMA behind", z: -1 });
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    // (a) The plain `plot(bar.close)` slot carries the close value verbatim —
    // `z` is presentation-only and never transforms a value series, so this
    // hash is byte-identical to a no-`z` plot of the same source. Minted from
    // the runner's expected-vs-actual message.
    {
        kind: "plot-hash",
        slotId: "<inline:z-order>.chart.ts:7:9#0",
        sha256: "857ce0c6e4c62ad60892d8ff745cb4dad146168446dba2c232113827def1a16f",
    },
    // (b) The `z: -1` line threads the render-order key onto the emission as a
    // top-level `z`; the no-`z` slot omits the field entirely (pinning the
    // omit-when-`0` byte-identity — the regression guard against a stray
    // `z: 0` leaking onto the wire). Bar 6 is warm for the SMA(5).
    { kind: "plot-field", slotIndex: 1, bar: 6, field: "z", expected: -1 },
    { kind: "plot-field", slotIndex: 0, bar: 6, field: "z", expected: undefined },
]);

/**
 * Conformance scenario pinning the plot `z` → `PlotEmission.z` render-order
 * contract: a `plot(value, { z: -1 })` emits `z: -1` (renders below the
 * default `z = 0` band), while a plot with no `z` omits the field entirely
 * (byte-identical to the pre-feature baseline). A `plot-hash` on the plain
 * `plot(bar.close)` slot proves `z` is presentation-only — the numeric
 * value series is never transformed by it.
 *
 * Drawing-`z` is intentionally NOT asserted here: the harness has no
 * `drawing-field` assertion kind and `drawing-hash` hashes `DrawingState`,
 * which does not carry the top-level `z`. Drawing-`z` emission is covered by
 * the runtime unit test (Task 4) and the adapter render test (Task 5).
 *
 * @since 1.4
 * @stable
 * @example
 *     import { Z_ORDER_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void Z_ORDER_SCENARIO;
 */
export const Z_ORDER_SCENARIO: Scenario = Object.freeze({
    id: "z-order",
    title: "Plot z → PlotEmission.z (negative z present, no-z omitted)",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    candleLimit: 8,
    assertions: ASSERTIONS,
});
