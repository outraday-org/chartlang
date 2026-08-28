// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite.js";

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "plot-hash",
        slotId: "examples/scripts/ema-cross.chart.ts:14:9#0",
        sha256: "7f9ede087b52f84d276c8de5cf21a26d8a16b82ed3571d04912be00bdf3826ee",
    },
    {
        kind: "plot-hash",
        slotId: "examples/scripts/ema-cross.chart.ts:15:9#0",
        sha256: "cfc0b84c6ed5586655bc43b3cc90277bb684247f1c616a1a65896c7e5639655f",
    },
    { kind: "alert-count", count: 156 },
    { kind: "alert-message-contains", pattern: "crossed", min: 100 },
    { kind: "diagnostic-code-absent", code: "lookback-exceeded" },
]);

/**
 * EMA(12)/EMA(26) crossover scenario. Pins the fast/slow EMA plot
 * series + the alert message + the crossover alert count against
 * the bundled 10 000-bar `goldenBars.json`. Mirrors
 * `examples/scripts/ema-cross.chart.ts`.
 *
 * Pinned values were recorded on the first deterministic run of the
 * scenario against the canvas2d adapter's declared capabilities;
 * re-pin via the runner's "expected vs actual" failure message when
 * the math intentionally changes (gate behind a `BREAKING:` changeset
 *).
 *
 * @since 0.1
 * @stable
 * @example
 *     import { EMA_CROSS_SCENARIO } from "@invinite-org/chartlang-conformance";
 *     // EMA_CROSS_SCENARIO.id === "ema-cross"
 *     void EMA_CROSS_SCENARIO;
 */
export const EMA_CROSS_SCENARIO: Scenario = Object.freeze({
    id: "ema-cross",
    title: "EMA(12)/EMA(26) crossover alerts",
    scriptPath: "examples/scripts/ema-cross.chart.ts",
    intervalCount: 1,
    assertions: ASSERTIONS,
});
