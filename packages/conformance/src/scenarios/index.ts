// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario } from "../runConformanceSuite";

import { BOLLINGER_BANDS_SCENARIO } from "./bollingerBands.scenario";
import { EMA_CROSS_SCENARIO } from "./emaCross.scenario";
import { PLOT_KIND_COVERAGE_SCENARIO } from "./plotKindCoverage.scenario";
import { RSI_DIVERGENCE_SCENARIO } from "./rsiDivergenceAlert.scenario";
import { TA_ADL_SCENARIO } from "./taAdl.scenario";
import { TA_ADR_SCENARIO } from "./taAdr.scenario";
import { TA_ADX_SCENARIO } from "./taAdx.scenario";
import { TA_ALMA_SCENARIO } from "./taAlma.scenario";
import { TA_ANCHORED_VWAP_SCENARIO } from "./taAnchoredVwap.scenario";
import { TA_AO_SCENARIO } from "./taAo.scenario";
import { TA_AROON_SCENARIO } from "./taAroon.scenario";
import { TA_AROON_OSC_SCENARIO } from "./taAroonOsc.scenario";
import { TA_BARSSINCE_SCENARIO } from "./taBarssince.scenario";
import { TA_BB_PERCENT_B_SCENARIO } from "./taBbPercentB.scenario";
import { TA_BBW_SCENARIO } from "./taBbw.scenario";
import { TA_BOP_SCENARIO } from "./taBop.scenario";
import { TA_CCI_SCENARIO } from "./taCci.scenario";
import { TA_CHAIKIN_OSC_SCENARIO } from "./taChaikinOsc.scenario";
import { TA_CHANDE_KROLL_STOP_SCENARIO } from "./taChandeKrollStop.scenario";
import { TA_CHANDELIER_SCENARIO } from "./taChandelier.scenario";
import { TA_CHANGE_SCENARIO } from "./taChange.scenario";
import { TA_CHOP_SCENARIO } from "./taChop.scenario";
import { TA_CMF_SCENARIO } from "./taCmf.scenario";
import { TA_CMO_SCENARIO } from "./taCmo.scenario";
import { TA_CONNORS_RSI_SCENARIO } from "./taConnorsRsi.scenario";
import { TA_COPPOCK_SCENARIO } from "./taCoppock.scenario";
import { TA_DEMA_SCENARIO } from "./taDema.scenario";
import { TA_DMI_SCENARIO } from "./taDmi.scenario";
import { TA_DONCHIAN_SCENARIO } from "./taDonchian.scenario";
import { TA_DPO_SCENARIO } from "./taDpo.scenario";
import { TA_ENVELOPE_SCENARIO } from "./taEnvelope.scenario";
import { TA_EOM_SCENARIO } from "./taEom.scenario";
import { TA_FISHER_SCENARIO } from "./taFisher.scenario";
import { TA_HIGHEST_SCENARIO } from "./taHighest.scenario";
import { TA_HISTORICAL_VOLATILITY_SCENARIO } from "./taHistoricalVolatility.scenario";
import { TA_HMA_SCENARIO } from "./taHma.scenario";
import { TA_ICHIMOKU_SCENARIO } from "./taIchimoku.scenario";
import { TA_KAMA_SCENARIO } from "./taKama.scenario";
import { TA_KELTNER_SCENARIO } from "./taKeltner.scenario";
import { TA_KLINGER_SCENARIO } from "./taKlinger.scenario";
import { TA_KST_SCENARIO } from "./taKst.scenario";
import { TA_LOWEST_SCENARIO } from "./taLowest.scenario";
import { TA_LSMA_SCENARIO } from "./taLsma.scenario";
import { TA_MA_RIBBON_SCENARIO } from "./taMaRibbon.scenario";
import { TA_MASS_INDEX_SCENARIO } from "./taMassIndex.scenario";
import { TA_MCGINLEY_SCENARIO } from "./taMcginley.scenario";
import { TA_MEDIAN_SCENARIO } from "./taMedian.scenario";
import { TA_MFI_SCENARIO } from "./taMfi.scenario";
import { TA_MOMENTUM_SCENARIO } from "./taMomentum.scenario";
import { TA_NET_VOLUME_SCENARIO } from "./taNetVolume.scenario";
import { TA_NVI_SCENARIO } from "./taNvi.scenario";
import { TA_NZ_SCENARIO } from "./taNz.scenario";
import { TA_OBV_SCENARIO } from "./taObv.scenario";
import { TA_PIVOTS_HIGH_LOW_SCENARIO } from "./taPivotsHighLow.scenario";
import { TA_PIVOTS_STANDARD_SCENARIO } from "./taPivotsStandard.scenario";
import { TA_PMO_SCENARIO } from "./taPmo.scenario";
import { TA_PPO_SCENARIO } from "./taPpo.scenario";
import { TA_PSAR_SCENARIO } from "./taPsar.scenario";
import { TA_PVI_SCENARIO } from "./taPvi.scenario";
import { TA_PVO_SCENARIO } from "./taPvo.scenario";
import { TA_PVT_SCENARIO } from "./taPvt.scenario";
import { TA_ROC_SCENARIO } from "./taRoc.scenario";
import { TA_RVGI_SCENARIO } from "./taRvgi.scenario";
import { TA_RVI_SCENARIO } from "./taRvi.scenario";
import { TA_SMI_SCENARIO } from "./taSmi.scenario";
import { TA_SMMA_SCENARIO } from "./taSmma.scenario";
import { TA_STOCH_SCENARIO } from "./taStoch.scenario";
import { TA_STOCH_RSI_SCENARIO } from "./taStochRsi.scenario";
import { TA_SUPERTREND_SCENARIO } from "./taSupertrend.scenario";
import { TA_TEMA_SCENARIO } from "./taTema.scenario";
import { TA_TREND_STRENGTH_INDEX_SCENARIO } from "./taTrendStrengthIndex.scenario";
import { TA_TRIX_SCENARIO } from "./taTrix.scenario";
import { TA_TSI_SCENARIO } from "./taTsi.scenario";
import { TA_ULCER_INDEX_SCENARIO } from "./taUlcerIndex.scenario";
import { TA_ULTIMATE_OSC_SCENARIO } from "./taUltimateOsc.scenario";
import { TA_VALUEWHEN_SCENARIO } from "./taValuewhen.scenario";
import { TA_VOL_SCENARIO } from "./taVol.scenario";
import { TA_VOLATILITY_STOP_SCENARIO } from "./taVolatilityStop.scenario";
import { TA_VORTEX_SCENARIO } from "./taVortex.scenario";
import { TA_VWAP_SCENARIO } from "./taVwap.scenario";
import { TA_VWMA_SCENARIO } from "./taVwma.scenario";
import { TA_WILLIAMS_FRACTAL_SCENARIO } from "./taWilliamsFractal.scenario";
import { TA_WILLIAMS_R_SCENARIO } from "./taWilliamsR.scenario";
import { TA_WMA_SCENARIO } from "./taWma.scenario";
import { TA_ZIG_ZAG_SCENARIO } from "./taZigZag.scenario";

export { BOLLINGER_BANDS_SCENARIO } from "./bollingerBands.scenario";
export { EMA_CROSS_SCENARIO } from "./emaCross.scenario";
export { PLOT_KIND_COVERAGE_SCENARIO } from "./plotKindCoverage.scenario";
export { RSI_DIVERGENCE_SCENARIO } from "./rsiDivergenceAlert.scenario";
export { TA_ADL_SCENARIO } from "./taAdl.scenario";
export { TA_ADR_SCENARIO } from "./taAdr.scenario";
export { TA_ADX_SCENARIO } from "./taAdx.scenario";
export { TA_ALMA_SCENARIO } from "./taAlma.scenario";
export { TA_ANCHORED_VWAP_SCENARIO } from "./taAnchoredVwap.scenario";
export { TA_AO_SCENARIO } from "./taAo.scenario";
export { TA_AROON_SCENARIO } from "./taAroon.scenario";
export { TA_AROON_OSC_SCENARIO } from "./taAroonOsc.scenario";
export { TA_BARSSINCE_SCENARIO } from "./taBarssince.scenario";
export { TA_BB_PERCENT_B_SCENARIO } from "./taBbPercentB.scenario";
export { TA_BBW_SCENARIO } from "./taBbw.scenario";
export { TA_BOP_SCENARIO } from "./taBop.scenario";
export { TA_CCI_SCENARIO } from "./taCci.scenario";
export { TA_CHAIKIN_OSC_SCENARIO } from "./taChaikinOsc.scenario";
export { TA_CHANDE_KROLL_STOP_SCENARIO } from "./taChandeKrollStop.scenario";
export { TA_CHANDELIER_SCENARIO } from "./taChandelier.scenario";
export { TA_CHANGE_SCENARIO } from "./taChange.scenario";
export { TA_CHOP_SCENARIO } from "./taChop.scenario";
export { TA_CMF_SCENARIO } from "./taCmf.scenario";
export { TA_CMO_SCENARIO } from "./taCmo.scenario";
export { TA_CONNORS_RSI_SCENARIO } from "./taConnorsRsi.scenario";
export { TA_COPPOCK_SCENARIO } from "./taCoppock.scenario";
export { TA_DEMA_SCENARIO } from "./taDema.scenario";
export { TA_DMI_SCENARIO } from "./taDmi.scenario";
export { TA_DONCHIAN_SCENARIO } from "./taDonchian.scenario";
export { TA_DPO_SCENARIO } from "./taDpo.scenario";
export { TA_ENVELOPE_SCENARIO } from "./taEnvelope.scenario";
export { TA_EOM_SCENARIO } from "./taEom.scenario";
export { TA_FISHER_SCENARIO } from "./taFisher.scenario";
export { TA_HIGHEST_SCENARIO } from "./taHighest.scenario";
export { TA_HISTORICAL_VOLATILITY_SCENARIO } from "./taHistoricalVolatility.scenario";
export { TA_HMA_SCENARIO } from "./taHma.scenario";
export { TA_ICHIMOKU_SCENARIO } from "./taIchimoku.scenario";
export { TA_KAMA_SCENARIO } from "./taKama.scenario";
export { TA_KELTNER_SCENARIO } from "./taKeltner.scenario";
export { TA_KLINGER_SCENARIO } from "./taKlinger.scenario";
export { TA_KST_SCENARIO } from "./taKst.scenario";
export { TA_LOWEST_SCENARIO } from "./taLowest.scenario";
export { TA_LSMA_SCENARIO } from "./taLsma.scenario";
export { TA_MA_RIBBON_SCENARIO } from "./taMaRibbon.scenario";
export { TA_MASS_INDEX_SCENARIO } from "./taMassIndex.scenario";
export { TA_MCGINLEY_SCENARIO } from "./taMcginley.scenario";
export { TA_MEDIAN_SCENARIO } from "./taMedian.scenario";
export { TA_MFI_SCENARIO } from "./taMfi.scenario";
export { TA_MOMENTUM_SCENARIO } from "./taMomentum.scenario";
export { TA_NET_VOLUME_SCENARIO } from "./taNetVolume.scenario";
export { TA_NVI_SCENARIO } from "./taNvi.scenario";
export { TA_NZ_SCENARIO } from "./taNz.scenario";
export { TA_OBV_SCENARIO } from "./taObv.scenario";
export { TA_PIVOTS_HIGH_LOW_SCENARIO } from "./taPivotsHighLow.scenario";
export { TA_PIVOTS_STANDARD_SCENARIO } from "./taPivotsStandard.scenario";
export { TA_PMO_SCENARIO } from "./taPmo.scenario";
export { TA_PPO_SCENARIO } from "./taPpo.scenario";
export { TA_PSAR_SCENARIO } from "./taPsar.scenario";
export { TA_PVI_SCENARIO } from "./taPvi.scenario";
export { TA_PVO_SCENARIO } from "./taPvo.scenario";
export { TA_PVT_SCENARIO } from "./taPvt.scenario";
export { TA_ROC_SCENARIO } from "./taRoc.scenario";
export { TA_RVGI_SCENARIO } from "./taRvgi.scenario";
export { TA_RVI_SCENARIO } from "./taRvi.scenario";
export { TA_SMI_SCENARIO } from "./taSmi.scenario";
export { TA_SMMA_SCENARIO } from "./taSmma.scenario";
export { TA_STOCH_SCENARIO } from "./taStoch.scenario";
export { TA_STOCH_RSI_SCENARIO } from "./taStochRsi.scenario";
export { TA_SUPERTREND_SCENARIO } from "./taSupertrend.scenario";
export { TA_TEMA_SCENARIO } from "./taTema.scenario";
export { TA_TREND_STRENGTH_INDEX_SCENARIO } from "./taTrendStrengthIndex.scenario";
export { TA_TRIX_SCENARIO } from "./taTrix.scenario";
export { TA_TSI_SCENARIO } from "./taTsi.scenario";
export { TA_VALUEWHEN_SCENARIO } from "./taValuewhen.scenario";
export { TA_ULCER_INDEX_SCENARIO } from "./taUlcerIndex.scenario";
export { TA_ULTIMATE_OSC_SCENARIO } from "./taUltimateOsc.scenario";
export { TA_VOL_SCENARIO } from "./taVol.scenario";
export { TA_VOLATILITY_STOP_SCENARIO } from "./taVolatilityStop.scenario";
export { TA_VORTEX_SCENARIO } from "./taVortex.scenario";
export { TA_VWAP_SCENARIO } from "./taVwap.scenario";
export { TA_VWMA_SCENARIO } from "./taVwma.scenario";
export { TA_WILLIAMS_FRACTAL_SCENARIO } from "./taWilliamsFractal.scenario";
export { TA_WILLIAMS_R_SCENARIO } from "./taWilliamsR.scenario";
export { TA_WMA_SCENARIO } from "./taWma.scenario";
export { TA_ZIG_ZAG_SCENARIO } from "./taZigZag.scenario";
export { PHASE_2_INDICATORS, PHASE_5_DEFERRED } from "./phase2Inventory";

/**
 * Frozen array of every bundled conformance scenario (Phase-1
 * walking-skeleton + Phase-2 indicator ports). The
 * `runConformanceSuite` default `scenarios` value points here.
 * Future phases expand the array additively as new scenarios ship.
 *
 * @since 0.2.1
 * @experimental
 * @example
 *     import { ALL_SCENARIOS } from "@invinite-org/chartlang-conformance";
 *     // ALL_SCENARIOS.length >= 3
 *     void ALL_SCENARIOS;
 */
export const ALL_SCENARIOS: ReadonlyArray<Scenario> = Object.freeze([
    EMA_CROSS_SCENARIO,
    BOLLINGER_BANDS_SCENARIO,
    RSI_DIVERGENCE_SCENARIO,
    PLOT_KIND_COVERAGE_SCENARIO,
    TA_NZ_SCENARIO,
    TA_HIGHEST_SCENARIO,
    TA_LOWEST_SCENARIO,
    TA_CHANGE_SCENARIO,
    TA_VALUEWHEN_SCENARIO,
    TA_BARSSINCE_SCENARIO,
    TA_AROON_SCENARIO,
    TA_AROON_OSC_SCENARIO,
    TA_ADX_SCENARIO,
    TA_DMI_SCENARIO,
    TA_TRIX_SCENARIO,
    TA_AO_SCENARIO,
    TA_CMO_SCENARIO,
    TA_MOMENTUM_SCENARIO,
    TA_ROC_SCENARIO,
    TA_PMO_SCENARIO,
    TA_SMI_SCENARIO,
    TA_TSI_SCENARIO,
    TA_WMA_SCENARIO,
    TA_VWMA_SCENARIO,
    TA_HMA_SCENARIO,
    TA_SMMA_SCENARIO,
    TA_DEMA_SCENARIO,
    TA_TEMA_SCENARIO,
    TA_KAMA_SCENARIO,
    TA_ALMA_SCENARIO,
    TA_LSMA_SCENARIO,
    TA_MCGINLEY_SCENARIO,
    TA_MA_RIBBON_SCENARIO,
    TA_CCI_SCENARIO,
    TA_STOCH_SCENARIO,
    TA_WILLIAMS_R_SCENARIO,
    TA_STOCH_RSI_SCENARIO,
    TA_ULTIMATE_OSC_SCENARIO,
    TA_COPPOCK_SCENARIO,
    TA_PPO_SCENARIO,
    TA_DPO_SCENARIO,
    TA_CONNORS_RSI_SCENARIO,
    TA_KST_SCENARIO,
    TA_FISHER_SCENARIO,
    TA_KLINGER_SCENARIO,
    TA_RVGI_SCENARIO,
    TA_BB_PERCENT_B_SCENARIO,
    TA_BBW_SCENARIO,
    TA_DONCHIAN_SCENARIO,
    TA_KELTNER_SCENARIO,
    TA_ENVELOPE_SCENARIO,
    TA_CHOP_SCENARIO,
    TA_HISTORICAL_VOLATILITY_SCENARIO,
    TA_RVI_SCENARIO,
    TA_MASS_INDEX_SCENARIO,
    TA_MEDIAN_SCENARIO,
    TA_ADR_SCENARIO,
    TA_ULCER_INDEX_SCENARIO,
    TA_PSAR_SCENARIO,
    TA_SUPERTREND_SCENARIO,
    TA_CHANDELIER_SCENARIO,
    TA_CHANDE_KROLL_STOP_SCENARIO,
    TA_WILLIAMS_FRACTAL_SCENARIO,
    TA_VOL_SCENARIO,
    TA_VWAP_SCENARIO,
    TA_ANCHORED_VWAP_SCENARIO,
    TA_OBV_SCENARIO,
    TA_ADL_SCENARIO,
    TA_BOP_SCENARIO,
    TA_CMF_SCENARIO,
    TA_CHAIKIN_OSC_SCENARIO,
    TA_MFI_SCENARIO,
    TA_NET_VOLUME_SCENARIO,
    TA_PVO_SCENARIO,
    TA_PVT_SCENARIO,
    TA_EOM_SCENARIO,
    TA_NVI_SCENARIO,
    TA_PVI_SCENARIO,
    TA_ZIG_ZAG_SCENARIO,
    TA_PIVOTS_HIGH_LOW_SCENARIO,
    TA_PIVOTS_STANDARD_SCENARIO,
    TA_VOLATILITY_STOP_SCENARIO,
    TA_VORTEX_SCENARIO,
    TA_TREND_STRENGTH_INDEX_SCENARIO,
    TA_ICHIMOKU_SCENARIO,
]);

/**
 * Deprecated alias for {@link ALL_SCENARIOS}. Kept for one release
 * (`0.2.1`) so downstream adapters that imported the original Phase-1
 * name keep compiling while they migrate.
 *
 * @deprecated since 0.2.1, use {@link ALL_SCENARIOS}.
 * @since 0.1
 * @experimental
 * @example
 *     import { PHASE_1_SCENARIOS } from "@invinite-org/chartlang-conformance";
 *     void PHASE_1_SCENARIOS;
 */
export const PHASE_1_SCENARIOS: ReadonlyArray<Scenario> = ALL_SCENARIOS;
