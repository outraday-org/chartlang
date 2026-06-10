// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario } from "../runConformanceSuite";

import { BARSTATE_CONFIRMED_SCENARIO } from "./barstateConfirmed.scenario";
import { BOLLINGER_BANDS_SCENARIO } from "./bollingerBands.scenario";
import { DEFINE_ALERT_CONDITION_FIRES_SCENARIO } from "./defineAlertConditionFires.scenario";
import { DEFINE_ALERT_CONDITION_GATED_SCENARIO } from "./defineAlertConditionGated.scenario";
import { DEFINE_ALERT_CONDITION_UNKNOWN_SCENARIO } from "./defineAlertConditionUnknown.scenario";
import { DEFINE_DRAWING_BASIC_SCENARIO } from "./defineDrawingBasic.scenario";
import { DRAW_ABCD_PATTERN_SCENARIO } from "./drawAbcdPattern.scenario";
import { DRAW_ALL_61_SCENARIO } from "./drawAll61.scenario";
import { DRAW_ANNOTATIONS_ALL_SCENARIO } from "./drawAnnotationsAll.scenario";
import { DRAW_ARC_SCENARIO } from "./drawArc.scenario";
import { DRAW_ARROW_SCENARIO } from "./drawArrow.scenario";
import { DRAW_ARROW_MARK_DOWN_SCENARIO } from "./drawArrowMarkDown.scenario";
import { DRAW_ARROW_MARK_UP_SCENARIO } from "./drawArrowMarkUp.scenario";
import { DRAW_ARROW_MARKER_SCENARIO } from "./drawArrowMarker.scenario";
import { DRAW_BOXES_ALL_SCENARIO } from "./drawBoxesAll.scenario";
import { DRAW_BRUSH_SCENARIO } from "./drawBrush.scenario";
import { DRAW_CHANNELS_ALL_SCENARIO } from "./drawChannelsAll.scenario";
import { DRAW_CIRCLE_SCENARIO } from "./drawCircle.scenario";
import { DRAW_CONTAINERS_ALL_SCENARIO } from "./drawContainersAll.scenario";
import { DRAW_CROSS_LINE_SCENARIO } from "./drawCrossLine.scenario";
import { DRAW_CURVE_SCENARIO } from "./drawCurve.scenario";
import { DRAW_CURVES_AND_FREEHAND_ALL_SCENARIO } from "./drawCurvesAndFreehandAll.scenario";
import { DRAW_CYCLES_ALL_SCENARIO } from "./drawCyclesAll.scenario";
import { DRAW_CYCLIC_LINES_SCENARIO } from "./drawCyclicLines.scenario";
import { DRAW_CYPHER_PATTERN_SCENARIO } from "./drawCypherPattern.scenario";
import { DRAW_DISJOINT_CHANNEL_SCENARIO } from "./drawDisjointChannel.scenario";
import { DRAW_DOUBLE_CURVE_SCENARIO } from "./drawDoubleCurve.scenario";
import { DRAW_ELLIOTT_ALL_SCENARIO } from "./drawElliottAll.scenario";
import { DRAW_ELLIOTT_CORRECTION_WAVE_SCENARIO } from "./drawElliottCorrectionWave.scenario";
import { DRAW_ELLIOTT_DOUBLE_COMBO_SCENARIO } from "./drawElliottDoubleCombo.scenario";
import { DRAW_ELLIOTT_IMPULSE_WAVE_SCENARIO } from "./drawElliottImpulseWave.scenario";
import { DRAW_ELLIOTT_TRIANGLE_WAVE_SCENARIO } from "./drawElliottTriangleWave.scenario";
import { DRAW_ELLIOTT_TRIPLE_COMBO_SCENARIO } from "./drawElliottTripleCombo.scenario";
import { DRAW_ELLIPSE_SCENARIO } from "./drawEllipse.scenario";
import { DRAW_FIB_ALL_SCENARIO } from "./drawFibAll.scenario";
import { DRAW_FIB_CHANNEL_SCENARIO } from "./drawFibChannel.scenario";
import { DRAW_FIB_CIRCLES_SCENARIO } from "./drawFibCircles.scenario";
import { DRAW_FIB_RETRACEMENT_SCENARIO } from "./drawFibRetracement.scenario";
import { DRAW_FIB_SPEED_ARCS_SCENARIO } from "./drawFibSpeedArcs.scenario";
import { DRAW_FIB_SPEED_FAN_SCENARIO } from "./drawFibSpeedFan.scenario";
import { DRAW_FIB_SPIRAL_SCENARIO } from "./drawFibSpiral.scenario";
import { DRAW_FIB_TIME_ZONE_SCENARIO } from "./drawFibTimeZone.scenario";
import { DRAW_FIB_TREND_EXTENSION_SCENARIO } from "./drawFibTrendExtension.scenario";
import { DRAW_FIB_TREND_TIME_SCENARIO } from "./drawFibTrendTime.scenario";
import { DRAW_FIB_WEDGE_SCENARIO } from "./drawFibWedge.scenario";
import { DRAW_FLAT_TOP_BOTTOM_SCENARIO } from "./drawFlatTopBottom.scenario";
import { DRAW_FRAME_SCENARIO } from "./drawFrame.scenario";
import { DRAW_GANN_ALL_SCENARIO } from "./drawGannAll.scenario";
import { DRAW_GANN_BOX_SCENARIO } from "./drawGannBox.scenario";
import { DRAW_GANN_FAN_SCENARIO } from "./drawGannFan.scenario";
import { DRAW_GANN_SQUARE_SCENARIO } from "./drawGannSquare.scenario";
import { DRAW_GANN_SQUARE_FIXED_SCENARIO } from "./drawGannSquareFixed.scenario";
import { DRAW_GROUP_SCENARIO } from "./drawGroup.scenario";
import { DRAW_HANDLE_REMOVE_SCENARIO } from "./drawHandleRemove.scenario";
import { DRAW_HEAD_AND_SHOULDERS_SCENARIO } from "./drawHeadAndShoulders.scenario";
import { DRAW_HIGHLIGHTER_SCENARIO } from "./drawHighlighter.scenario";
import { DRAW_HORIZONTAL_LINE_SCENARIO } from "./drawHorizontalLine.scenario";
import { DRAW_HORIZONTAL_RAY_SCENARIO } from "./drawHorizontalRay.scenario";
import { DRAW_INTERACTIVE_UPDATE_SCENARIO } from "./drawInteractiveUpdate.scenario";
import { DRAW_LINE_SCENARIO } from "./drawLine.scenario";
import { DRAW_LINES_AND_RAYS_SCENARIO } from "./drawLinesAndRays.scenario";
import { DRAW_MARKER_SCENARIO } from "./drawMarker.scenario";
import { DRAW_PATH_SCENARIO } from "./drawPath.scenario";
import { DRAW_PATTERNS_ALL_SCENARIO } from "./drawPatternsAll.scenario";
import { DRAW_PEN_SCENARIO } from "./drawPen.scenario";
import { DRAW_PITCHFAN_SCENARIO } from "./drawPitchfan.scenario";
import { DRAW_PITCHFORK_SCENARIO } from "./drawPitchfork.scenario";
import { DRAW_PITCHFORKS_ALL_SCENARIO } from "./drawPitchforksAll.scenario";
import { DRAW_POLYLINE_SCENARIO } from "./drawPolyline.scenario";
import { DRAW_RECTANGLE_SCENARIO } from "./drawRectangle.scenario";
import { DRAW_REGRESSION_TREND_SCENARIO } from "./drawRegressionTrend.scenario";
import { DRAW_ROTATED_RECTANGLE_SCENARIO } from "./drawRotatedRectangle.scenario";
import { DRAW_SINE_LINE_SCENARIO } from "./drawSineLine.scenario";
import { DRAW_TABLE_GATED_SCENARIO } from "./drawTableGated.scenario";
import { DRAW_TABLE_HAPPY_SCENARIO } from "./drawTableHappy.scenario";
import { DRAW_TEXT_SCENARIO } from "./drawText.scenario";
import { DRAW_THREE_DRIVES_PATTERN_SCENARIO } from "./drawThreeDrivesPattern.scenario";
import { DRAW_TIME_CYCLES_SCENARIO } from "./drawTimeCycles.scenario";
import { DRAW_TREND_ANGLE_SCENARIO } from "./drawTrendAngle.scenario";
import { DRAW_TREND_CHANNEL_SCENARIO } from "./drawTrendChannel.scenario";
import { DRAW_TRIANGLE_SCENARIO } from "./drawTriangle.scenario";
import { DRAW_TRIANGLE_PATTERN_SCENARIO } from "./drawTrianglePattern.scenario";
import { DRAW_VERTICAL_LINE_SCENARIO } from "./drawVerticalLine.scenario";
import { DRAW_XABCD_PATTERN_SCENARIO } from "./drawXabcdPattern.scenario";
import { EMA_CROSS_SCENARIO } from "./emaCross.scenario";
import { INPUT_INTERVAL_SCENARIO } from "./inputInterval.scenario";
import { LOWER_TF_CAPABILITY_FALSE_SCENARIO } from "./lowerTfCapabilityFalse.scenario";
import { LOWER_TF_HAPPY_PATH_SCENARIO } from "./lowerTfHappyPath.scenario";
import { LOWER_TF_UNSUPPORTED_INTERVAL_SCENARIO } from "./lowerTfUnsupportedInterval.scenario";
import { MTF_CAPABILITY_FALSE_SCENARIO } from "./mtfCapabilityFalse.scenario";
import { MTF_REQUEST_SECURITY_CLOSE_SCENARIO } from "./mtfRequestSecurityClose.scenario";
import { MTF_UNSUPPORTED_INTERVAL_SCENARIO } from "./mtfUnsupportedInterval.scenario";
import { PLOT_KIND_ARROW_SCENARIO } from "./plotKindArrow.scenario";
import { PLOT_KIND_ARROW_GATED_SCENARIO } from "./plotKindArrowGated.scenario";
import { PLOT_KIND_BAR_COLOR_SCENARIO } from "./plotKindBarColor.scenario";
import { PLOT_KIND_BAR_COLOR_GATED_SCENARIO } from "./plotKindBarColorGated.scenario";
import { PLOT_KIND_BAR_OVERRIDE_SCENARIO } from "./plotKindBarOverride.scenario";
import { PLOT_KIND_BAR_OVERRIDE_GATED_SCENARIO } from "./plotKindBarOverrideGated.scenario";
import { PLOT_KIND_BG_COLOR_SCENARIO } from "./plotKindBgColor.scenario";
import { PLOT_KIND_BG_COLOR_GATED_SCENARIO } from "./plotKindBgColorGated.scenario";
import { PLOT_KIND_CANDLE_OVERRIDE_SCENARIO } from "./plotKindCandleOverride.scenario";
import { PLOT_KIND_CANDLE_OVERRIDE_GATED_SCENARIO } from "./plotKindCandleOverrideGated.scenario";
import { PLOT_KIND_CHARACTER_SCENARIO } from "./plotKindCharacter.scenario";
import { PLOT_KIND_CHARACTER_GATED_SCENARIO } from "./plotKindCharacterGated.scenario";
import { PLOT_KIND_COVERAGE_SCENARIO } from "./plotKindCoverage.scenario";
import { PLOT_KIND_HORIZONTAL_HISTOGRAM_SCENARIO } from "./plotKindHorizontalHistogram.scenario";
import { PLOT_KIND_HORIZONTAL_HISTOGRAM_GATED_SCENARIO } from "./plotKindHorizontalHistogramGated.scenario";
import { PLOT_KIND_SHAPE_SCENARIO } from "./plotKindShape.scenario";
import { PLOT_KIND_SHAPE_GATED_SCENARIO } from "./plotKindShapeGated.scenario";
import { REQUEST_SECURITY_NAN_FALLBACK_SCENARIO } from "./requestSecurityNanFallback.scenario";
import { RSI_DIVERGENCE_SCENARIO } from "./rsiDivergenceAlert.scenario";
import { RUNTIME_ERROR_SCENARIO } from "./runtimeError.scenario";
import { RUNTIME_LOG_BUDGET_SCENARIO } from "./runtimeLogBudget.scenario";
import { RUNTIME_LOG_GATED_SCENARIO } from "./runtimeLogGated.scenario";
import { RUNTIME_LOG_INFO_SCENARIO } from "./runtimeLogInfo.scenario";
import { STATE_SESSION_HIGH_SCENARIO } from "./stateSessionHigh.scenario";
import { STATE_TICK_COUNTER_SCENARIO } from "./stateTickCounter.scenario";
import { SYMINFO_MINTICK_SCENARIO } from "./syminfoMintick.scenario";
import { TA_ADL_SCENARIO } from "./taAdl.scenario";
import { TA_ADR_SCENARIO } from "./taAdr.scenario";
import { TA_ADX_SCENARIO } from "./taAdx.scenario";
import { TA_ALMA_SCENARIO } from "./taAlma.scenario";
import { TA_ANCHORED_VOLUME_PROFILE_SCENARIO } from "./taAnchoredVolumeProfile.scenario";
import { TA_ANCHORED_VOLUME_PROFILE_GATED_SCENARIO } from "./taAnchoredVolumeProfileGated.scenario";
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
import { TA_FIXED_RANGE_VOLUME_PROFILE_SCENARIO } from "./taFixedRangeVolumeProfile.scenario";
import { TA_FIXED_RANGE_VOLUME_PROFILE_GATED_SCENARIO } from "./taFixedRangeVolumeProfileGated.scenario";
import { TA_FIXED_RANGE_VOLUME_PROFILE_INVERTED_SCENARIO } from "./taFixedRangeVolumeProfileInverted.scenario";
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
import { TA_SESSION_VOLUME_PROFILE_SCENARIO } from "./taSessionVolumeProfile.scenario";
import { TA_SESSION_VOLUME_PROFILE_GATED_SCENARIO } from "./taSessionVolumeProfileGated.scenario";
import { TA_SESSION_VOLUME_PROFILE_NO_SESSION_SCENARIO } from "./taSessionVolumeProfileNoSession.scenario";
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
import { TA_VISIBLE_RANGE_VOLUME_PROFILE_SCENARIO } from "./taVisibleRangeVolumeProfile.scenario";
import { TA_VISIBLE_RANGE_VOLUME_PROFILE_GATED_SCENARIO } from "./taVisibleRangeVolumeProfileGated.scenario";
import { TA_VOL_SCENARIO } from "./taVol.scenario";
import { TA_VOLATILITY_STOP_SCENARIO } from "./taVolatilityStop.scenario";
import { TA_VORTEX_SCENARIO } from "./taVortex.scenario";
import { TA_VWAP_SCENARIO } from "./taVwap.scenario";
import { TA_VWMA_SCENARIO } from "./taVwma.scenario";
import { TA_WILLIAMS_FRACTAL_SCENARIO } from "./taWilliamsFractal.scenario";
import { TA_WILLIAMS_R_SCENARIO } from "./taWilliamsR.scenario";
import { TA_WMA_SCENARIO } from "./taWma.scenario";
import { TA_ZIG_ZAG_SCENARIO } from "./taZigZag.scenario";
import { TIMEFRAME_ISDAILY_SCENARIO } from "./timeframeIsdaily.scenario";
import { UNSUPPORTED_INTERVAL_SCENARIO } from "./unsupportedInterval.scenario";

export { BARSTATE_CONFIRMED_SCENARIO } from "./barstateConfirmed.scenario";
export { BOLLINGER_BANDS_SCENARIO } from "./bollingerBands.scenario";
export { DEFINE_ALERT_CONDITION_FIRES_SCENARIO } from "./defineAlertConditionFires.scenario";
export { DEFINE_ALERT_CONDITION_GATED_SCENARIO } from "./defineAlertConditionGated.scenario";
export { DEFINE_ALERT_CONDITION_UNKNOWN_SCENARIO } from "./defineAlertConditionUnknown.scenario";
export { DEFINE_DRAWING_BASIC_SCENARIO } from "./defineDrawingBasic.scenario";
export { DRAW_ANNOTATIONS_ALL_SCENARIO } from "./drawAnnotationsAll.scenario";
export { DRAW_ARC_SCENARIO } from "./drawArc.scenario";
export { DRAW_ARROW_SCENARIO } from "./drawArrow.scenario";
export { DRAW_ARROW_MARK_DOWN_SCENARIO } from "./drawArrowMarkDown.scenario";
export { DRAW_ARROW_MARK_UP_SCENARIO } from "./drawArrowMarkUp.scenario";
export { DRAW_ARROW_MARKER_SCENARIO } from "./drawArrowMarker.scenario";
export { DRAW_BOXES_ALL_SCENARIO } from "./drawBoxesAll.scenario";
export { DRAW_BRUSH_SCENARIO } from "./drawBrush.scenario";
export { DRAW_CHANNELS_ALL_SCENARIO } from "./drawChannelsAll.scenario";
export { DRAW_CIRCLE_SCENARIO } from "./drawCircle.scenario";
export { DRAW_CROSS_LINE_SCENARIO } from "./drawCrossLine.scenario";
export { DRAW_CURVE_SCENARIO } from "./drawCurve.scenario";
export { DRAW_CURVES_AND_FREEHAND_ALL_SCENARIO } from "./drawCurvesAndFreehandAll.scenario";
export { DRAW_DISJOINT_CHANNEL_SCENARIO } from "./drawDisjointChannel.scenario";
export { DRAW_DOUBLE_CURVE_SCENARIO } from "./drawDoubleCurve.scenario";
export { DRAW_ELLIPSE_SCENARIO } from "./drawEllipse.scenario";
export { DRAW_FIB_ALL_SCENARIO } from "./drawFibAll.scenario";
export { DRAW_FIB_CHANNEL_SCENARIO } from "./drawFibChannel.scenario";
export { DRAW_FIB_CIRCLES_SCENARIO } from "./drawFibCircles.scenario";
export { DRAW_FIB_RETRACEMENT_SCENARIO } from "./drawFibRetracement.scenario";
export { DRAW_FIB_SPEED_ARCS_SCENARIO } from "./drawFibSpeedArcs.scenario";
export { DRAW_FIB_SPEED_FAN_SCENARIO } from "./drawFibSpeedFan.scenario";
export { DRAW_FIB_SPIRAL_SCENARIO } from "./drawFibSpiral.scenario";
export { DRAW_FIB_TIME_ZONE_SCENARIO } from "./drawFibTimeZone.scenario";
export { DRAW_FIB_TREND_EXTENSION_SCENARIO } from "./drawFibTrendExtension.scenario";
export { DRAW_FIB_TREND_TIME_SCENARIO } from "./drawFibTrendTime.scenario";
export { DRAW_FIB_WEDGE_SCENARIO } from "./drawFibWedge.scenario";
export { DRAW_GANN_ALL_SCENARIO } from "./drawGannAll.scenario";
export { DRAW_GANN_BOX_SCENARIO } from "./drawGannBox.scenario";
export { DRAW_GANN_FAN_SCENARIO } from "./drawGannFan.scenario";
export { DRAW_GANN_SQUARE_SCENARIO } from "./drawGannSquare.scenario";
export { DRAW_GANN_SQUARE_FIXED_SCENARIO } from "./drawGannSquareFixed.scenario";
export { DRAW_FLAT_TOP_BOTTOM_SCENARIO } from "./drawFlatTopBottom.scenario";
export { DRAW_HIGHLIGHTER_SCENARIO } from "./drawHighlighter.scenario";
export { DRAW_HORIZONTAL_LINE_SCENARIO } from "./drawHorizontalLine.scenario";
export { DRAW_HORIZONTAL_RAY_SCENARIO } from "./drawHorizontalRay.scenario";
export { DRAW_LINE_SCENARIO } from "./drawLine.scenario";
export { DRAW_LINES_AND_RAYS_SCENARIO } from "./drawLinesAndRays.scenario";
export { DRAW_MARKER_SCENARIO } from "./drawMarker.scenario";
export { DRAW_PATH_SCENARIO } from "./drawPath.scenario";
export { DRAW_PEN_SCENARIO } from "./drawPen.scenario";
export { DRAW_PITCHFAN_SCENARIO } from "./drawPitchfan.scenario";
export { DRAW_PITCHFORK_SCENARIO } from "./drawPitchfork.scenario";
export { DRAW_PITCHFORKS_ALL_SCENARIO } from "./drawPitchforksAll.scenario";
export { DRAW_ABCD_PATTERN_SCENARIO } from "./drawAbcdPattern.scenario";
export { DRAW_ALL_61_SCENARIO } from "./drawAll61.scenario";
export { DRAW_BUDGET_OVERFLOW_SCENARIO } from "./drawBudgetOverflow.scenario";
export { DRAW_UNSUPPORTED_KIND_SCENARIO } from "./drawUnsupportedKind.scenario";
export { DRAW_CYPHER_PATTERN_SCENARIO } from "./drawCypherPattern.scenario";
export { DRAW_HEAD_AND_SHOULDERS_SCENARIO } from "./drawHeadAndShoulders.scenario";
export { DRAW_PATTERNS_ALL_SCENARIO } from "./drawPatternsAll.scenario";
export { DRAW_THREE_DRIVES_PATTERN_SCENARIO } from "./drawThreeDrivesPattern.scenario";
export { DRAW_TRIANGLE_PATTERN_SCENARIO } from "./drawTrianglePattern.scenario";
export { DRAW_XABCD_PATTERN_SCENARIO } from "./drawXabcdPattern.scenario";
export { DRAW_ELLIOTT_ALL_SCENARIO } from "./drawElliottAll.scenario";
export { DRAW_ELLIOTT_CORRECTION_WAVE_SCENARIO } from "./drawElliottCorrectionWave.scenario";
export { DRAW_ELLIOTT_DOUBLE_COMBO_SCENARIO } from "./drawElliottDoubleCombo.scenario";
export { DRAW_ELLIOTT_IMPULSE_WAVE_SCENARIO } from "./drawElliottImpulseWave.scenario";
export { DRAW_ELLIOTT_TRIANGLE_WAVE_SCENARIO } from "./drawElliottTriangleWave.scenario";
export { DRAW_ELLIOTT_TRIPLE_COMBO_SCENARIO } from "./drawElliottTripleCombo.scenario";
export { DRAW_CYCLES_ALL_SCENARIO } from "./drawCyclesAll.scenario";
export { DRAW_CYCLIC_LINES_SCENARIO } from "./drawCyclicLines.scenario";
export { DRAW_SINE_LINE_SCENARIO } from "./drawSineLine.scenario";
export { DRAW_TIME_CYCLES_SCENARIO } from "./drawTimeCycles.scenario";
export { DRAW_CONTAINERS_ALL_SCENARIO } from "./drawContainersAll.scenario";
export { DRAW_FRAME_SCENARIO } from "./drawFrame.scenario";
export { DRAW_GROUP_SCENARIO } from "./drawGroup.scenario";
export { DRAW_TABLE_GATED_SCENARIO } from "./drawTableGated.scenario";
export { DRAW_TABLE_HAPPY_SCENARIO } from "./drawTableHappy.scenario";
export { DRAW_HANDLE_REMOVE_SCENARIO } from "./drawHandleRemove.scenario";
export { DRAW_INTERACTIVE_UPDATE_SCENARIO } from "./drawInteractiveUpdate.scenario";
export { DRAW_POLYLINE_SCENARIO } from "./drawPolyline.scenario";
export { DRAW_RECTANGLE_SCENARIO } from "./drawRectangle.scenario";
export { DRAW_REGRESSION_TREND_SCENARIO } from "./drawRegressionTrend.scenario";
export { DRAW_ROTATED_RECTANGLE_SCENARIO } from "./drawRotatedRectangle.scenario";
export { DRAW_TREND_ANGLE_SCENARIO } from "./drawTrendAngle.scenario";
export { DRAW_TEXT_SCENARIO } from "./drawText.scenario";
export { DRAW_TREND_CHANNEL_SCENARIO } from "./drawTrendChannel.scenario";
export { DRAW_TRIANGLE_SCENARIO } from "./drawTriangle.scenario";
export { DRAW_VERTICAL_LINE_SCENARIO } from "./drawVerticalLine.scenario";
export { EMA_CROSS_SCENARIO } from "./emaCross.scenario";
export { INPUT_INTERVAL_SCENARIO } from "./inputInterval.scenario";
export { LOWER_TF_CAPABILITY_FALSE_SCENARIO } from "./lowerTfCapabilityFalse.scenario";
export { LOWER_TF_HAPPY_PATH_SCENARIO } from "./lowerTfHappyPath.scenario";
export { LOWER_TF_UNSUPPORTED_INTERVAL_SCENARIO } from "./lowerTfUnsupportedInterval.scenario";
export { MTF_CAPABILITY_FALSE_SCENARIO } from "./mtfCapabilityFalse.scenario";
export { MTF_REQUEST_SECURITY_CLOSE_SCENARIO } from "./mtfRequestSecurityClose.scenario";
export { MTF_UNSUPPORTED_INTERVAL_SCENARIO } from "./mtfUnsupportedInterval.scenario";
export { PLOT_KIND_ARROW_SCENARIO } from "./plotKindArrow.scenario";
export { PLOT_KIND_ARROW_GATED_SCENARIO } from "./plotKindArrowGated.scenario";
export { PLOT_KIND_BAR_COLOR_SCENARIO } from "./plotKindBarColor.scenario";
export { PLOT_KIND_BAR_COLOR_GATED_SCENARIO } from "./plotKindBarColorGated.scenario";
export { PLOT_KIND_BAR_OVERRIDE_SCENARIO } from "./plotKindBarOverride.scenario";
export { PLOT_KIND_BAR_OVERRIDE_GATED_SCENARIO } from "./plotKindBarOverrideGated.scenario";
export { PLOT_KIND_BG_COLOR_SCENARIO } from "./plotKindBgColor.scenario";
export { PLOT_KIND_BG_COLOR_GATED_SCENARIO } from "./plotKindBgColorGated.scenario";
export { PLOT_KIND_CANDLE_OVERRIDE_SCENARIO } from "./plotKindCandleOverride.scenario";
export { PLOT_KIND_CANDLE_OVERRIDE_GATED_SCENARIO } from "./plotKindCandleOverrideGated.scenario";
export { PLOT_KIND_CHARACTER_SCENARIO } from "./plotKindCharacter.scenario";
export { PLOT_KIND_CHARACTER_GATED_SCENARIO } from "./plotKindCharacterGated.scenario";
export { PLOT_KIND_COVERAGE_SCENARIO } from "./plotKindCoverage.scenario";
export { PLOT_KIND_HORIZONTAL_HISTOGRAM_SCENARIO } from "./plotKindHorizontalHistogram.scenario";
export { PLOT_KIND_HORIZONTAL_HISTOGRAM_GATED_SCENARIO } from "./plotKindHorizontalHistogramGated.scenario";
export { PLOT_KIND_SHAPE_SCENARIO } from "./plotKindShape.scenario";
export { PLOT_KIND_SHAPE_GATED_SCENARIO } from "./plotKindShapeGated.scenario";
export { REQUEST_SECURITY_NAN_FALLBACK_SCENARIO } from "./requestSecurityNanFallback.scenario";
export { RSI_DIVERGENCE_SCENARIO } from "./rsiDivergenceAlert.scenario";
export { RUNTIME_ERROR_SCENARIO } from "./runtimeError.scenario";
export { RUNTIME_LOG_BUDGET_SCENARIO } from "./runtimeLogBudget.scenario";
export { RUNTIME_LOG_GATED_SCENARIO } from "./runtimeLogGated.scenario";
export { RUNTIME_LOG_INFO_SCENARIO } from "./runtimeLogInfo.scenario";
export { STATE_SESSION_HIGH_SCENARIO } from "./stateSessionHigh.scenario";
export { STATE_TICK_COUNTER_SCENARIO } from "./stateTickCounter.scenario";
export { SYMINFO_MINTICK_SCENARIO } from "./syminfoMintick.scenario";
export { TA_ADL_SCENARIO } from "./taAdl.scenario";
export { TA_ADR_SCENARIO } from "./taAdr.scenario";
export { TA_ADX_SCENARIO } from "./taAdx.scenario";
export { TA_ALMA_SCENARIO } from "./taAlma.scenario";
export { TA_ANCHORED_VOLUME_PROFILE_SCENARIO } from "./taAnchoredVolumeProfile.scenario";
export { TA_ANCHORED_VOLUME_PROFILE_GATED_SCENARIO } from "./taAnchoredVolumeProfileGated.scenario";
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
export { TA_FIXED_RANGE_VOLUME_PROFILE_SCENARIO } from "./taFixedRangeVolumeProfile.scenario";
export { TA_FIXED_RANGE_VOLUME_PROFILE_GATED_SCENARIO } from "./taFixedRangeVolumeProfileGated.scenario";
export { TA_FIXED_RANGE_VOLUME_PROFILE_INVERTED_SCENARIO } from "./taFixedRangeVolumeProfileInverted.scenario";
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
export { TA_SESSION_VOLUME_PROFILE_SCENARIO } from "./taSessionVolumeProfile.scenario";
export { TA_SESSION_VOLUME_PROFILE_GATED_SCENARIO } from "./taSessionVolumeProfileGated.scenario";
export { TA_SESSION_VOLUME_PROFILE_NO_SESSION_SCENARIO } from "./taSessionVolumeProfileNoSession.scenario";
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
export { TA_VISIBLE_RANGE_VOLUME_PROFILE_SCENARIO } from "./taVisibleRangeVolumeProfile.scenario";
export { TA_VISIBLE_RANGE_VOLUME_PROFILE_GATED_SCENARIO } from "./taVisibleRangeVolumeProfileGated.scenario";
export { TA_VOL_SCENARIO } from "./taVol.scenario";
export { TA_VOLATILITY_STOP_SCENARIO } from "./taVolatilityStop.scenario";
export { TA_VORTEX_SCENARIO } from "./taVortex.scenario";
export { TA_VWAP_SCENARIO } from "./taVwap.scenario";
export { TA_VWMA_SCENARIO } from "./taVwma.scenario";
export { TA_WILLIAMS_FRACTAL_SCENARIO } from "./taWilliamsFractal.scenario";
export { TA_WILLIAMS_R_SCENARIO } from "./taWilliamsR.scenario";
export { TA_WMA_SCENARIO } from "./taWma.scenario";
export { TA_ZIG_ZAG_SCENARIO } from "./taZigZag.scenario";
export { TIMEFRAME_ISDAILY_SCENARIO } from "./timeframeIsdaily.scenario";
export { UNSUPPORTED_INTERVAL_SCENARIO } from "./unsupportedInterval.scenario";
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
    PLOT_KIND_SHAPE_SCENARIO,
    PLOT_KIND_SHAPE_GATED_SCENARIO,
    PLOT_KIND_CHARACTER_SCENARIO,
    PLOT_KIND_CHARACTER_GATED_SCENARIO,
    PLOT_KIND_ARROW_SCENARIO,
    PLOT_KIND_ARROW_GATED_SCENARIO,
    PLOT_KIND_CANDLE_OVERRIDE_SCENARIO,
    PLOT_KIND_CANDLE_OVERRIDE_GATED_SCENARIO,
    PLOT_KIND_BAR_OVERRIDE_SCENARIO,
    PLOT_KIND_BAR_OVERRIDE_GATED_SCENARIO,
    PLOT_KIND_BG_COLOR_SCENARIO,
    PLOT_KIND_BG_COLOR_GATED_SCENARIO,
    PLOT_KIND_BAR_COLOR_SCENARIO,
    PLOT_KIND_BAR_COLOR_GATED_SCENARIO,
    PLOT_KIND_HORIZONTAL_HISTOGRAM_SCENARIO,
    PLOT_KIND_HORIZONTAL_HISTOGRAM_GATED_SCENARIO,
    DEFINE_ALERT_CONDITION_FIRES_SCENARIO,
    DEFINE_ALERT_CONDITION_GATED_SCENARIO,
    DEFINE_ALERT_CONDITION_UNKNOWN_SCENARIO,
    RUNTIME_LOG_INFO_SCENARIO,
    RUNTIME_LOG_GATED_SCENARIO,
    RUNTIME_LOG_BUDGET_SCENARIO,
    RUNTIME_ERROR_SCENARIO,
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
    TA_VISIBLE_RANGE_VOLUME_PROFILE_SCENARIO,
    TA_VISIBLE_RANGE_VOLUME_PROFILE_GATED_SCENARIO,
    TA_ANCHORED_VOLUME_PROFILE_SCENARIO,
    TA_ANCHORED_VOLUME_PROFILE_GATED_SCENARIO,
    TA_SESSION_VOLUME_PROFILE_SCENARIO,
    TA_SESSION_VOLUME_PROFILE_GATED_SCENARIO,
    TA_SESSION_VOLUME_PROFILE_NO_SESSION_SCENARIO,
    TA_FIXED_RANGE_VOLUME_PROFILE_SCENARIO,
    TA_FIXED_RANGE_VOLUME_PROFILE_GATED_SCENARIO,
    TA_FIXED_RANGE_VOLUME_PROFILE_INVERTED_SCENARIO,
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
    // Phase 3 Task 5 — Lines/Rays.
    DRAW_LINE_SCENARIO,
    DRAW_HORIZONTAL_LINE_SCENARIO,
    DRAW_HORIZONTAL_RAY_SCENARIO,
    DRAW_VERTICAL_LINE_SCENARIO,
    DRAW_CROSS_LINE_SCENARIO,
    DRAW_TREND_ANGLE_SCENARIO,
    DRAW_LINES_AND_RAYS_SCENARIO,
    // Phase 3 Task 6 — Boxes A.
    DRAW_RECTANGLE_SCENARIO,
    DRAW_ROTATED_RECTANGLE_SCENARIO,
    DRAW_TRIANGLE_SCENARIO,
    DRAW_POLYLINE_SCENARIO,
    // Phase 3 Task 7 — Boxes B.
    DRAW_CIRCLE_SCENARIO,
    DRAW_ELLIPSE_SCENARIO,
    DRAW_PATH_SCENARIO,
    DRAW_MARKER_SCENARIO,
    // Phase 3 Task 7 — combined box bundle (supersedes Task 6's
    // `DRAW_BOXES_A_SCENARIO`, covering all 8 box kinds).
    DRAW_BOXES_ALL_SCENARIO,
    // Phase 3 Task 8 — Curves + Freehand.
    DRAW_ARC_SCENARIO,
    DRAW_CURVE_SCENARIO,
    DRAW_DOUBLE_CURVE_SCENARIO,
    DRAW_PEN_SCENARIO,
    DRAW_HIGHLIGHTER_SCENARIO,
    DRAW_BRUSH_SCENARIO,
    DRAW_CURVES_AND_FREEHAND_ALL_SCENARIO,
    // Phase 3 Task 9 — Annotations.
    DRAW_TEXT_SCENARIO,
    DRAW_ARROW_SCENARIO,
    DRAW_ARROW_MARKER_SCENARIO,
    DRAW_ARROW_MARK_UP_SCENARIO,
    DRAW_ARROW_MARK_DOWN_SCENARIO,
    DRAW_ANNOTATIONS_ALL_SCENARIO,
    // Phase 3 Task 10 — Channels.
    DRAW_TREND_CHANNEL_SCENARIO,
    DRAW_FLAT_TOP_BOTTOM_SCENARIO,
    DRAW_DISJOINT_CHANNEL_SCENARIO,
    DRAW_REGRESSION_TREND_SCENARIO,
    DRAW_CHANNELS_ALL_SCENARIO,
    // Phase 3 Task 11 — Fibonacci A.
    DRAW_FIB_RETRACEMENT_SCENARIO,
    DRAW_FIB_TREND_EXTENSION_SCENARIO,
    DRAW_FIB_CHANNEL_SCENARIO,
    DRAW_FIB_TIME_ZONE_SCENARIO,
    DRAW_FIB_WEDGE_SCENARIO,
    // Phase 3 Task 12 — Fibonacci B (supersedes Task 11's DRAW_FIB_A
    // bundle with DRAW_FIB_ALL covering all 10 fib kinds).
    DRAW_FIB_SPEED_FAN_SCENARIO,
    DRAW_FIB_SPEED_ARCS_SCENARIO,
    DRAW_FIB_SPIRAL_SCENARIO,
    DRAW_FIB_CIRCLES_SCENARIO,
    DRAW_FIB_TREND_TIME_SCENARIO,
    DRAW_FIB_ALL_SCENARIO,
    // Phase 3 Task 13 — Gann.
    DRAW_GANN_BOX_SCENARIO,
    DRAW_GANN_SQUARE_FIXED_SCENARIO,
    DRAW_GANN_SQUARE_SCENARIO,
    DRAW_GANN_FAN_SCENARIO,
    DRAW_GANN_ALL_SCENARIO,
    // Phase 3 Task 14 — Pitchforks.
    DRAW_PITCHFORK_SCENARIO,
    DRAW_PITCHFAN_SCENARIO,
    DRAW_PITCHFORKS_ALL_SCENARIO,
    // Phase 3 Task 15 — Harmonic Patterns.
    DRAW_XABCD_PATTERN_SCENARIO,
    DRAW_CYPHER_PATTERN_SCENARIO,
    DRAW_HEAD_AND_SHOULDERS_SCENARIO,
    DRAW_ABCD_PATTERN_SCENARIO,
    DRAW_TRIANGLE_PATTERN_SCENARIO,
    DRAW_THREE_DRIVES_PATTERN_SCENARIO,
    DRAW_PATTERNS_ALL_SCENARIO,
    // Phase 3 Task 16 — Elliott Waves.
    DRAW_ELLIOTT_IMPULSE_WAVE_SCENARIO,
    DRAW_ELLIOTT_CORRECTION_WAVE_SCENARIO,
    DRAW_ELLIOTT_TRIANGLE_WAVE_SCENARIO,
    DRAW_ELLIOTT_DOUBLE_COMBO_SCENARIO,
    DRAW_ELLIOTT_TRIPLE_COMBO_SCENARIO,
    DRAW_ELLIOTT_ALL_SCENARIO,
    // Phase 3 Task 17 — Cycles.
    DRAW_CYCLIC_LINES_SCENARIO,
    DRAW_TIME_CYCLES_SCENARIO,
    DRAW_SINE_LINE_SCENARIO,
    DRAW_CYCLES_ALL_SCENARIO,
    // Phase 3 Task 18 — Containers.
    DRAW_GROUP_SCENARIO,
    DRAW_FRAME_SCENARIO,
    DRAW_CONTAINERS_ALL_SCENARIO,
    // Phase 5 Task 12 — viewport-anchored table drawing.
    DRAW_TABLE_HAPPY_SCENARIO,
    DRAW_TABLE_GATED_SCENARIO,
    // Phase 3 Task 19 — Smoke + budget overflow. `DRAW_UNSUPPORTED_KIND_SCENARIO`
    // and `DRAW_BUDGET_OVERFLOW_SCENARIO` are exported but intentionally
    // excluded — the bundled canvas2d reference adapter advertises every
    // kind and sizes `maxDrawingsPerScript.lines` at 200, so neither
    // `unsupported-drawing-kind` nor `drawing-budget-exceeded` can fire
    // through it. Adapter authors with a narrower capability bag opt in
    // via `runConformanceSuite(adapter, { scenarios: [...] })`. Both
    // scenarios are driven directly by `scenarios.test.ts` and
    // `runConformanceSuite.test.ts` under `TEST_CAPABILITIES` (100-cap
    // lines), where the diagnostics fire as designed.
    DRAW_ALL_61_SCENARIO,
    // Phase 3 Task 20 — `defineDrawing` constructor scenarios. All
    // three default-export through `defineDrawing` (not
    // `defineIndicator`) so the conformance suite exercises the
    // new manifest.kind = "drawing" path end-to-end.
    DEFINE_DRAWING_BASIC_SCENARIO,
    DRAW_INTERACTIVE_UPDATE_SCENARIO,
    DRAW_HANDLE_REMOVE_SCENARIO,
    // Phase 4 Task 16 — editor/runtime tier-1 surfaces.
    BARSTATE_CONFIRMED_SCENARIO,
    INPUT_INTERVAL_SCENARIO,
    REQUEST_SECURITY_NAN_FALLBACK_SCENARIO,
    MTF_REQUEST_SECURITY_CLOSE_SCENARIO,
    MTF_UNSUPPORTED_INTERVAL_SCENARIO,
    MTF_CAPABILITY_FALSE_SCENARIO,
    LOWER_TF_HAPPY_PATH_SCENARIO,
    LOWER_TF_UNSUPPORTED_INTERVAL_SCENARIO,
    LOWER_TF_CAPABILITY_FALSE_SCENARIO,
    STATE_SESSION_HIGH_SCENARIO,
    STATE_TICK_COUNTER_SCENARIO,
    SYMINFO_MINTICK_SCENARIO,
    TIMEFRAME_ISDAILY_SCENARIO,
    UNSUPPORTED_INTERVAL_SCENARIO,
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
