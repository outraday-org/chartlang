// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { PlotKind } from "@invinite-org/chartlang-adapter-kit";
import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

// The `bg-color` plot kind must be in the adapter's `plots` capability for the
// dynamic background to emit (otherwise it folds with `unsupported-plot-kind`).
// Pin a minimal override so the scenario is self-contained against any adapter.
const BG_COLOR_PLOTS: ReadonlySet<PlotKind> = new Set(["line", "bg-color"]);

// A `bgcolor(...)` whose per-bar color flips on the bar's own condition: the
// Deliverable-2 dynamic-color channel. Unlike the static bg-color scenarios
// (which `plot(bar.close, { style })` a finite value series), `bgcolor` lowers
// to `value: null` on every bar AND routes the per-bar color through
// `PlotEmission.colorValue`. The numeric `plot-hash` over `{ bar, value }`
// therefore covers an all-null series (its own minted hash); the per-bar color
// is pinned separately by a `plot-field: colorValue` assertion — proving the
// dynamic channel rides the wire WITHOUT entering the numeric hash.
const INLINE_SOURCE = `import { defineIndicator, bgcolor } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "PlotKind bg color dynamic",
    apiVersion: 1,
    overlay: true,
    compute({ bar, bgcolor }) {
        bgcolor(bar.close > bar.open ? "#16a34a" : "#dc2626");
    },
});
`;

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    // Per-bar dynamic color (a plot-FIELD assertion, NOT a hash change): the
    // bar-0 condition resolves to one of the two colors. Pinned from the
    // harness's "expected vs actual" failure message.
    {
        kind: "plot-field",
        slotIndex: 0,
        bar: 0,
        field: "colorValue",
        expected: "#16a34a",
    },
    // The numeric value series (all-null for `bgcolor`) — its own minted hash.
    {
        kind: "plot-hash",
        sha256: "b2a28bbad57582b1a25b56b31b08632fac7a9bc4c1ac8546afc12a0030fbf918",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-plot-kind" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * Conformance scenario for the per-bar dynamic-color channel
 * (`PlotEmission.colorValue`). A single `bgcolor(bar.close > bar.open ? … : …)`
 * recolors every bar by that bar's condition; the scenario pins the per-bar
 * color via a `plot-field: colorValue` assertion and the all-null numeric
 * value series via a reused `plot-hash` — the color is NOT in the hash tuple.
 *
 * @since 1.5
 * @stable
 * @example
 *     import { PLOT_KIND_BG_COLOR_DYNAMIC_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void PLOT_KIND_BG_COLOR_DYNAMIC_SCENARIO;
 */
export const PLOT_KIND_BG_COLOR_DYNAMIC_SCENARIO: Scenario = Object.freeze({
    id: "plot-kind-bg-color-dynamic",
    title: "PlotKind bg color dynamic",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    candleLimit: 5,
    capabilitiesOverride: { plots: BG_COLOR_PLOTS },
    assertions: ASSERTIONS,
});
