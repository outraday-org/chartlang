// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario, ScenarioAssertion } from "../runConformanceSuite";

const ASSERTIONS: ReadonlyArray<ScenarioAssertion> = Object.freeze([
    {
        kind: "plot-hash",
        slotId: "examples/scripts/ema-cross.chart.ts:14:9#0",
        sha256: "d17bdb9ba1d5f6992e3ced6614ff71f902b62cc316a6e99247075e2caeb2c4e2",
    },
    {
        kind: "plot-hash",
        slotId: "examples/scripts/ema-cross.chart.ts:15:9#0",
        sha256: "33bdf8eb6fd9a55d5649c3b41eda05cf8bbc8672f02028a44b7101f67ba5a923",
    },
    { kind: "alert-count", count: 153 },
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
 * per PLAN.md §16.6).
 *
 * @since 0.1
 * @experimental
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
