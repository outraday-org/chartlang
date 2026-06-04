// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario } from "../runConformanceSuite";

import { BOLLINGER_BANDS_SCENARIO } from "./bollingerBands.scenario";
import { EMA_CROSS_SCENARIO } from "./emaCross.scenario";
import { RSI_DIVERGENCE_SCENARIO } from "./rsiDivergenceAlert.scenario";

export { BOLLINGER_BANDS_SCENARIO } from "./bollingerBands.scenario";
export { EMA_CROSS_SCENARIO } from "./emaCross.scenario";
export { RSI_DIVERGENCE_SCENARIO } from "./rsiDivergenceAlert.scenario";

/**
 * Frozen array of every Phase-1 conformance scenario. The
 * `runConformanceSuite` default `scenarios` value points here.
 * Phase 2 expands the array additively as new example scripts ship.
 *
 * @since 0.1
 * @experimental
 * @example
 *     import { PHASE_1_SCENARIOS } from "@invinite-org/chartlang-conformance";
 *     // PHASE_1_SCENARIOS.length === 3
 *     void PHASE_1_SCENARIOS;
 */
export const PHASE_1_SCENARIOS: ReadonlyArray<Scenario> = Object.freeze([
    EMA_CROSS_SCENARIO,
    BOLLINGER_BANDS_SCENARIO,
    RSI_DIVERGENCE_SCENARIO,
]);
