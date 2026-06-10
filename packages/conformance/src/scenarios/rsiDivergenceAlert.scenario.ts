// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "plot-hash",
        slotId: "examples/scripts/rsi-divergence-alert.chart.ts:12:9#0",
        sha256: "ee00bcef1d27499600ae14609af9cb753c8dbb7da1636f5f69cb96bd6a58e501",
    },
    { kind: "alert-count", count: 433 },
    { kind: "alert-message-contains", pattern: "RSI dropped below 70", min: 1 },
    { kind: "alert-message-contains", pattern: "RSI rose above 30", min: 1 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
    { kind: "diagnostic-code-absent", code: "malformed-emission" },
]);

/**
 * RSI-divergence scenario. Pins the RSI plot series and the
 * pinned overbought/oversold alert counts. Verifies the runtime
 * does not raise `malformed-emission` or `lookback-exceeded` over
 * the 10 000-bar fixture. Mirrors
 * `examples/scripts/rsi-divergence-alert.chart.ts`.
 *
 * The script declares `overlay: false`; the runtime's
 * `paneResolver` only emits `unsupported-pane` when a `plot(...,
 * { pane: ... })` call requests a non-overlay pane explicitly, and
 * this script does not — so we do not assert the diagnostic's
 * presence. Phase 4 reshapes `defineIndicator({ overlay })` to flow
 * into per-emission `pane` resolution; this scenario is the
 * forward-compat seam.
 *
 * @since 0.1
 * @stable
 * @example
 *     import { RSI_DIVERGENCE_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     // RSI_DIVERGENCE_SCENARIO.id === "rsi-divergence-alert"
 *     void RSI_DIVERGENCE_SCENARIO;
 */
export const RSI_DIVERGENCE_SCENARIO: Scenario = Object.freeze({
    id: "rsi-divergence-alert",
    title: "RSI(14) overbought/oversold alerts",
    scriptPath: "examples/scripts/rsi-divergence-alert.chart.ts",
    intervalCount: 1,
    assertions: ASSERTIONS,
});
