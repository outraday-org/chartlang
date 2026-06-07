// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Adapter, CandleEvent, Capabilities } from "@invinite-org/chartlang-adapter-kit";
import { capabilities as capBuilders } from "@invinite-org/chartlang-adapter-kit";
import { describe, expect, it } from "vitest";

import { runConformanceSuite } from "../runConformanceSuite";
import {
    ALL_SCENARIOS,
    BOLLINGER_BANDS_SCENARIO,
    DEFINE_DRAWING_BASIC_SCENARIO,
    DRAW_ARC_SCENARIO,
    DRAW_ANNOTATIONS_ALL_SCENARIO,
    DRAW_ARROW_SCENARIO,
    DRAW_ARROW_MARK_DOWN_SCENARIO,
    DRAW_ARROW_MARK_UP_SCENARIO,
    DRAW_ARROW_MARKER_SCENARIO,
    DRAW_BOXES_ALL_SCENARIO,
    DRAW_BRUSH_SCENARIO,
    DRAW_CHANNELS_ALL_SCENARIO,
    DRAW_CIRCLE_SCENARIO,
    DRAW_CROSS_LINE_SCENARIO,
    DRAW_CURVE_SCENARIO,
    DRAW_CURVES_AND_FREEHAND_ALL_SCENARIO,
    DRAW_DISJOINT_CHANNEL_SCENARIO,
    DRAW_DOUBLE_CURVE_SCENARIO,
    DRAW_ELLIPSE_SCENARIO,
    DRAW_FIB_ALL_SCENARIO,
    DRAW_FIB_CHANNEL_SCENARIO,
    DRAW_FIB_CIRCLES_SCENARIO,
    DRAW_FIB_RETRACEMENT_SCENARIO,
    DRAW_FIB_SPEED_ARCS_SCENARIO,
    DRAW_FIB_SPEED_FAN_SCENARIO,
    DRAW_FIB_SPIRAL_SCENARIO,
    DRAW_FIB_TIME_ZONE_SCENARIO,
    DRAW_FIB_TREND_EXTENSION_SCENARIO,
    DRAW_FIB_TREND_TIME_SCENARIO,
    DRAW_FIB_WEDGE_SCENARIO,
    DRAW_FLAT_TOP_BOTTOM_SCENARIO,
    DRAW_GANN_ALL_SCENARIO,
    DRAW_GANN_BOX_SCENARIO,
    DRAW_GANN_FAN_SCENARIO,
    DRAW_GANN_SQUARE_SCENARIO,
    DRAW_GANN_SQUARE_FIXED_SCENARIO,
    DRAW_HIGHLIGHTER_SCENARIO,
    DRAW_HORIZONTAL_LINE_SCENARIO,
    DRAW_HORIZONTAL_RAY_SCENARIO,
    DRAW_LINE_SCENARIO,
    DRAW_LINES_AND_RAYS_SCENARIO,
    DRAW_MARKER_SCENARIO,
    DRAW_PATH_SCENARIO,
    DRAW_PEN_SCENARIO,
    DRAW_PITCHFAN_SCENARIO,
    DRAW_PITCHFORK_SCENARIO,
    DRAW_PITCHFORKS_ALL_SCENARIO,
    DRAW_ABCD_PATTERN_SCENARIO,
    DRAW_ALL_61_SCENARIO,
    DRAW_BUDGET_OVERFLOW_SCENARIO,
    DRAW_UNSUPPORTED_KIND_SCENARIO,
    DRAW_CYPHER_PATTERN_SCENARIO,
    DRAW_HEAD_AND_SHOULDERS_SCENARIO,
    DRAW_PATTERNS_ALL_SCENARIO,
    DRAW_THREE_DRIVES_PATTERN_SCENARIO,
    DRAW_TRIANGLE_PATTERN_SCENARIO,
    DRAW_XABCD_PATTERN_SCENARIO,
    DRAW_ELLIOTT_ALL_SCENARIO,
    DRAW_ELLIOTT_CORRECTION_WAVE_SCENARIO,
    DRAW_ELLIOTT_DOUBLE_COMBO_SCENARIO,
    DRAW_ELLIOTT_IMPULSE_WAVE_SCENARIO,
    DRAW_ELLIOTT_TRIANGLE_WAVE_SCENARIO,
    DRAW_ELLIOTT_TRIPLE_COMBO_SCENARIO,
    DRAW_CYCLES_ALL_SCENARIO,
    DRAW_CYCLIC_LINES_SCENARIO,
    DRAW_SINE_LINE_SCENARIO,
    DRAW_TIME_CYCLES_SCENARIO,
    DRAW_CONTAINERS_ALL_SCENARIO,
    DRAW_FRAME_SCENARIO,
    DRAW_GROUP_SCENARIO,
    DRAW_HANDLE_REMOVE_SCENARIO,
    DRAW_INTERACTIVE_UPDATE_SCENARIO,
    DRAW_POLYLINE_SCENARIO,
    DRAW_RECTANGLE_SCENARIO,
    DRAW_REGRESSION_TREND_SCENARIO,
    DRAW_ROTATED_RECTANGLE_SCENARIO,
    DRAW_TEXT_SCENARIO,
    DRAW_TREND_ANGLE_SCENARIO,
    DRAW_TREND_CHANNEL_SCENARIO,
    DRAW_TRIANGLE_SCENARIO,
    DRAW_VERTICAL_LINE_SCENARIO,
    EMA_CROSS_SCENARIO,
    PHASE_1_SCENARIOS,
    PLOT_KIND_COVERAGE_SCENARIO,
    RSI_DIVERGENCE_SCENARIO,
    TA_ADL_SCENARIO,
    TA_ADR_SCENARIO,
    TA_ADX_SCENARIO,
    TA_ALMA_SCENARIO,
    TA_ANCHORED_VWAP_SCENARIO,
    TA_AO_SCENARIO,
    TA_AROON_OSC_SCENARIO,
    TA_AROON_SCENARIO,
    TA_BARSSINCE_SCENARIO,
    TA_BBW_SCENARIO,
    TA_BB_PERCENT_B_SCENARIO,
    TA_BOP_SCENARIO,
    TA_CCI_SCENARIO,
    TA_CHAIKIN_OSC_SCENARIO,
    TA_CHANDELIER_SCENARIO,
    TA_CHANDE_KROLL_STOP_SCENARIO,
    TA_CHANGE_SCENARIO,
    TA_CHOP_SCENARIO,
    TA_CMF_SCENARIO,
    TA_CMO_SCENARIO,
    TA_CONNORS_RSI_SCENARIO,
    TA_COPPOCK_SCENARIO,
    TA_DEMA_SCENARIO,
    TA_DMI_SCENARIO,
    TA_DONCHIAN_SCENARIO,
    TA_DPO_SCENARIO,
    TA_ENVELOPE_SCENARIO,
    TA_EOM_SCENARIO,
    TA_FISHER_SCENARIO,
    TA_HIGHEST_SCENARIO,
    TA_HISTORICAL_VOLATILITY_SCENARIO,
    TA_HMA_SCENARIO,
    TA_ICHIMOKU_SCENARIO,
    TA_KAMA_SCENARIO,
    TA_KELTNER_SCENARIO,
    TA_KLINGER_SCENARIO,
    TA_KST_SCENARIO,
    TA_LOWEST_SCENARIO,
    TA_LSMA_SCENARIO,
    TA_MASS_INDEX_SCENARIO,
    TA_MA_RIBBON_SCENARIO,
    TA_MCGINLEY_SCENARIO,
    TA_MEDIAN_SCENARIO,
    TA_MFI_SCENARIO,
    TA_MOMENTUM_SCENARIO,
    TA_NET_VOLUME_SCENARIO,
    TA_NVI_SCENARIO,
    TA_NZ_SCENARIO,
    TA_OBV_SCENARIO,
    TA_PIVOTS_HIGH_LOW_SCENARIO,
    TA_PIVOTS_STANDARD_SCENARIO,
    TA_PMO_SCENARIO,
    TA_PPO_SCENARIO,
    TA_PSAR_SCENARIO,
    TA_PVI_SCENARIO,
    TA_PVO_SCENARIO,
    TA_PVT_SCENARIO,
    TA_ROC_SCENARIO,
    TA_RVGI_SCENARIO,
    TA_RVI_SCENARIO,
    TA_SMI_SCENARIO,
    TA_SMMA_SCENARIO,
    TA_STOCH_RSI_SCENARIO,
    TA_STOCH_SCENARIO,
    TA_SUPERTREND_SCENARIO,
    TA_TEMA_SCENARIO,
    TA_TREND_STRENGTH_INDEX_SCENARIO,
    TA_TRIX_SCENARIO,
    TA_TSI_SCENARIO,
    TA_ULCER_INDEX_SCENARIO,
    TA_ULTIMATE_OSC_SCENARIO,
    TA_VALUEWHEN_SCENARIO,
    TA_VOLATILITY_STOP_SCENARIO,
    TA_VOL_SCENARIO,
    TA_VORTEX_SCENARIO,
    TA_VWAP_SCENARIO,
    TA_VWMA_SCENARIO,
    TA_WILLIAMS_FRACTAL_SCENARIO,
    TA_WILLIAMS_R_SCENARIO,
    TA_WMA_SCENARIO,
    TA_ZIG_ZAG_SCENARIO,
} from "./index";

const TEST_CAPABILITIES: Capabilities = {
    plots: capBuilders.union(capBuilders.line(), capBuilders.horizontalLine()),
    // Phase-3 Tasks 5–15 widen the conformance-suite-side cap surface
    // so the new line + box + curve + freehand + annotation + channel +
    // fib + gann + pitchfork + pattern scenarios reach `pushDrawing`'s
    // happy path. The `marker` and the 5 annotation kinds live in the
    // `labels` bucket; curve + freehand + channel + pitchfork +
    // harmonic-pattern kinds map to `polylines`; all 10 fib + 4 gann
    // kinds map to `other`. Tasks 16–18 grow this further as their
    // kinds ship.
    drawings: new Set([
        ...capBuilders.allLineDrawings(),
        ...capBuilders.allBoxDrawings(),
        ...capBuilders.allCurveDrawings(),
        ...capBuilders.allFreehandDrawings(),
        ...capBuilders.allAnnotationDrawings(),
        ...capBuilders.allChannelDrawings(),
        ...capBuilders.allFibDrawings(),
        ...capBuilders.allGannDrawings(),
        ...capBuilders.allPitchforkDrawings(),
        ...capBuilders.allPatternDrawings(),
        ...capBuilders.allElliottDrawings(),
        ...capBuilders.allCycleDrawings(),
        ...capBuilders.allContainerDrawings(),
    ]),
    alerts: capBuilders.alerts("log", "toast"),
    alertConditions: false,
    logs: false,
    inputs: new Set(),
    intervals: [],
    multiTimeframe: false,
    subPanes: 0,
    symInfoFields: new Set(),
    maxDrawingsPerScript: { lines: 100, labels: 100, boxes: 100, polylines: 100, other: 100 },
    maxLookback: 1000,
    maxTickHz: 30,
};

function makeTestAdapter(): Adapter {
    return {
        id: "test",
        name: "Iteration-parity adapter",
        capabilities: TEST_CAPABILITIES,
        candles(): AsyncIterable<CandleEvent> {
            return {
                async *[Symbol.asyncIterator](): AsyncIterator<CandleEvent> {
                    /* empty */
                },
            };
        },
        onEmissions(): void {
            /* no-op */
        },
        dispose(): void {
            /* no-op */
        },
    };
}

const TA_SCENARIOS = [
    { name: "ta-nz", scenario: TA_NZ_SCENARIO },
    { name: "ta-highest", scenario: TA_HIGHEST_SCENARIO },
    { name: "ta-lowest", scenario: TA_LOWEST_SCENARIO },
    { name: "ta-change", scenario: TA_CHANGE_SCENARIO },
    { name: "ta-valuewhen", scenario: TA_VALUEWHEN_SCENARIO },
    { name: "ta-barssince", scenario: TA_BARSSINCE_SCENARIO },
    { name: "ta-aroon", scenario: TA_AROON_SCENARIO },
    { name: "ta-aroonOsc", scenario: TA_AROON_OSC_SCENARIO },
    { name: "ta-adx", scenario: TA_ADX_SCENARIO },
    { name: "ta-dmi", scenario: TA_DMI_SCENARIO },
    { name: "ta-trix", scenario: TA_TRIX_SCENARIO },
    { name: "ta-ao", scenario: TA_AO_SCENARIO },
    { name: "ta-cmo", scenario: TA_CMO_SCENARIO },
    { name: "ta-momentum", scenario: TA_MOMENTUM_SCENARIO },
    { name: "ta-roc", scenario: TA_ROC_SCENARIO },
    { name: "ta-pmo", scenario: TA_PMO_SCENARIO },
    { name: "ta-smi", scenario: TA_SMI_SCENARIO },
    { name: "ta-tsi", scenario: TA_TSI_SCENARIO },
    { name: "ta-wma", scenario: TA_WMA_SCENARIO },
    { name: "ta-vwma", scenario: TA_VWMA_SCENARIO },
    { name: "ta-hma", scenario: TA_HMA_SCENARIO },
    { name: "ta-smma", scenario: TA_SMMA_SCENARIO },
    { name: "ta-dema", scenario: TA_DEMA_SCENARIO },
    { name: "ta-tema", scenario: TA_TEMA_SCENARIO },
    { name: "ta-kama", scenario: TA_KAMA_SCENARIO },
    { name: "ta-alma", scenario: TA_ALMA_SCENARIO },
    { name: "ta-lsma", scenario: TA_LSMA_SCENARIO },
    { name: "ta-mcginley", scenario: TA_MCGINLEY_SCENARIO },
    { name: "ta-maRibbon", scenario: TA_MA_RIBBON_SCENARIO },
    { name: "ta-cci", scenario: TA_CCI_SCENARIO },
    { name: "ta-stoch", scenario: TA_STOCH_SCENARIO },
    { name: "ta-williams-r", scenario: TA_WILLIAMS_R_SCENARIO },
    { name: "ta-stochRsi", scenario: TA_STOCH_RSI_SCENARIO },
    { name: "ta-ultimateOsc", scenario: TA_ULTIMATE_OSC_SCENARIO },
    { name: "ta-coppock", scenario: TA_COPPOCK_SCENARIO },
    { name: "ta-ppo", scenario: TA_PPO_SCENARIO },
    { name: "ta-dpo", scenario: TA_DPO_SCENARIO },
    { name: "ta-connors-rsi", scenario: TA_CONNORS_RSI_SCENARIO },
    { name: "ta-kst", scenario: TA_KST_SCENARIO },
    { name: "ta-fisher", scenario: TA_FISHER_SCENARIO },
    { name: "ta-klinger", scenario: TA_KLINGER_SCENARIO },
    { name: "ta-rvgi", scenario: TA_RVGI_SCENARIO },
    { name: "ta-bbPercentB", scenario: TA_BB_PERCENT_B_SCENARIO },
    { name: "ta-bbw", scenario: TA_BBW_SCENARIO },
    { name: "ta-donchian", scenario: TA_DONCHIAN_SCENARIO },
    { name: "ta-keltner", scenario: TA_KELTNER_SCENARIO },
    { name: "ta-envelope", scenario: TA_ENVELOPE_SCENARIO },
    { name: "ta-chop", scenario: TA_CHOP_SCENARIO },
    { name: "ta-historicalVolatility", scenario: TA_HISTORICAL_VOLATILITY_SCENARIO },
    { name: "ta-rvi", scenario: TA_RVI_SCENARIO },
    { name: "ta-massIndex", scenario: TA_MASS_INDEX_SCENARIO },
    { name: "ta-median", scenario: TA_MEDIAN_SCENARIO },
    { name: "ta-adr", scenario: TA_ADR_SCENARIO },
    { name: "ta-ulcerIndex", scenario: TA_ULCER_INDEX_SCENARIO },
    { name: "ta-psar", scenario: TA_PSAR_SCENARIO },
    { name: "ta-supertrend", scenario: TA_SUPERTREND_SCENARIO },
    { name: "ta-chandelier", scenario: TA_CHANDELIER_SCENARIO },
    { name: "ta-chandeKrollStop", scenario: TA_CHANDE_KROLL_STOP_SCENARIO },
    { name: "ta-williamsFractal", scenario: TA_WILLIAMS_FRACTAL_SCENARIO },
    { name: "ta-vol", scenario: TA_VOL_SCENARIO },
    { name: "ta-vwap", scenario: TA_VWAP_SCENARIO },
    { name: "ta-anchored-vwap", scenario: TA_ANCHORED_VWAP_SCENARIO },
    { name: "ta-obv", scenario: TA_OBV_SCENARIO },
    { name: "ta-adl", scenario: TA_ADL_SCENARIO },
    { name: "ta-bop", scenario: TA_BOP_SCENARIO },
    { name: "ta-cmf", scenario: TA_CMF_SCENARIO },
    { name: "ta-chaikinOsc", scenario: TA_CHAIKIN_OSC_SCENARIO },
    { name: "ta-mfi", scenario: TA_MFI_SCENARIO },
    { name: "ta-netVolume", scenario: TA_NET_VOLUME_SCENARIO },
    { name: "ta-pvo", scenario: TA_PVO_SCENARIO },
    { name: "ta-pvt", scenario: TA_PVT_SCENARIO },
    { name: "ta-eom", scenario: TA_EOM_SCENARIO },
    { name: "ta-nvi", scenario: TA_NVI_SCENARIO },
    { name: "ta-pvi", scenario: TA_PVI_SCENARIO },
    { name: "ta-zigZag", scenario: TA_ZIG_ZAG_SCENARIO },
    { name: "ta-pivotsHighLow", scenario: TA_PIVOTS_HIGH_LOW_SCENARIO },
    { name: "ta-pivotsStandard", scenario: TA_PIVOTS_STANDARD_SCENARIO },
    { name: "ta-volatilityStop", scenario: TA_VOLATILITY_STOP_SCENARIO },
    { name: "ta-vortex", scenario: TA_VORTEX_SCENARIO },
    { name: "ta-trendStrengthIndex", scenario: TA_TREND_STRENGTH_INDEX_SCENARIO },
    { name: "ta-ichimoku", scenario: TA_ICHIMOKU_SCENARIO },
] as const;

describe("Phase-1+Phase-2 scenario constants", () => {
    it("PHASE_1_SCENARIOS lists every scenario exactly once", () => {
        expect(PHASE_1_SCENARIOS).toEqual([
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
            // Phase 3 Task 7 — combined box bundle.
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
            // Phase 3 Task 12 — Fibonacci B.
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
            // Phase 3 Task 19 — Smoke + budget overflow. The
            // `unsupported-drawing-kind` companion (DRAW_UNSUPPORTED_KIND_SCENARIO)
            // and `DRAW_BUDGET_OVERFLOW_SCENARIO` ship as opt-in exports
            // only — the canvas2d reference adapter advertises every
            // kind and sizes its `lines` bucket at 200, so neither
            // diagnostic can fire through `ALL_SCENARIOS`. The budget
            // scenario is still exercised directly by the per-scenario
            // assertion below using a 100-cap adapter.
            DRAW_ALL_61_SCENARIO,
            // Phase 3 Task 20 — `defineDrawing` constructor scenarios.
            DEFINE_DRAWING_BASIC_SCENARIO,
            DRAW_INTERACTIVE_UPDATE_SCENARIO,
            DRAW_HANDLE_REMOVE_SCENARIO,
        ]);
        expect(Object.isFrozen(PHASE_1_SCENARIOS)).toBe(true);
    });

    it("ALL_SCENARIOS is the same frozen array PHASE_1_SCENARIOS aliases (post-rename)", () => {
        expect(ALL_SCENARIOS).toBe(PHASE_1_SCENARIOS);
        expect(Object.isFrozen(ALL_SCENARIOS)).toBe(true);
    });

    // Resolution: option (a) per task §6 — rename `PHASE_1_SCENARIOS`
    // to `ALL_SCENARIOS`, keep the original name as a `@deprecated`
    // alias. Investigation note (5 lines, also in the changeset body):
    // Found 78 scenarios in script (stale local `dist/` build), 85 in
    // array, gap is the script's `dist/`-first import preference loading
    // a stale snapshot — the runner iterates all entries with no silent
    // skip (`report.passed + report.failed === ALL_SCENARIOS.length`).
    // CI is unaffected because `pnpm build` runs before `pnpm conformance`.
    it("runConformanceSuite iterates ALL_SCENARIOS exactly (no silent skips)", async () => {
        const report = await runConformanceSuite(makeTestAdapter());
        expect(report.passed + report.failed).toBe(ALL_SCENARIOS.length);
    }, 120_000);

    it.each([
        { name: "ema-cross", scenario: EMA_CROSS_SCENARIO },
        { name: "bollinger-bands", scenario: BOLLINGER_BANDS_SCENARIO },
        { name: "rsi-divergence-alert", scenario: RSI_DIVERGENCE_SCENARIO },
    ])("$name carries a non-empty assertions array + script path", ({ scenario }) => {
        expect(scenario.id).not.toBe("");
        expect(scenario.title).not.toBe("");
        expect(scenario.scriptPath).toMatch(/^examples\/scripts\/.+\.chart\.ts$/);
        expect(scenario.intervalCount).toBe(1);
        expect(scenario.assertions.length).toBeGreaterThan(0);
        expect(Object.isFrozen(scenario)).toBe(true);
        expect(Object.isFrozen(scenario.assertions)).toBe(true);
    });

    it.each(TA_SCENARIOS)(
        "$name carries an inlineSource and no scriptPath",
        ({ scenario, name }) => {
            expect(scenario.id).toBe(name);
            expect(scenario.title).not.toBe("");
            expect(scenario.scriptPath).toBeUndefined();
            expect(scenario.inlineSource).toMatch(/defineIndicator/);
            expect(scenario.intervalCount).toBe(1);
            expect(scenario.assertions.length).toBeGreaterThan(0);
            expect(Object.isFrozen(scenario)).toBe(true);
            expect(Object.isFrozen(scenario.assertions)).toBe(true);
        },
    );

    it("plot-kind-coverage carries an inlineSource and no scriptPath", () => {
        expect(PLOT_KIND_COVERAGE_SCENARIO.id).toBe("plot-kind-coverage");
        expect(PLOT_KIND_COVERAGE_SCENARIO.scriptPath).toBeUndefined();
        expect(PLOT_KIND_COVERAGE_SCENARIO.inlineSource).toMatch(/defineIndicator/);
        expect(PLOT_KIND_COVERAGE_SCENARIO.intervalCount).toBe(1);
        expect(PLOT_KIND_COVERAGE_SCENARIO.assertions.length).toBeGreaterThan(0);
        expect(Object.isFrozen(PLOT_KIND_COVERAGE_SCENARIO)).toBe(true);
        expect(Object.isFrozen(PLOT_KIND_COVERAGE_SCENARIO.assertions)).toBe(true);
    });

    it("every assertion declares a valid kind", () => {
        const valid = new Set([
            "plot-hash",
            "alert-count",
            "alert-message-contains",
            "diagnostic-code-absent",
            "diagnostic-code-present",
            "drawing-hash",
        ]);
        for (const scenario of PHASE_1_SCENARIOS) {
            for (const assertion of scenario.assertions) {
                expect(valid.has(assertion.kind)).toBe(true);
            }
        }
    });

    // Phase 3 Task 19 — `DRAW_UNSUPPORTED_KIND_SCENARIO` is exported
    // but excluded from `ALL_SCENARIOS` because `TEST_CAPABILITIES`
    // advertises every Phase-3 kind and the diagnostic cannot fire.
    // This row pins the scenario against a narrow synthetic adapter
    // whose `capabilities.drawings = new Set(["line"])` so the
    // `unsupported-drawing-kind` path is exercised end-to-end.
    it("DRAW_UNSUPPORTED_KIND_SCENARIO fires unsupported-drawing-kind against a {line}-only adapter", async () => {
        const narrow: Adapter = {
            id: "narrow",
            name: "narrow-line-only",
            capabilities: {
                ...TEST_CAPABILITIES,
                drawings: new Set(["line"] as const),
            },
            candles(): AsyncIterable<CandleEvent> {
                return {
                    async *[Symbol.asyncIterator](): AsyncIterator<CandleEvent> {
                        /* empty */
                    },
                };
            },
            onEmissions(): void {
                /* no-op */
            },
            dispose(): void {
                /* no-op */
            },
        };
        const report = await runConformanceSuite(narrow, {
            scenarios: [DRAW_UNSUPPORTED_KIND_SCENARIO],
        });
        expect(report.failed).toBe(0);
        expect(report.passed).toBe(1);
    }, 60_000);

    // Phase 3 Task 19 / Task 22 closeout — `DRAW_BUDGET_OVERFLOW_SCENARIO`
    // is exported but excluded from `ALL_SCENARIOS` because the bundled
    // canvas2d adapter sizes `lines: 200`, and the scenario emits 150
    // lines against a 100-cap design. This row exercises it directly
    // against `TEST_CAPABILITIES` (lines: 100) so the
    // `drawing-budget-exceeded` path stays covered end-to-end.
    it("DRAW_BUDGET_OVERFLOW_SCENARIO fires drawing-budget-exceeded against a 100-cap adapter", async () => {
        const report = await runConformanceSuite(makeTestAdapter(), {
            scenarios: [DRAW_BUDGET_OVERFLOW_SCENARIO],
        });
        expect(report.failed).toBe(0);
        expect(report.passed).toBe(1);
    }, 60_000);
});
