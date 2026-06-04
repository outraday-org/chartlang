// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

export { runConformanceSuite } from "./runConformanceSuite";
export type {
    ConformanceFailure,
    ConformanceReport,
    RunConformanceSuiteOpts,
    Scenario,
    ScenarioAssertion,
} from "./runConformanceSuite";
export {
    BOLLINGER_BANDS_SCENARIO,
    EMA_CROSS_SCENARIO,
    PHASE_1_SCENARIOS,
    RSI_DIVERGENCE_SCENARIO,
} from "./scenarios";
export {
    GOLDEN_BARS_PATH,
    generateGoldenBars,
    serialiseGoldenBars,
    writeGoldenBars,
} from "./fixtures/generateGoldenBars";
export type { GoldenBars } from "./fixtures/generateGoldenBars";
