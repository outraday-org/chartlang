// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

/**
 * Inline source: Pine's empty-interval idiom
 * (`request.security(syminfo.tickerid, "", close)` = "the chart's own
 * timeframe"). A chart-symbol `request.security({ interval: "" }).close` must
 * resolve to the MAIN stream, so it plots byte-identically to a direct
 * `plot(bar.close)` control. The capability bag declares `multiTimeframe:
 * false` and lists no `""` interval, so the passthrough is the ONLY thing that
 * keeps this from degrading to the all-NaN secondary fallback.
 */
const SOURCE = `import { defineIndicator } from "@invinite-org/chartlang-core";

export default defineIndicator({
    name: "Empty interval passthrough",
    apiVersion: 1,
    overlay: true,
    compute({ bar, plot, request }) {
        const chartTf = request.security({ interval: "" });
        plot(chartTf.close);
        plot(bar.close);
    },
});
`;

// The empty-interval passthrough close series IS the main stream's close, so it
// is byte-identical to a direct `bar.close` plot over the same golden bars —
// both slots pin to ONE shared hash on purpose. If a future run splits them,
// the runtime empty-interval → main-stream passthrough (security.ts) regressed;
// fix the runtime, do NOT re-pin the two hashes apart. Re-pin via the runner's
// "expected vs actual" message only when the golden bars change.
const MAIN_CLOSE_HASH = "76a745e34ca1752a77abb91cbf5e7d852700171923337b5acb9263f172e49bc5";

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "plot-hash",
        slotId: "<inline:empty-interval-passthrough>.chart.ts:9:9#0",
        sha256: MAIN_CLOSE_HASH,
    },
    {
        kind: "plot-hash",
        slotId: "<inline:empty-interval-passthrough>.chart.ts:10:9#0",
        sha256: MAIN_CLOSE_HASH,
    },
    // The passthrough bypasses every secondary gate and needs no capability, so
    // NONE of these are pushed even under `multiTimeframe: false` + no `""`
    // interval in the bag.
    { kind: "diagnostic-code-absent", code: "multi-timeframe-not-supported" },
    { kind: "diagnostic-code-absent", code: "unsupported-interval" },
    { kind: "diagnostic-code-absent", code: "unknown-secondary-stream" },
]);

/**
 * Empty-interval chart-timeframe passthrough scenario. Proves Pine's empty
 * `request.security` tf returns the chart's own (main-stream) close — NOT
 * all-NaN — with no secondary feed and no adapter capability required.
 *
 * @since 1.6
 * @stable
 * @example
 *     import { EMPTY_INTERVAL_PASSTHROUGH_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     // EMPTY_INTERVAL_PASSTHROUGH_SCENARIO.id === "empty-interval-passthrough"
 *     void EMPTY_INTERVAL_PASSTHROUGH_SCENARIO;
 */
export const EMPTY_INTERVAL_PASSTHROUGH_SCENARIO: Scenario = Object.freeze({
    id: "empty-interval-passthrough",
    title: 'request.security({ interval: "" }) tracks the main close',
    inlineSource: SOURCE,
    intervalCount: 1,
    capabilitiesOverride: Object.freeze({
        multiTimeframe: false,
    }),
    assertions: ASSERTIONS,
});
