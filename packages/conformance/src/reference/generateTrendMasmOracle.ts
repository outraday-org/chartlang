// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { evaluateTrendMasmPineReference, type ReferenceBar } from "./trendMasmPineReference.js";

type ProviderCandle = ReferenceBar & {
    readonly datetime: string;
    readonly assetType: string;
    readonly interval: string;
    readonly symbol: string;
};

type ProviderPage = {
    readonly assetType: string;
    readonly candles: ReadonlyArray<ProviderCandle>;
    readonly converted: boolean;
    readonly displayCurrency: string | null;
    readonly from: string;
    readonly interval: string;
    readonly source: string;
    readonly symbol: string;
    readonly to: string;
};

const sourceDir = dirname(fileURLToPath(import.meta.url));
const fixtureDir = resolve(sourceDir, "../../fixtures/tradingview-trend-masm");
const rawDir = resolve(fixtureDir, "raw");

function sha256(value: unknown): string {
    const serialized = typeof value === "string" ? value : JSON.stringify(value);
    if (serialized === undefined) throw new Error("Cannot checksum undefined");
    return createHash("sha256").update(serialized).digest("hex");
}

function assertProviderPages(value: unknown): asserts value is ReadonlyArray<ProviderPage> {
    if (!Array.isArray(value) || value.length !== 3) {
        throw new Error("Expected exactly three frozen Massive pages");
    }
    for (const page of value) {
        if (
            page?.source !== "massive" ||
            page.symbol !== "TQQQ" ||
            page.interval !== "1d" ||
            page.assetType !== "us_stock" ||
            page.converted !== false ||
            page.displayCurrency !== null ||
            !Array.isArray(page.candles) ||
            page.candles.length !== 1_000
        ) {
            throw new Error("Frozen provider page metadata is not the pinned TQQQ 1d contract");
        }
        for (const candle of page.candles) {
            if (
                candle?.symbol !== "TQQQ" ||
                candle.interval !== "1d" ||
                candle.assetType !== "us_stock" ||
                !Number.isFinite(Date.parse(candle.datetime)) ||
                ![candle.open, candle.high, candle.low, candle.close, candle.volume].every(
                    Number.isFinite,
                )
            ) {
                throw new Error("Frozen provider candle is not a valid TQQQ 1d row");
            }
        }
    }
}

async function generate(): Promise<void> {
    const [providerText, trendPine, masmPine, evaluatorSource] = await Promise.all([
        readFile(resolve(rawDir, "massive-tqqq-1d-pages.json"), "utf8"),
        readFile(resolve(rawDir, "Trend_Wizard.pine"), "utf8"),
        readFile(resolve(rawDir, "MASM_Strat.pine"), "utf8"),
        readFile(resolve(sourceDir, "trendMasmPineReference.ts"), "utf8"),
    ]);
    const providerPages: unknown = JSON.parse(providerText);
    assertProviderPages(providerPages);
    const bars = providerPages
        .flatMap((page) => page.candles)
        .map(
            (candle): ReferenceBar => ({
                time: Date.parse(candle.datetime),
                open: candle.open,
                high: candle.high,
                low: candle.low,
                close: candle.close,
                volume: candle.volume,
            }),
        )
        .sort((left, right) => left.time - right.time);
    if (bars.length !== 3_000) throw new Error(`Expected 3000 bars, got ${String(bars.length)}`);
    for (let index = 0; index < bars.length; index += 1) {
        const bar = bars[index];
        if (
            ![bar.time, bar.open, bar.high, bar.low, bar.close, bar.volume].every(
                Number.isFinite,
            ) ||
            (index > 0 && bar.time <= bars[index - 1].time)
        ) {
            throw new Error(`Invalid normalized bar at index ${String(index)}`);
        }
    }
    const reference = evaluateTrendMasmPineReference(bars);
    const lastExpected = reference.expected[reference.expected.length - 1];
    const oracleBase = {
        schemaVersion: 2,
        provenance: {
            owner: "TradeRational / chart owner",
            license:
                "Canonical Pine sources retain MPL-2.0 headers; provider data frozen for parity testing",
            captureMethod:
                "Pine-derived oracle: adjusted Massive daily aggregates plus a standalone zero-import Pine subset evaluator",
            generatedBy: "generateTrendMasmOracle.ts",
        },
        capture: {
            capturedAt: "2026-08-28T03:23:00.000Z",
            tradingViewBuild: "authenticated web chart (build not exposed in chart UI)",
            tradingViewChartUrl: "https://www.tradingview.com/chart/HNckvQvP/",
            symbol: "NASDAQ:TQQQ",
            exchange: "NASDAQ",
            interval: "1D",
            chartTimezone: "UTC+2",
            session:
                "Massive daily exchange aggregates; TradingView 1D session control not exposed",
            adjustment: "TradingView ADJ active; Massive adjusted=true",
            extendedHours: null,
            extendedHoursEvidence:
                "TradingView Symbol settings expose no extended-hours/session toggle on 1D; the Overnight via BOATS element is a non-interactive market-status pill",
            barsRequested: 3_000,
            fixtureStart: bars[0].time,
            fixtureEnd: bars[bars.length - 1].time,
            trendScriptVersion: "Trend Wizard v1.0",
            masmScriptVersion: "MASM Strat 2.3 LIVE",
        },
        provider: {
            name: "Massive",
            sourceTag: "massive",
            endpointContract: "/v2/aggs/ticker/TQQQ/range/1/day with adjusted=true",
            retrievedThrough:
                "Convex externalBackend/backend/assetCandles:listAssetCandlesWindowedInternal (server-side credential)",
            adjusted: true,
            assetType: "us_stock",
            interval: "1d",
            symbol: "TQQQ",
            converted: false,
            displayCurrency: null,
            rawArtifact: "raw/massive-tqqq-1d-pages.json",
            rawPageCount: providerPages.length,
        },
        reference: {
            kind: "standalone-pine-translation",
            evaluatorArtifact: "raw/trendMasmPineReference.ts",
            evaluatorSource: "src/reference/trendMasmPineReference.ts",
            execution: "Pine historical closed-bar, chronological single pass",
            realtime: "not certified; realtime/tick parity belongs to the later live-feed path",
            imports: [],
            forbiddenDependencies: [
                "Chartlang runtime",
                "Chartlang compiler",
                "Pine converter",
                "adapter-kit",
                "shared numerical primitives",
            ],
        },
        inputs: {
            trend: {
                src_tframe: "",
                src_symbol_custom: "NASDAQ:QQQ",
                src_symbol_swtch: false,
                table_swtch: true,
                plot_invis_swtch: true,
                trend_swtch: true,
                trend2_swtch: false,
                trend3_swtch: false,
                trend4_swtch: false,
                trend_display_short_swtch: true,
                trend_display_med_swtch: false,
                trend_display_long_swtch: false,
                development_display: {
                    ma_slopes: false,
                    ma_derivatives: false,
                    ma_turnovers: false,
                    ma_distances: false,
                    ma_crossings: false,
                    rsi: false,
                    atr_short: false,
                    atr_medium: false,
                    atr_long: false,
                    adjust_distance_by_atr: true,
                    zero_line: true,
                },
                preset: "Trade Rational Default",
                overwrite_settings: true,
                ma_types: ["EMA", "EMA", "SMA", "SMA", "SMA"],
                ma_lengths: [8, 21, 50, 145, 241],
                ma_slope_enabled: [true, true, true, true, true],
                ma_slope_divisors: [1, 1, 1, 1, 1],
                slope_smoothing: [3, 1, 3, 3, 3],
                ma_slope_composite: { enabled: true, type: "SMA", smoothing: 1 },
                ma_derivative_composite: {
                    enabled: true,
                    type: "SMA",
                    smoothing: 21,
                    scale: 5,
                },
                ma_derivative: { smoothing: 3, scale: 2 },
                ma_turnover: {
                    enabled: [true, true, true, true, true],
                    smoothing: [8, 8, 8, 8, 8],
                    combined: false,
                    plotType: "Line",
                    scale: 1,
                },
                ma_distance_enabled: [true, true, true, true, true],
                distance_smoothing: [10, 4, 5, 8, 10],
                ma_distance_composite: true,
                ma_distance_scale: 0.1,
                ma_cross_enabled: [true, false, false, false],
                ma_cross_smoothing: [1, 1, 1, 1],
                ma_cross_exclusion: [2, 2, 2, 2],
                ma_cross_composite: false,
                ma_cross_composite_smoothing: 1,
                ma_cross_scale: 1,
                rsi: {
                    maLength: 14,
                    smoothing: 4,
                    plotRsi: false,
                    plotMa: true,
                    plotSlope: false,
                    centered: true,
                    scale: 0.1,
                    slopeScale: 2.5,
                },
                testing: {
                    integers: [1, 1],
                    floats: [1, 0],
                    booleans: [true, true, true],
                },
                trend_scales: [1.1, 1.35, 1.9],
            },
            masm: {
                startYear: 2019,
                startMonth: 1,
                startDay: 1,
                closeYear: 2027,
                closeMonth: 1,
                closeDay: 1,
                trades_long: true,
                trades_short: false,
                long_entry_cond1_swtch: true,
                long_entry_cond1_ltadj: true,
                long_entry_cond1_ltadj_factors: [0.5, 0.5],
                long_entry_cond2_swtch: true,
                long_entry_cond2_cutoff: 2.5,
                long_exit_cond1_swtch: true,
                long_exit_cond1_ltadj: true,
                long_exit_cond1_ltadj_factors: [0.5, 0.5],
                long_exit_cond2_swtch: false,
                long_exit_cond3_swtch: true,
                long_exit_cond3_delay: 11,
                long_exit_cond4_swtch: false,
                long_exit_cond4_cutoff: -0.4,
                long_exit_cond5_swtch: false,
                long_exit_cond5_cutoff: -1.5,
                save_wicks_swtch: false,
                rsi_gating_swtch: false,
                stay_long_switches: [false, false],
                stay_long_trend_factor: 1,
                never_long_switches: [false, false],
                never_long_parameters: {
                    maNoGo: -0.8,
                    maCutoff: -0.5,
                    volatilityAtrFactor: 1.16,
                },
                short_exit_switches: [false, false, false],
                short_exit_delay: 2,
                stay_short_switches: [false, false],
                atr_len: 100,
                atr_smoothing: 50,
                guideline_swtch: false,
                guideline_range: 2,
                trade_signals_swtch: false,
                element_switches: {
                    maDerivative: false,
                    rsiSlope: false,
                    rsiDerivative: false,
                    consolidationRange: false,
                    consolidationRangeLongTrendAdjusted: false,
                    atr: false,
                    maW30Slope: false,
                },
                ma_length: 21,
                ma_type: "EMA",
                ma_smoothing: 3,
                derivative_smoothing: 6,
                consolidation_range: 1,
                consolidation_tolerance: 4,
                earnings: false,
                hide_labels: true,
                comparison_mode: false,
                comparison: {
                    strategyProfit: false,
                    absolute: false,
                    holdProfit: false,
                    comparisonSecurity: false,
                    comparisonSymbol: "Chart",
                    relativePerformance: true,
                    relativePerformanceLength: 21,
                },
                close_trades_lastbar: false,
                market_full_week_swtch: false,
            },
            masmSource: { script: "Trend Wizard v1.0", output: "Tab Trend Long" },
        },
        tolerance: {
            name: "binary64-independent-reference",
            absolute: 1e-10,
            relative: 1e-10,
            representation: "IEEE-754 binary64; nullable JSON values represent Pine na",
            minimumDecisionDistance: reference.minimumDecisionDistance,
        },
        presentation: reference.presentation,
        thresholdDistances: reference.thresholdDistances,
        anchorChecks: {
            tradingViewDataWindow: {
                role: "rounded one-bar sanity anchor, not expected-output provenance",
                time: Date.parse("2026-08-27T04:00:00.000Z"),
                uiPrecision: { priceDecimals: 2, studyDecimals: 4, volume: "48.78M" },
                bars: { open: 72.08, high: 73.38, low: 71.38, close: 73.3 },
                trend: { short: -0.0795, medium: -0.0647, long: 0.2051, plot: -0.0937 },
                masm: { maSlope: 0.0196, consolidationOverlayBars: 0.0196 },
                referenceUnrounded: {
                    providerBar: bars[bars.length - 1],
                    trend: {
                        short: lastExpected.trend.short,
                        medium: lastExpected.trend.medium,
                        long: lastExpected.trend.long,
                    },
                    masm: {
                        maSlope: lastExpected.masm.plots["MA Slope"].value,
                        consolidationOverlayBars:
                            lastExpected.masm.plots["Consolidation Overlay Bars"].value,
                    },
                },
            },
        },
        checksums: {
            barsSha256: sha256(bars),
            expectedSha256: sha256(reference.expected),
            trendPineSha256: sha256(trendPine),
            masmPineSha256: sha256(masmPine),
            rawProviderSha256: sha256(providerText),
            evaluatorSha256: sha256(evaluatorSource),
        },
        bars,
        expected: reference.expected,
    };
    const oracle = {
        ...oracleBase,
        checksums: {
            ...oracleBase.checksums,
            settingsSha256: sha256(oracleBase.inputs),
            presentationSha256: sha256(oracleBase.presentation),
        },
    };
    await Promise.all([
        writeFile(resolve(rawDir, "trendMasmPineReference.ts"), evaluatorSource, "utf8"),
        writeFile(resolve(fixtureDir, "oracle.json"), `${JSON.stringify(oracle)}\n`, "utf8"),
    ]);
}

await generate();
