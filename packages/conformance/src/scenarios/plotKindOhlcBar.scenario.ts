// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { PlotKind } from "@invinite-org/chartlang-adapter-kit";
import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const INLINE_SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";
export default defineIndicator({
    name: "PlotKind ohlc bar",
    apiVersion: 1,
    overlay: true,
    compute({ bar, plotbar }) {
        plotbar(bar.open, bar.high, bar.low, bar.close, { color: "#f59e0b" });
    },
});
`;

// Only canvas2d declares `ohlc-bar` natively (the frozen `PHASE_5_PLOT_KINDS`
// the other five adapters use excludes it). Force the capability present so
// the value-carrying happy path — and its single pinned `plot-hash` — is
// deterministic on EVERY registered adapter, the same lever the `*Gated`
// scenarios use to NARROW `plots`.
const OHLC_BAR_PLOTS: ReadonlySet<PlotKind> = new Set(["ohlc-bar"]);

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "plot-hash",
        sha256: "5fbfff9c0d90ba4641588fe0d681da09d826d791dc212dcd9a1752983f8946b2",
    },
    { kind: "diagnostic-code-absent", code: "unsupported-plot-kind" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * Conformance scenario for the value-carrying `plotbar` OHLC series. Plots a
 * derived `ohlc-bar` style from `bar.*` end-to-end (compile → runtime emit →
 * capability gate); the `plot-hash` covers the single-channel
 * `value = close ?? null` the emit carries (byte-identical to a plain
 * `bar.close` plot over the shared golden bars). The `ohlc-bar` capability is
 * injected via `capabilitiesOverride` so the emit is not gated on the five
 * adapters that do not declare it.
 *
 * @since 1.8
 * @stable
 * @example
 *     import { PLOT_KIND_OHLC_BAR_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     void PLOT_KIND_OHLC_BAR_SCENARIO;
 */
export const PLOT_KIND_OHLC_BAR_SCENARIO: Scenario = Object.freeze({
    id: "plot-kind-ohlc-bar",
    title: "PlotKind ohlc bar",
    inlineSource: INLINE_SOURCE,
    intervalCount: 1,
    candleLimit: 5,
    capabilitiesOverride: { plots: OHLC_BAR_PLOTS },
    assertions: ASSERTIONS,
});
