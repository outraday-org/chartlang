// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Scenario } from "../runConformanceSuite.js";

import { BAR_CLOSE_DIRECT_INDEX_SCENARIO } from "./barCloseDirectIndex.scenario.js";
import { BAR_POINT_TRACKING_LINE_SCENARIO } from "./barPointTrackingLine.scenario.js";
import { BARSTATE_CONFIRMED_SCENARIO } from "./barstateConfirmed.scenario.js";
import { BOLLINGER_BANDS_SCENARIO } from "./bollingerBands.scenario.js";
import { DEFINE_ALERT_CONDITION_FIRES_SCENARIO } from "./defineAlertConditionFires.scenario.js";
import { DEFINE_ALERT_CONDITION_GATED_SCENARIO } from "./defineAlertConditionGated.scenario.js";
import { DEFINE_ALERT_CONDITION_UNKNOWN_SCENARIO } from "./defineAlertConditionUnknown.scenario.js";
import { DEFINE_DRAWING_BASIC_SCENARIO } from "./defineDrawingBasic.scenario.js";
import { DEP_CROSS_FILE_SCENARIO } from "./depCrossFile.scenario.js";
import { DEP_CROSSOVER_GATE_SCENARIO } from "./depCrossoverGate.scenario.js";
import { DEP_DIAMOND_SCENARIO } from "./depDiamond.scenario.js";
import { DEP_ERROR_HALTS_PARENT_SCENARIO } from "./depErrorHaltsParent.scenario.js";
import { DEP_MULTI_EXPORT_SCENARIO } from "./depMultiExport.scenario.js";
import { DEP_PRIVATE_SINGLE_FILE_SCENARIO } from "./depPrivateSingleFile.scenario.js";
import { DRAW_ABCD_PATTERN_SCENARIO } from "./drawAbcdPattern.scenario.js";
import { DRAW_ALL_61_SCENARIO } from "./drawAll61.scenario.js";
import { DRAW_ANNOTATIONS_ALL_SCENARIO } from "./drawAnnotationsAll.scenario.js";
import { DRAW_ARC_SCENARIO } from "./drawArc.scenario.js";
import { DRAW_ARROW_SCENARIO } from "./drawArrow.scenario.js";
import { DRAW_ARROW_MARK_DOWN_SCENARIO } from "./drawArrowMarkDown.scenario.js";
import { DRAW_ARROW_MARK_UP_SCENARIO } from "./drawArrowMarkUp.scenario.js";
import { DRAW_ARROW_MARKER_SCENARIO } from "./drawArrowMarker.scenario.js";
import { DRAW_BOXES_ALL_SCENARIO } from "./drawBoxesAll.scenario.js";
import { DRAW_BRUSH_SCENARIO } from "./drawBrush.scenario.js";
import { DRAW_CHANNELS_ALL_SCENARIO } from "./drawChannelsAll.scenario.js";
import { DRAW_CIRCLE_SCENARIO } from "./drawCircle.scenario.js";
import { DRAW_CONTAINERS_ALL_SCENARIO } from "./drawContainersAll.scenario.js";
import { DRAW_CROSS_LINE_SCENARIO } from "./drawCrossLine.scenario.js";
import { DRAW_CURVE_SCENARIO } from "./drawCurve.scenario.js";
import { DRAW_CURVES_AND_FREEHAND_ALL_SCENARIO } from "./drawCurvesAndFreehandAll.scenario.js";
import { DRAW_CYCLES_ALL_SCENARIO } from "./drawCyclesAll.scenario.js";
import { DRAW_CYCLIC_LINES_SCENARIO } from "./drawCyclicLines.scenario.js";
import { DRAW_CYPHER_PATTERN_SCENARIO } from "./drawCypherPattern.scenario.js";
import { DRAW_DISJOINT_CHANNEL_SCENARIO } from "./drawDisjointChannel.scenario.js";
import { DRAW_DOUBLE_CURVE_SCENARIO } from "./drawDoubleCurve.scenario.js";
import { DRAW_ELLIOTT_ALL_SCENARIO } from "./drawElliottAll.scenario.js";
import { DRAW_ELLIOTT_CORRECTION_WAVE_SCENARIO } from "./drawElliottCorrectionWave.scenario.js";
import { DRAW_ELLIOTT_DOUBLE_COMBO_SCENARIO } from "./drawElliottDoubleCombo.scenario.js";
import { DRAW_ELLIOTT_IMPULSE_WAVE_SCENARIO } from "./drawElliottImpulseWave.scenario.js";
import { DRAW_ELLIOTT_TRIANGLE_WAVE_SCENARIO } from "./drawElliottTriangleWave.scenario.js";
import { DRAW_ELLIOTT_TRIPLE_COMBO_SCENARIO } from "./drawElliottTripleCombo.scenario.js";
import { DRAW_ELLIPSE_SCENARIO } from "./drawEllipse.scenario.js";
import { DRAW_FIB_ALL_SCENARIO } from "./drawFibAll.scenario.js";
import { DRAW_FIB_CHANNEL_SCENARIO } from "./drawFibChannel.scenario.js";
import { DRAW_FIB_CIRCLES_SCENARIO } from "./drawFibCircles.scenario.js";
import { DRAW_FIB_RETRACEMENT_SCENARIO } from "./drawFibRetracement.scenario.js";
import { DRAW_FIB_SPEED_ARCS_SCENARIO } from "./drawFibSpeedArcs.scenario.js";
import { DRAW_FIB_SPEED_FAN_SCENARIO } from "./drawFibSpeedFan.scenario.js";
import { DRAW_FIB_SPIRAL_SCENARIO } from "./drawFibSpiral.scenario.js";
import { DRAW_FIB_TIME_ZONE_SCENARIO } from "./drawFibTimeZone.scenario.js";
import { DRAW_FIB_TREND_EXTENSION_SCENARIO } from "./drawFibTrendExtension.scenario.js";
import { DRAW_FIB_TREND_TIME_SCENARIO } from "./drawFibTrendTime.scenario.js";
import { DRAW_FIB_WEDGE_SCENARIO } from "./drawFibWedge.scenario.js";
import { DRAW_FILL_BETWEEN_SCENARIO } from "./drawFillBetween.scenario.js";
import { DRAW_FLAT_TOP_BOTTOM_SCENARIO } from "./drawFlatTopBottom.scenario.js";
import { DRAW_FRAME_SCENARIO } from "./drawFrame.scenario.js";
import { DRAW_GANN_ALL_SCENARIO } from "./drawGannAll.scenario.js";
import { DRAW_GANN_BOX_SCENARIO } from "./drawGannBox.scenario.js";
import { DRAW_GANN_FAN_SCENARIO } from "./drawGannFan.scenario.js";
import { DRAW_GANN_SQUARE_SCENARIO } from "./drawGannSquare.scenario.js";
import { DRAW_GANN_SQUARE_FIXED_SCENARIO } from "./drawGannSquareFixed.scenario.js";
import { DRAW_GROUP_SCENARIO } from "./drawGroup.scenario.js";
import { DRAW_HANDLE_REMOVE_SCENARIO } from "./drawHandleRemove.scenario.js";
import { DRAW_HEAD_AND_SHOULDERS_SCENARIO } from "./drawHeadAndShoulders.scenario.js";
import { DRAW_HIGHLIGHTER_SCENARIO } from "./drawHighlighter.scenario.js";
import { DRAW_HORIZONTAL_LINE_SCENARIO } from "./drawHorizontalLine.scenario.js";
import { DRAW_HORIZONTAL_RAY_SCENARIO } from "./drawHorizontalRay.scenario.js";
import { DRAW_INTERACTIVE_UPDATE_SCENARIO } from "./drawInteractiveUpdate.scenario.js";
import { DRAW_LINE_SCENARIO } from "./drawLine.scenario.js";
import { DRAW_LINES_AND_RAYS_SCENARIO } from "./drawLinesAndRays.scenario.js";
import { DRAW_MARKER_SCENARIO } from "./drawMarker.scenario.js";
import { DRAW_PATH_SCENARIO } from "./drawPath.scenario.js";
import { DRAW_PATTERNS_ALL_SCENARIO } from "./drawPatternsAll.scenario.js";
import { DRAW_PEN_SCENARIO } from "./drawPen.scenario.js";
import { DRAW_PITCHFAN_SCENARIO } from "./drawPitchfan.scenario.js";
import { DRAW_PITCHFORK_SCENARIO } from "./drawPitchfork.scenario.js";
import { DRAW_PITCHFORKS_ALL_SCENARIO } from "./drawPitchforksAll.scenario.js";
import { DRAW_POLYLINE_SCENARIO } from "./drawPolyline.scenario.js";
import { DRAW_RECTANGLE_SCENARIO } from "./drawRectangle.scenario.js";
import { DRAW_REGRESSION_TREND_SCENARIO } from "./drawRegressionTrend.scenario.js";
import { DRAW_ROTATED_RECTANGLE_SCENARIO } from "./drawRotatedRectangle.scenario.js";
import { DRAW_SINE_LINE_SCENARIO } from "./drawSineLine.scenario.js";
import { DRAW_TABLE_GATED_SCENARIO } from "./drawTableGated.scenario.js";
import { DRAW_TABLE_HAPPY_SCENARIO } from "./drawTableHappy.scenario.js";
import { DRAW_TEXT_SCENARIO } from "./drawText.scenario.js";
import { DRAW_THREE_DRIVES_PATTERN_SCENARIO } from "./drawThreeDrivesPattern.scenario.js";
import { DRAW_TIME_CYCLES_SCENARIO } from "./drawTimeCycles.scenario.js";
import { DRAW_TREND_ANGLE_SCENARIO } from "./drawTrendAngle.scenario.js";
import { DRAW_TREND_CHANNEL_SCENARIO } from "./drawTrendChannel.scenario.js";
import { DRAW_TRIANGLE_SCENARIO } from "./drawTriangle.scenario.js";
import { DRAW_TRIANGLE_PATTERN_SCENARIO } from "./drawTrianglePattern.scenario.js";
import { DRAW_VERTICAL_LINE_SCENARIO } from "./drawVerticalLine.scenario.js";
import { DRAW_XABCD_PATTERN_SCENARIO } from "./drawXabcdPattern.scenario.js";
import { EMA_CROSS_SCENARIO } from "./emaCross.scenario.js";
import { INPUT_INTERVAL_SCENARIO } from "./inputInterval.scenario.js";
import { LOOP_SMA_SCENARIO } from "./loopSma.scenario.js";
import { LOWER_TF_CAPABILITY_FALSE_SCENARIO } from "./lowerTfCapabilityFalse.scenario.js";
import { LOWER_TF_HAPPY_PATH_SCENARIO } from "./lowerTfHappyPath.scenario.js";
import { LOWER_TF_UNSUPPORTED_INTERVAL_SCENARIO } from "./lowerTfUnsupportedInterval.scenario.js";
import { MTF_CAPABILITY_FALSE_SCENARIO } from "./mtfCapabilityFalse.scenario.js";
import { MTF_REQUEST_SECURITY_CLOSE_SCENARIO } from "./mtfRequestSecurityClose.scenario.js";
import { MTF_SECURITY_EXPRESSION_EMA_SCENARIO } from "./mtfSecurityExpressionEma.scenario.js";
import { MTF_SECURITY_EXPRESSION_NAN_FALLBACK_SCENARIO } from "./mtfSecurityExpressionNanFallback.scenario.js";
import { MTF_UNSUPPORTED_INTERVAL_SCENARIO } from "./mtfUnsupportedInterval.scenario.js";
import { PLOT_KIND_ARROW_SCENARIO } from "./plotKindArrow.scenario.js";
import { PLOT_KIND_ARROW_GATED_SCENARIO } from "./plotKindArrowGated.scenario.js";
import { PLOT_KIND_BAR_COLOR_SCENARIO } from "./plotKindBarColor.scenario.js";
import { PLOT_KIND_BAR_COLOR_GATED_SCENARIO } from "./plotKindBarColorGated.scenario.js";
import { PLOT_KIND_BAR_OVERRIDE_SCENARIO } from "./plotKindBarOverride.scenario.js";
import { PLOT_KIND_BAR_OVERRIDE_GATED_SCENARIO } from "./plotKindBarOverrideGated.scenario.js";
import { PLOT_KIND_BG_COLOR_SCENARIO } from "./plotKindBgColor.scenario.js";
import { PLOT_KIND_BG_COLOR_GATED_SCENARIO } from "./plotKindBgColorGated.scenario.js";
import { PLOT_KIND_CANDLE_OVERRIDE_SCENARIO } from "./plotKindCandleOverride.scenario.js";
import { PLOT_KIND_CANDLE_OVERRIDE_GATED_SCENARIO } from "./plotKindCandleOverrideGated.scenario.js";
import { PLOT_KIND_CHARACTER_SCENARIO } from "./plotKindCharacter.scenario.js";
import { PLOT_KIND_CHARACTER_GATED_SCENARIO } from "./plotKindCharacterGated.scenario.js";
import { PLOT_KIND_COVERAGE_SCENARIO } from "./plotKindCoverage.scenario.js";
import { PLOT_KIND_HORIZONTAL_HISTOGRAM_SCENARIO } from "./plotKindHorizontalHistogram.scenario.js";
import { PLOT_KIND_HORIZONTAL_HISTOGRAM_GATED_SCENARIO } from "./plotKindHorizontalHistogramGated.scenario.js";
import { PLOT_KIND_SHAPE_SCENARIO } from "./plotKindShape.scenario.js";
import { PLOT_KIND_SHAPE_GATED_SCENARIO } from "./plotKindShapeGated.scenario.js";
import { PINE_CONVERTER_ROUND_TRIP_CAMP_A_SCENARIO } from "./pineConverterRoundTripCampA.scenario.js";
import { PINE_CONVERTER_ROUND_TRIP_CAMP_B_SCENARIO } from "./pineConverterRoundTripCampB.scenario.js";
import { PINE_CONVERTER_ROUND_TRIP_TABLE_SCENARIO } from "./pineConverterRoundTripTable.scenario.js";
import { PINE_CONVERTER_ROUND_TRIP_VAR_SERIES_SCENARIO } from "./pineConverterRoundTripVarSeries.scenario.js";
import { PLOT_OFFSET_XSHIFT_SCENARIO } from "./plotOffsetXshift.scenario.js";
import { PLOT_STYLE_OVERRIDES_SCENARIO } from "./plotStyleOverrides.scenario.js";
import { REQUEST_SECURITY_NAN_FALLBACK_SCENARIO } from "./requestSecurityNanFallback.scenario.js";
import { RSI_DIVERGENCE_SCENARIO } from "./rsiDivergenceAlert.scenario.js";
import { RSI_SUBPANE_ROUTING_SCENARIO } from "./rsiSubpaneRouting.scenario.js";
import { RUNTIME_ERROR_SCENARIO } from "./runtimeError.scenario.js";
import { RUNTIME_LOG_BUDGET_SCENARIO } from "./runtimeLogBudget.scenario.js";
import { RUNTIME_LOG_GATED_SCENARIO } from "./runtimeLogGated.scenario.js";
import { RUNTIME_LOG_INFO_SCENARIO } from "./runtimeLogInfo.scenario.js";
import { STATE_SERIES_HISTORY_SCENARIO } from "./stateSeriesHistory.scenario.js";
import { STATE_SESSION_HIGH_SCENARIO } from "./stateSessionHigh.scenario.js";
import { STATE_TICK_COUNTER_SCENARIO } from "./stateTickCounter.scenario.js";
import { SYMINFO_MINTICK_SCENARIO } from "./syminfoMintick.scenario.js";
import { TA_ADL_SCENARIO } from "./taAdl.scenario.js";
import { TA_ADR_SCENARIO } from "./taAdr.scenario.js";
import { TA_ADX_SCENARIO } from "./taAdx.scenario.js";
import { TA_ALMA_SCENARIO } from "./taAlma.scenario.js";
import { TA_ANCHORED_VOLUME_PROFILE_SCENARIO } from "./taAnchoredVolumeProfile.scenario.js";
import { TA_ANCHORED_VOLUME_PROFILE_GATED_SCENARIO } from "./taAnchoredVolumeProfileGated.scenario.js";
import { TA_ANCHORED_VWAP_SCENARIO } from "./taAnchoredVwap.scenario.js";
import { TA_AO_SCENARIO } from "./taAo.scenario.js";
import { TA_AROON_SCENARIO } from "./taAroon.scenario.js";
import { TA_AROON_OSC_SCENARIO } from "./taAroonOsc.scenario.js";
import { TA_ATR_SCENARIO } from "./taAtr.scenario.js";
import { TA_BARSSINCE_SCENARIO } from "./taBarssince.scenario.js";
import { TA_BB_SCENARIO } from "./taBb.scenario.js";
import { TA_BB_PERCENT_B_SCENARIO } from "./taBbPercentB.scenario.js";
import { TA_BBW_SCENARIO } from "./taBbw.scenario.js";
import { TA_BOP_SCENARIO } from "./taBop.scenario.js";
import { TA_CCI_SCENARIO } from "./taCci.scenario.js";
import { TA_CHAIKIN_OSC_SCENARIO } from "./taChaikinOsc.scenario.js";
import { TA_CHANDE_KROLL_STOP_SCENARIO } from "./taChandeKrollStop.scenario.js";
import { TA_CHANDELIER_SCENARIO } from "./taChandelier.scenario.js";
import { TA_CHANGE_SCENARIO } from "./taChange.scenario.js";
import { TA_CHOP_SCENARIO } from "./taChop.scenario.js";
import { TA_CMF_SCENARIO } from "./taCmf.scenario.js";
import { TA_CMO_SCENARIO } from "./taCmo.scenario.js";
import { TA_CONNORS_RSI_SCENARIO } from "./taConnorsRsi.scenario.js";
import { TA_COPPOCK_SCENARIO } from "./taCoppock.scenario.js";
import { TA_CROSSOVER_SCENARIO } from "./taCrossover.scenario.js";
import { TA_CROSSUNDER_SCENARIO } from "./taCrossunder.scenario.js";
import { TA_DEMA_SCENARIO } from "./taDema.scenario.js";
import { TA_DMI_SCENARIO } from "./taDmi.scenario.js";
import { TA_DONCHIAN_SCENARIO } from "./taDonchian.scenario.js";
import { TA_DPO_SCENARIO } from "./taDpo.scenario.js";
import { TA_EMA_SCENARIO } from "./taEma.scenario.js";
import { TA_ENVELOPE_SCENARIO } from "./taEnvelope.scenario.js";
import { TA_EOM_SCENARIO } from "./taEom.scenario.js";
import { TA_FISHER_SCENARIO } from "./taFisher.scenario.js";
import { TA_FIXED_RANGE_VOLUME_PROFILE_SCENARIO } from "./taFixedRangeVolumeProfile.scenario.js";
import { TA_FIXED_RANGE_VOLUME_PROFILE_GATED_SCENARIO } from "./taFixedRangeVolumeProfileGated.scenario.js";
import { TA_FIXED_RANGE_VOLUME_PROFILE_INVERTED_SCENARIO } from "./taFixedRangeVolumeProfileInverted.scenario.js";
import { TA_HIGHEST_SCENARIO } from "./taHighest.scenario.js";
import { TA_HIGHEST_LOWEST_BARS_SCENARIO } from "./taHighestLowestBars.scenario.js";
import { TA_HISTORICAL_VOLATILITY_SCENARIO } from "./taHistoricalVolatility.scenario.js";
import { TA_HMA_SCENARIO } from "./taHma.scenario.js";
import { TA_ICHIMOKU_SCENARIO } from "./taIchimoku.scenario.js";
import { TA_KAMA_SCENARIO } from "./taKama.scenario.js";
import { TA_KELTNER_SCENARIO } from "./taKeltner.scenario.js";
import { TA_KLINGER_SCENARIO } from "./taKlinger.scenario.js";
import { TA_KST_SCENARIO } from "./taKst.scenario.js";
import { TA_LOWEST_SCENARIO } from "./taLowest.scenario.js";
import { TA_LSMA_SCENARIO } from "./taLsma.scenario.js";
import { TA_MA_RIBBON_SCENARIO } from "./taMaRibbon.scenario.js";
import { TA_MACD_SCENARIO } from "./taMacd.scenario.js";
import { TA_MASS_INDEX_SCENARIO } from "./taMassIndex.scenario.js";
import { TA_MCGINLEY_SCENARIO } from "./taMcginley.scenario.js";
import { TA_MEDIAN_SCENARIO } from "./taMedian.scenario.js";
import { TA_MFI_SCENARIO } from "./taMfi.scenario.js";
import { TA_MOMENTUM_SCENARIO } from "./taMomentum.scenario.js";
import { TA_NET_VOLUME_SCENARIO } from "./taNetVolume.scenario.js";
import { TA_NVI_SCENARIO } from "./taNvi.scenario.js";
import { TA_NZ_SCENARIO } from "./taNz.scenario.js";
import { TA_OBV_SCENARIO } from "./taObv.scenario.js";
import { TA_PIVOTS_HIGH_LOW_SCENARIO } from "./taPivotsHighLow.scenario.js";
import { TA_PIVOTS_STANDARD_SCENARIO } from "./taPivotsStandard.scenario.js";
import { TA_PMO_SCENARIO } from "./taPmo.scenario.js";
import { TA_PPO_SCENARIO } from "./taPpo.scenario.js";
import { TA_PSAR_SCENARIO } from "./taPsar.scenario.js";
import { TA_PVI_SCENARIO } from "./taPvi.scenario.js";
import { TA_PVO_SCENARIO } from "./taPvo.scenario.js";
import { TA_PVT_SCENARIO } from "./taPvt.scenario.js";
import { TA_ROC_SCENARIO } from "./taRoc.scenario.js";
import { TA_RSI_SCENARIO } from "./taRsi.scenario.js";
import { TA_RVGI_SCENARIO } from "./taRvgi.scenario.js";
import { TA_RVI_SCENARIO } from "./taRvi.scenario.js";
import { TA_SESSION_VOLUME_PROFILE_SCENARIO } from "./taSessionVolumeProfile.scenario.js";
import { TA_SESSION_VOLUME_PROFILE_GATED_SCENARIO } from "./taSessionVolumeProfileGated.scenario.js";
import { TA_SESSION_VOLUME_PROFILE_NO_SESSION_SCENARIO } from "./taSessionVolumeProfileNoSession.scenario.js";
import { TA_SMA_SCENARIO } from "./taSma.scenario.js";
import { TA_SMI_SCENARIO } from "./taSmi.scenario.js";
import { TA_SMMA_SCENARIO } from "./taSmma.scenario.js";
import { TA_STDEV_SCENARIO } from "./taStdev.scenario.js";
import { TA_STOCH_SCENARIO } from "./taStoch.scenario.js";
import { TA_STOCH_RSI_SCENARIO } from "./taStochRsi.scenario.js";
import { TA_SUPERTREND_SCENARIO } from "./taSupertrend.scenario.js";
import { TA_TEMA_SCENARIO } from "./taTema.scenario.js";
import { TA_TREND_STRENGTH_INDEX_SCENARIO } from "./taTrendStrengthIndex.scenario.js";
import { TA_TRIX_SCENARIO } from "./taTrix.scenario.js";
import { TA_TSI_SCENARIO } from "./taTsi.scenario.js";
import { TA_ULCER_INDEX_SCENARIO } from "./taUlcerIndex.scenario.js";
import { TA_ULTIMATE_OSC_SCENARIO } from "./taUltimateOsc.scenario.js";
import { TA_VALUEWHEN_SCENARIO } from "./taValuewhen.scenario.js";
import { TA_VISIBLE_RANGE_VOLUME_PROFILE_SCENARIO } from "./taVisibleRangeVolumeProfile.scenario.js";
import { TA_VISIBLE_RANGE_VOLUME_PROFILE_GATED_SCENARIO } from "./taVisibleRangeVolumeProfileGated.scenario.js";
import { TA_VOL_SCENARIO } from "./taVol.scenario.js";
import { TA_VOLATILITY_STOP_SCENARIO } from "./taVolatilityStop.scenario.js";
import { TA_VORTEX_SCENARIO } from "./taVortex.scenario.js";
import { TA_VWAP_SCENARIO } from "./taVwap.scenario.js";
import { TA_VWMA_SCENARIO } from "./taVwma.scenario.js";
import { TA_WILLIAMS_FRACTAL_SCENARIO } from "./taWilliamsFractal.scenario.js";
import { TA_WILLIAMS_R_SCENARIO } from "./taWilliamsR.scenario.js";
import { TA_WMA_SCENARIO } from "./taWma.scenario.js";
import { TA_ZIG_ZAG_SCENARIO } from "./taZigZag.scenario.js";
import { TIMEFRAME_ISDAILY_SCENARIO } from "./timeframeIsdaily.scenario.js";
import { UNSUPPORTED_INTERVAL_SCENARIO } from "./unsupportedInterval.scenario.js";
import { Z_ORDER_SCENARIO } from "./zOrder.scenario.js";

export { BAR_CLOSE_DIRECT_INDEX_SCENARIO } from "./barCloseDirectIndex.scenario.js";
export { BAR_POINT_TRACKING_LINE_SCENARIO } from "./barPointTrackingLine.scenario.js";
export { BARSTATE_CONFIRMED_SCENARIO } from "./barstateConfirmed.scenario.js";
export { BOLLINGER_BANDS_SCENARIO } from "./bollingerBands.scenario.js";
export { DEFINE_ALERT_CONDITION_FIRES_SCENARIO } from "./defineAlertConditionFires.scenario.js";
export { DEFINE_ALERT_CONDITION_GATED_SCENARIO } from "./defineAlertConditionGated.scenario.js";
export { DEFINE_ALERT_CONDITION_UNKNOWN_SCENARIO } from "./defineAlertConditionUnknown.scenario.js";
export { DEFINE_DRAWING_BASIC_SCENARIO } from "./defineDrawingBasic.scenario.js";
export { DEP_CROSS_FILE_SCENARIO } from "./depCrossFile.scenario.js";
export { DEP_CROSSOVER_GATE_SCENARIO } from "./depCrossoverGate.scenario.js";
export { DEP_DIAMOND_SCENARIO } from "./depDiamond.scenario.js";
export { DEP_ERROR_HALTS_PARENT_SCENARIO } from "./depErrorHaltsParent.scenario.js";
export { DEP_MULTI_EXPORT_SCENARIO } from "./depMultiExport.scenario.js";
export { DEP_PRIVATE_SINGLE_FILE_SCENARIO } from "./depPrivateSingleFile.scenario.js";
export { DRAW_ANNOTATIONS_ALL_SCENARIO } from "./drawAnnotationsAll.scenario.js";
export { DRAW_ARC_SCENARIO } from "./drawArc.scenario.js";
export { DRAW_ARROW_SCENARIO } from "./drawArrow.scenario.js";
export { DRAW_ARROW_MARK_DOWN_SCENARIO } from "./drawArrowMarkDown.scenario.js";
export { DRAW_ARROW_MARK_UP_SCENARIO } from "./drawArrowMarkUp.scenario.js";
export { DRAW_ARROW_MARKER_SCENARIO } from "./drawArrowMarker.scenario.js";
export { DRAW_BOXES_ALL_SCENARIO } from "./drawBoxesAll.scenario.js";
export { DRAW_BRUSH_SCENARIO } from "./drawBrush.scenario.js";
export { DRAW_CHANNELS_ALL_SCENARIO } from "./drawChannelsAll.scenario.js";
export { DRAW_CIRCLE_SCENARIO } from "./drawCircle.scenario.js";
export { DRAW_CROSS_LINE_SCENARIO } from "./drawCrossLine.scenario.js";
export { DRAW_CURVE_SCENARIO } from "./drawCurve.scenario.js";
export { DRAW_CURVES_AND_FREEHAND_ALL_SCENARIO } from "./drawCurvesAndFreehandAll.scenario.js";
export { DRAW_DISJOINT_CHANNEL_SCENARIO } from "./drawDisjointChannel.scenario.js";
export { DRAW_DOUBLE_CURVE_SCENARIO } from "./drawDoubleCurve.scenario.js";
export { DRAW_ELLIPSE_SCENARIO } from "./drawEllipse.scenario.js";
export { DRAW_FIB_ALL_SCENARIO } from "./drawFibAll.scenario.js";
export { DRAW_FIB_CHANNEL_SCENARIO } from "./drawFibChannel.scenario.js";
export { DRAW_FIB_CIRCLES_SCENARIO } from "./drawFibCircles.scenario.js";
export { DRAW_FIB_RETRACEMENT_SCENARIO } from "./drawFibRetracement.scenario.js";
export { DRAW_FIB_SPEED_ARCS_SCENARIO } from "./drawFibSpeedArcs.scenario.js";
export { DRAW_FIB_SPEED_FAN_SCENARIO } from "./drawFibSpeedFan.scenario.js";
export { DRAW_FIB_SPIRAL_SCENARIO } from "./drawFibSpiral.scenario.js";
export { DRAW_FIB_TIME_ZONE_SCENARIO } from "./drawFibTimeZone.scenario.js";
export { DRAW_FIB_TREND_EXTENSION_SCENARIO } from "./drawFibTrendExtension.scenario.js";
export { DRAW_FIB_TREND_TIME_SCENARIO } from "./drawFibTrendTime.scenario.js";
export { DRAW_FIB_WEDGE_SCENARIO } from "./drawFibWedge.scenario.js";
export { DRAW_FILL_BETWEEN_SCENARIO } from "./drawFillBetween.scenario.js";
export { DRAW_GANN_ALL_SCENARIO } from "./drawGannAll.scenario.js";
export { DRAW_GANN_BOX_SCENARIO } from "./drawGannBox.scenario.js";
export { DRAW_GANN_FAN_SCENARIO } from "./drawGannFan.scenario.js";
export { DRAW_GANN_SQUARE_SCENARIO } from "./drawGannSquare.scenario.js";
export { DRAW_GANN_SQUARE_FIXED_SCENARIO } from "./drawGannSquareFixed.scenario.js";
export { DRAW_FLAT_TOP_BOTTOM_SCENARIO } from "./drawFlatTopBottom.scenario.js";
export { DRAW_HIGHLIGHTER_SCENARIO } from "./drawHighlighter.scenario.js";
export { DRAW_HORIZONTAL_LINE_SCENARIO } from "./drawHorizontalLine.scenario.js";
export { DRAW_HORIZONTAL_RAY_SCENARIO } from "./drawHorizontalRay.scenario.js";
export { DRAW_LINE_SCENARIO } from "./drawLine.scenario.js";
export { DRAW_LINES_AND_RAYS_SCENARIO } from "./drawLinesAndRays.scenario.js";
export { DRAW_MARKER_SCENARIO } from "./drawMarker.scenario.js";
export { DRAW_PATH_SCENARIO } from "./drawPath.scenario.js";
export { DRAW_PEN_SCENARIO } from "./drawPen.scenario.js";
export { DRAW_PITCHFAN_SCENARIO } from "./drawPitchfan.scenario.js";
export { DRAW_PITCHFORK_SCENARIO } from "./drawPitchfork.scenario.js";
export { DRAW_PITCHFORKS_ALL_SCENARIO } from "./drawPitchforksAll.scenario.js";
export { DRAW_ABCD_PATTERN_SCENARIO } from "./drawAbcdPattern.scenario.js";
export { DRAW_ALL_61_SCENARIO } from "./drawAll61.scenario.js";
export { DRAW_BUDGET_OVERFLOW_SCENARIO } from "./drawBudgetOverflow.scenario.js";
export { DRAW_UNSUPPORTED_KIND_SCENARIO } from "./drawUnsupportedKind.scenario.js";
export { DRAW_CYPHER_PATTERN_SCENARIO } from "./drawCypherPattern.scenario.js";
export { DRAW_HEAD_AND_SHOULDERS_SCENARIO } from "./drawHeadAndShoulders.scenario.js";
export { DRAW_PATTERNS_ALL_SCENARIO } from "./drawPatternsAll.scenario.js";
export { DRAW_THREE_DRIVES_PATTERN_SCENARIO } from "./drawThreeDrivesPattern.scenario.js";
export { DRAW_TRIANGLE_PATTERN_SCENARIO } from "./drawTrianglePattern.scenario.js";
export { DRAW_XABCD_PATTERN_SCENARIO } from "./drawXabcdPattern.scenario.js";
export { DRAW_ELLIOTT_ALL_SCENARIO } from "./drawElliottAll.scenario.js";
export { DRAW_ELLIOTT_CORRECTION_WAVE_SCENARIO } from "./drawElliottCorrectionWave.scenario.js";
export { DRAW_ELLIOTT_DOUBLE_COMBO_SCENARIO } from "./drawElliottDoubleCombo.scenario.js";
export { DRAW_ELLIOTT_IMPULSE_WAVE_SCENARIO } from "./drawElliottImpulseWave.scenario.js";
export { DRAW_ELLIOTT_TRIANGLE_WAVE_SCENARIO } from "./drawElliottTriangleWave.scenario.js";
export { DRAW_ELLIOTT_TRIPLE_COMBO_SCENARIO } from "./drawElliottTripleCombo.scenario.js";
export { DRAW_CYCLES_ALL_SCENARIO } from "./drawCyclesAll.scenario.js";
export { DRAW_CYCLIC_LINES_SCENARIO } from "./drawCyclicLines.scenario.js";
export { DRAW_SINE_LINE_SCENARIO } from "./drawSineLine.scenario.js";
export { DRAW_TIME_CYCLES_SCENARIO } from "./drawTimeCycles.scenario.js";
export { DRAW_CONTAINERS_ALL_SCENARIO } from "./drawContainersAll.scenario.js";
export { DRAW_FRAME_SCENARIO } from "./drawFrame.scenario.js";
export { DRAW_GROUP_SCENARIO } from "./drawGroup.scenario.js";
export { DRAW_TABLE_GATED_SCENARIO } from "./drawTableGated.scenario.js";
export { DRAW_TABLE_HAPPY_SCENARIO } from "./drawTableHappy.scenario.js";
export { DRAW_HANDLE_REMOVE_SCENARIO } from "./drawHandleRemove.scenario.js";
export { DRAW_INTERACTIVE_UPDATE_SCENARIO } from "./drawInteractiveUpdate.scenario.js";
export { DRAW_POLYLINE_SCENARIO } from "./drawPolyline.scenario.js";
export { DRAW_RECTANGLE_SCENARIO } from "./drawRectangle.scenario.js";
export { DRAW_REGRESSION_TREND_SCENARIO } from "./drawRegressionTrend.scenario.js";
export { DRAW_ROTATED_RECTANGLE_SCENARIO } from "./drawRotatedRectangle.scenario.js";
export { DRAW_TREND_ANGLE_SCENARIO } from "./drawTrendAngle.scenario.js";
export { DRAW_TEXT_SCENARIO } from "./drawText.scenario.js";
export { DRAW_TREND_CHANNEL_SCENARIO } from "./drawTrendChannel.scenario.js";
export { DRAW_TRIANGLE_SCENARIO } from "./drawTriangle.scenario.js";
export { DRAW_VERTICAL_LINE_SCENARIO } from "./drawVerticalLine.scenario.js";
export { EMA_CROSS_SCENARIO } from "./emaCross.scenario.js";
export { INPUT_INTERVAL_SCENARIO } from "./inputInterval.scenario.js";
export { LOOP_SMA_SCENARIO } from "./loopSma.scenario.js";
export { LOWER_TF_CAPABILITY_FALSE_SCENARIO } from "./lowerTfCapabilityFalse.scenario.js";
export { LOWER_TF_HAPPY_PATH_SCENARIO } from "./lowerTfHappyPath.scenario.js";
export { LOWER_TF_UNSUPPORTED_INTERVAL_SCENARIO } from "./lowerTfUnsupportedInterval.scenario.js";
export { MTF_CAPABILITY_FALSE_SCENARIO } from "./mtfCapabilityFalse.scenario.js";
export { MTF_REQUEST_SECURITY_CLOSE_SCENARIO } from "./mtfRequestSecurityClose.scenario.js";
export { MTF_SECURITY_EXPRESSION_EMA_SCENARIO } from "./mtfSecurityExpressionEma.scenario.js";
export { MTF_SECURITY_EXPRESSION_NAN_FALLBACK_SCENARIO } from "./mtfSecurityExpressionNanFallback.scenario.js";
export { MTF_UNSUPPORTED_INTERVAL_SCENARIO } from "./mtfUnsupportedInterval.scenario.js";
export { PLOT_KIND_ARROW_SCENARIO } from "./plotKindArrow.scenario.js";
export { PLOT_KIND_ARROW_GATED_SCENARIO } from "./plotKindArrowGated.scenario.js";
export { PLOT_KIND_BAR_COLOR_SCENARIO } from "./plotKindBarColor.scenario.js";
export { PLOT_KIND_BAR_COLOR_GATED_SCENARIO } from "./plotKindBarColorGated.scenario.js";
export { PLOT_KIND_BAR_OVERRIDE_SCENARIO } from "./plotKindBarOverride.scenario.js";
export { PLOT_KIND_BAR_OVERRIDE_GATED_SCENARIO } from "./plotKindBarOverrideGated.scenario.js";
export { PLOT_KIND_BG_COLOR_SCENARIO } from "./plotKindBgColor.scenario.js";
export { PLOT_KIND_BG_COLOR_GATED_SCENARIO } from "./plotKindBgColorGated.scenario.js";
export { PLOT_KIND_CANDLE_OVERRIDE_SCENARIO } from "./plotKindCandleOverride.scenario.js";
export { PLOT_KIND_CANDLE_OVERRIDE_GATED_SCENARIO } from "./plotKindCandleOverrideGated.scenario.js";
export { PLOT_KIND_CHARACTER_SCENARIO } from "./plotKindCharacter.scenario.js";
export { PLOT_KIND_CHARACTER_GATED_SCENARIO } from "./plotKindCharacterGated.scenario.js";
export { PLOT_KIND_COVERAGE_SCENARIO } from "./plotKindCoverage.scenario.js";
export { PLOT_KIND_HORIZONTAL_HISTOGRAM_SCENARIO } from "./plotKindHorizontalHistogram.scenario.js";
export { PLOT_KIND_HORIZONTAL_HISTOGRAM_GATED_SCENARIO } from "./plotKindHorizontalHistogramGated.scenario.js";
export { PLOT_KIND_SHAPE_SCENARIO } from "./plotKindShape.scenario.js";
export { PLOT_KIND_SHAPE_GATED_SCENARIO } from "./plotKindShapeGated.scenario.js";
export { PINE_CONVERTER_ROUND_TRIP_CAMP_A_SCENARIO } from "./pineConverterRoundTripCampA.scenario.js";
export { PINE_CONVERTER_ROUND_TRIP_CAMP_B_SCENARIO } from "./pineConverterRoundTripCampB.scenario.js";
export { PINE_CONVERTER_ROUND_TRIP_TABLE_SCENARIO } from "./pineConverterRoundTripTable.scenario.js";
export { PINE_CONVERTER_ROUND_TRIP_VAR_SERIES_SCENARIO } from "./pineConverterRoundTripVarSeries.scenario.js";
export { PLOT_OFFSET_XSHIFT_SCENARIO } from "./plotOffsetXshift.scenario.js";
export { PLOT_STYLE_OVERRIDES_SCENARIO } from "./plotStyleOverrides.scenario.js";
export { REQUEST_SECURITY_NAN_FALLBACK_SCENARIO } from "./requestSecurityNanFallback.scenario.js";
export { RSI_DIVERGENCE_SCENARIO } from "./rsiDivergenceAlert.scenario.js";
export { RSI_SUBPANE_ROUTING_SCENARIO } from "./rsiSubpaneRouting.scenario.js";
export { RUNTIME_ERROR_SCENARIO } from "./runtimeError.scenario.js";
export { RUNTIME_LOG_BUDGET_SCENARIO } from "./runtimeLogBudget.scenario.js";
export { RUNTIME_LOG_GATED_SCENARIO } from "./runtimeLogGated.scenario.js";
export { RUNTIME_LOG_INFO_SCENARIO } from "./runtimeLogInfo.scenario.js";
export { STATE_SERIES_HISTORY_SCENARIO } from "./stateSeriesHistory.scenario.js";
export { STATE_SESSION_HIGH_SCENARIO } from "./stateSessionHigh.scenario.js";
export { STATE_TICK_COUNTER_SCENARIO } from "./stateTickCounter.scenario.js";
export { SYMINFO_MINTICK_SCENARIO } from "./syminfoMintick.scenario.js";
export { TA_ADL_SCENARIO } from "./taAdl.scenario.js";
export { TA_ADR_SCENARIO } from "./taAdr.scenario.js";
export { TA_ADX_SCENARIO } from "./taAdx.scenario.js";
export { TA_ALMA_SCENARIO } from "./taAlma.scenario.js";
export { TA_ANCHORED_VOLUME_PROFILE_SCENARIO } from "./taAnchoredVolumeProfile.scenario.js";
export { TA_ANCHORED_VOLUME_PROFILE_GATED_SCENARIO } from "./taAnchoredVolumeProfileGated.scenario.js";
export { TA_ANCHORED_VWAP_SCENARIO } from "./taAnchoredVwap.scenario.js";
export { TA_AO_SCENARIO } from "./taAo.scenario.js";
export { TA_AROON_SCENARIO } from "./taAroon.scenario.js";
export { TA_AROON_OSC_SCENARIO } from "./taAroonOsc.scenario.js";
export { TA_ATR_SCENARIO } from "./taAtr.scenario.js";
export { TA_BARSSINCE_SCENARIO } from "./taBarssince.scenario.js";
export { TA_BB_SCENARIO } from "./taBb.scenario.js";
export { TA_BB_PERCENT_B_SCENARIO } from "./taBbPercentB.scenario.js";
export { TA_BBW_SCENARIO } from "./taBbw.scenario.js";
export { TA_BOP_SCENARIO } from "./taBop.scenario.js";
export { TA_CCI_SCENARIO } from "./taCci.scenario.js";
export { TA_CHAIKIN_OSC_SCENARIO } from "./taChaikinOsc.scenario.js";
export { TA_CHANDE_KROLL_STOP_SCENARIO } from "./taChandeKrollStop.scenario.js";
export { TA_CHANDELIER_SCENARIO } from "./taChandelier.scenario.js";
export { TA_CHANGE_SCENARIO } from "./taChange.scenario.js";
export { TA_CHOP_SCENARIO } from "./taChop.scenario.js";
export { TA_CMF_SCENARIO } from "./taCmf.scenario.js";
export { TA_CMO_SCENARIO } from "./taCmo.scenario.js";
export { TA_CONNORS_RSI_SCENARIO } from "./taConnorsRsi.scenario.js";
export { TA_COPPOCK_SCENARIO } from "./taCoppock.scenario.js";
export { TA_CROSSOVER_SCENARIO } from "./taCrossover.scenario.js";
export { TA_CROSSUNDER_SCENARIO } from "./taCrossunder.scenario.js";
export { TA_DEMA_SCENARIO } from "./taDema.scenario.js";
export { TA_DMI_SCENARIO } from "./taDmi.scenario.js";
export { TA_DONCHIAN_SCENARIO } from "./taDonchian.scenario.js";
export { TA_DPO_SCENARIO } from "./taDpo.scenario.js";
export { TA_EMA_SCENARIO } from "./taEma.scenario.js";
export { TA_ENVELOPE_SCENARIO } from "./taEnvelope.scenario.js";
export { TA_EOM_SCENARIO } from "./taEom.scenario.js";
export { TA_FISHER_SCENARIO } from "./taFisher.scenario.js";
export { TA_FIXED_RANGE_VOLUME_PROFILE_SCENARIO } from "./taFixedRangeVolumeProfile.scenario.js";
export { TA_FIXED_RANGE_VOLUME_PROFILE_GATED_SCENARIO } from "./taFixedRangeVolumeProfileGated.scenario.js";
export { TA_FIXED_RANGE_VOLUME_PROFILE_INVERTED_SCENARIO } from "./taFixedRangeVolumeProfileInverted.scenario.js";
export { TA_HIGHEST_SCENARIO } from "./taHighest.scenario.js";
export { TA_HIGHEST_LOWEST_BARS_SCENARIO } from "./taHighestLowestBars.scenario.js";
export { TA_HISTORICAL_VOLATILITY_SCENARIO } from "./taHistoricalVolatility.scenario.js";
export { TA_HMA_SCENARIO } from "./taHma.scenario.js";
export { TA_ICHIMOKU_SCENARIO } from "./taIchimoku.scenario.js";
export { TA_KAMA_SCENARIO } from "./taKama.scenario.js";
export { TA_KELTNER_SCENARIO } from "./taKeltner.scenario.js";
export { TA_KLINGER_SCENARIO } from "./taKlinger.scenario.js";
export { TA_KST_SCENARIO } from "./taKst.scenario.js";
export { TA_LOWEST_SCENARIO } from "./taLowest.scenario.js";
export { TA_LSMA_SCENARIO } from "./taLsma.scenario.js";
export { TA_MA_RIBBON_SCENARIO } from "./taMaRibbon.scenario.js";
export { TA_MACD_SCENARIO } from "./taMacd.scenario.js";
export { TA_MASS_INDEX_SCENARIO } from "./taMassIndex.scenario.js";
export { TA_MCGINLEY_SCENARIO } from "./taMcginley.scenario.js";
export { TA_MEDIAN_SCENARIO } from "./taMedian.scenario.js";
export { TA_MFI_SCENARIO } from "./taMfi.scenario.js";
export { TA_MOMENTUM_SCENARIO } from "./taMomentum.scenario.js";
export { TA_NET_VOLUME_SCENARIO } from "./taNetVolume.scenario.js";
export { TA_NVI_SCENARIO } from "./taNvi.scenario.js";
export { TA_NZ_SCENARIO } from "./taNz.scenario.js";
export { TA_OBV_SCENARIO } from "./taObv.scenario.js";
export { TA_PIVOTS_HIGH_LOW_SCENARIO } from "./taPivotsHighLow.scenario.js";
export { TA_PIVOTS_STANDARD_SCENARIO } from "./taPivotsStandard.scenario.js";
export { TA_PMO_SCENARIO } from "./taPmo.scenario.js";
export { TA_PPO_SCENARIO } from "./taPpo.scenario.js";
export { TA_PSAR_SCENARIO } from "./taPsar.scenario.js";
export { TA_PVI_SCENARIO } from "./taPvi.scenario.js";
export { TA_PVO_SCENARIO } from "./taPvo.scenario.js";
export { TA_PVT_SCENARIO } from "./taPvt.scenario.js";
export { TA_ROC_SCENARIO } from "./taRoc.scenario.js";
export { TA_RSI_SCENARIO } from "./taRsi.scenario.js";
export { TA_RVGI_SCENARIO } from "./taRvgi.scenario.js";
export { TA_RVI_SCENARIO } from "./taRvi.scenario.js";
export { TA_SESSION_VOLUME_PROFILE_SCENARIO } from "./taSessionVolumeProfile.scenario.js";
export { TA_SESSION_VOLUME_PROFILE_GATED_SCENARIO } from "./taSessionVolumeProfileGated.scenario.js";
export { TA_SESSION_VOLUME_PROFILE_NO_SESSION_SCENARIO } from "./taSessionVolumeProfileNoSession.scenario.js";
export { TA_SMA_SCENARIO } from "./taSma.scenario.js";
export { TA_SMI_SCENARIO } from "./taSmi.scenario.js";
export { TA_SMMA_SCENARIO } from "./taSmma.scenario.js";
export { TA_STDEV_SCENARIO } from "./taStdev.scenario.js";
export { TA_STOCH_SCENARIO } from "./taStoch.scenario.js";
export { TA_STOCH_RSI_SCENARIO } from "./taStochRsi.scenario.js";
export { TA_SUPERTREND_SCENARIO } from "./taSupertrend.scenario.js";
export { TA_TEMA_SCENARIO } from "./taTema.scenario.js";
export { TA_TREND_STRENGTH_INDEX_SCENARIO } from "./taTrendStrengthIndex.scenario.js";
export { TA_TRIX_SCENARIO } from "./taTrix.scenario.js";
export { TA_TSI_SCENARIO } from "./taTsi.scenario.js";
export { TA_VALUEWHEN_SCENARIO } from "./taValuewhen.scenario.js";
export { TA_ULCER_INDEX_SCENARIO } from "./taUlcerIndex.scenario.js";
export { TA_ULTIMATE_OSC_SCENARIO } from "./taUltimateOsc.scenario.js";
export { TA_VISIBLE_RANGE_VOLUME_PROFILE_SCENARIO } from "./taVisibleRangeVolumeProfile.scenario.js";
export { TA_VISIBLE_RANGE_VOLUME_PROFILE_GATED_SCENARIO } from "./taVisibleRangeVolumeProfileGated.scenario.js";
export { TA_VOL_SCENARIO } from "./taVol.scenario.js";
export { TA_VOLATILITY_STOP_SCENARIO } from "./taVolatilityStop.scenario.js";
export { TA_VORTEX_SCENARIO } from "./taVortex.scenario.js";
export { TA_VWAP_SCENARIO } from "./taVwap.scenario.js";
export { TA_VWMA_SCENARIO } from "./taVwma.scenario.js";
export { TA_WILLIAMS_FRACTAL_SCENARIO } from "./taWilliamsFractal.scenario.js";
export { TA_WILLIAMS_R_SCENARIO } from "./taWilliamsR.scenario.js";
export { TA_WMA_SCENARIO } from "./taWma.scenario.js";
export { TA_ZIG_ZAG_SCENARIO } from "./taZigZag.scenario.js";
export { TIMEFRAME_ISDAILY_SCENARIO } from "./timeframeIsdaily.scenario.js";
export { UNSUPPORTED_INTERVAL_SCENARIO } from "./unsupportedInterval.scenario.js";
export { Z_ORDER_SCENARIO } from "./zOrder.scenario.js";
export { PHASE_2_INDICATORS, PHASE_5_DEFERRED } from "./phase2Inventory.js";

/**
 * Frozen array of every bundled conformance scenario (Phase-1
 * walking-skeleton + Phase-2 indicator ports). The
 * `runConformanceSuite` default `scenarios` value points here.
 * Future phases expand the array additively as new scenarios ship.
 *
 * @since 0.2.1
 * @stable
 * @example
 *     import { ALL_SCENARIOS } from "@invinite-org/chartlang-conformance";
 *     // ALL_SCENARIOS.length >= 3
 *     void ALL_SCENARIOS;
 */
export const ALL_SCENARIOS: ReadonlyArray<Scenario> = Object.freeze([
    EMA_CROSS_SCENARIO,
    BOLLINGER_BANDS_SCENARIO,
    // Direct bar.close[N] indexing — the manual SMA(5) overlay is byte-
    // identical to ta.sma(close, 5) (both plots pin to the same hash).
    BAR_CLOSE_DIRECT_INDEX_SCENARIO,
    // Bounded-loop bar.close[i] indexing — the loop SMA(5) tracks
    // ta.sma(close, 5) bar-for-bar (each plot pins to its own hash).
    LOOP_SMA_SCENARIO,
    // Writable user state.series — s[2] history is byte-identical to a
    // direct bar.close[2] read (both plots pin to the same hash).
    STATE_SERIES_HISTORY_SCENARIO,
    BAR_POINT_TRACKING_LINE_SCENARIO,
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
    TA_HIGHEST_LOWEST_BARS_SCENARIO,
    TA_CHANGE_SCENARIO,
    TA_VALUEWHEN_SCENARIO,
    TA_BARSSINCE_SCENARIO,
    // §22.10 contract — one dedicated scenario per ta.* primitive.
    // The nine Phase-1 primitives (sma, ema, stdev, bb, rsi, macd,
    // atr, crossover, crossunder) were previously only exercised
    // indirectly through the three curated cross-cutting scenarios
    // (`EMA_CROSS_SCENARIO`, `BOLLINGER_BANDS_SCENARIO`,
    // `RSI_DIVERGENCE_SCENARIO`). These dedicated scenarios pin
    // each primitive in isolation so the §22.10 invariant holds
    // for the Phase-1 set in addition to the Phase-2 ports.
    TA_SMA_SCENARIO,
    TA_EMA_SCENARIO,
    TA_STDEV_SCENARIO,
    TA_BB_SCENARIO,
    TA_RSI_SCENARIO,
    TA_MACD_SCENARIO,
    TA_ATR_SCENARIO,
    TA_CROSSOVER_SCENARIO,
    TA_CROSSUNDER_SCENARIO,
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
    DRAW_FILL_BETWEEN_SCENARIO,
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
    // request.security expression form — the EMA runs on the HTF (secondary
    // 1D) clock, not the main-aligned daily close. The happy-path golden +
    // its companion distinctness test prove the weekly/HTF value differs from
    // a same-length main EMA; the NaN-fallback mirrors the data form's gate.
    MTF_SECURITY_EXPRESSION_EMA_SCENARIO,
    MTF_SECURITY_EXPRESSION_NAN_FALLBACK_SCENARIO,
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
    // Phase 7 — indicator composition (Task 8).
    DEP_PRIVATE_SINGLE_FILE_SCENARIO,
    DEP_MULTI_EXPORT_SCENARIO,
    DEP_DIAMOND_SCENARIO,
    DEP_ERROR_HALTS_PARENT_SCENARIO,
    DEP_CROSS_FILE_SCENARIO,
    DEP_CROSSOVER_GATE_SCENARIO,
    PLOT_STYLE_OVERRIDES_SCENARIO,
    PLOT_OFFSET_XSHIFT_SCENARIO,
    // Tier 3 plot/draw z-order — pins `plot(value, { z })` → `PlotEmission.z`
    // (negative z present on the wire, no-`z` slot omits the field), plus a
    // value-hash proving `z` is presentation-only. Drawing-`z` is covered by
    // the runtime + adapter tests (unassertable in this harness).
    Z_ORDER_SCENARIO,
    // subpane-rendering Task 5 — `overlay: false` routes every plot +
    // hline to `script:<name>`; asserted via the `all-plots-on-pane`
    // variant against the canvas2d reference (subPanes >= 1).
    RSI_SUBPANE_ROUTING_SCENARIO,
    // Phase — Pine v6 → chartlang converter (Task 19). Each scenario converts a
    // committed `.pine` fixture at module load, then the harness compiles the
    // emitted chartlang and runs it through the runtime, pinning the full
    // drawing-emission stream as a `drawing-hash`. This is the end-to-end
    // Pine → convert → compile → runtime → emit proof.
    PINE_CONVERTER_ROUND_TRIP_CAMP_A_SCENARIO,
    PINE_CONVERTER_ROUND_TRIP_CAMP_B_SCENARIO,
    PINE_CONVERTER_ROUND_TRIP_TABLE_SCENARIO,
    PINE_CONVERTER_ROUND_TRIP_VAR_SERIES_SCENARIO,
]);
