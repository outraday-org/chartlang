// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

/**
 * Hand-written inventory of every PLAN §9.2 `ta.*` primitive that
 * ships in Phase 2. Sourced from
 * `tasks/phase-2-indicator-parity/README.md`. The Phase-2 closeout
 * (Task 30) asserts every name here is registered in `TA_REGISTRY`
 * and that the registry's cardinality matches `PHASE_2_INDICATORS`
 * + the 9 Phase-1 primitives.
 *
 * Divergence (a missing primitive, an extra one) fails
 * `phase2Coverage.test.ts` — this list is the source of truth for
 * phase verification.
 *
 * @since 0.2
 * @stable
 * @example
 *     import { PHASE_2_INDICATORS } from "@invinite-org/chartlang-conformance";
 *     // PHASE_2_INDICATORS.length === 81
 *     void PHASE_2_INDICATORS;
 */
export const PHASE_2_INDICATORS: ReadonlyArray<string> = Object.freeze([
    // Cross-functional (Task 5) — Pine-canonical helpers with no
    // invinite source.
    "nz",
    "highest",
    "lowest",
    "change",
    "valuewhen",
    "barssince",

    // MA ports (Tasks 6-8).
    "wma",
    "vwma",
    "hma",
    "smma",
    "dema",
    "tema",
    "kama",
    "alma",
    "lsma",
    "mcginley",
    "maRibbon",

    // Oscillator ports (Tasks 9-12).
    "cci",
    "stoch",
    "williamsR",
    "ppo",
    "dpo",
    "connorsRsi",
    "stochRsi",
    "ultimateOsc",
    "coppock",
    "kst",
    "fisher",
    "klinger",
    "rvgi",

    // Momentum ports (Tasks 13-14).
    "ao",
    "cmo",
    "momentum",
    "roc",
    "pmo",
    "smi",
    "tsi",

    // Trend ports (Tasks 15-17).
    "aroon",
    "aroonOsc",
    "adx",
    "dmi",
    "trix",
    "vortex",
    "trendStrengthIndex",
    "ichimoku",

    // Volatility ports (Tasks 18-20).
    "bbPercentB",
    "bbw",
    "donchian",
    "keltner",
    "envelope",
    "chop",
    "historicalVolatility",
    "rvi",
    "massIndex",

    // Volume ports (Tasks 21-24).
    "vol",
    "vwap",
    "anchoredVwap",
    "obv",
    "adl",
    "bop",
    "cmf",
    "chaikinOsc",
    "mfi",
    "netVolume",
    "pvo",
    "pvt",
    "eom",
    "nvi",
    "pvi",

    // S/R ports (Tasks 25-27).
    "psar",
    "supertrend",
    "chandelier",
    "chandeKrollStop",
    "williamsFractal",
    "zigZag",
    "pivotsHighLow",
    "pivotsStandard",
    "volatilityStop",

    // Statistical ports (Task 28).
    "median",
    "adr",
    "ulcerIndex",
] as const);

/**
 * Primitives explicitly deferred to Phase 5 per `README.md`
 * "Deferred / Follow-Up Work". The closeout asserts none of these
 * names appear in `TA_REGISTRY` — if one does, the surface contract
 * (Phase 2 is pure `ta.*` math; volume profiles + external-data
 * needs Phase-5 plumbing) has been silently violated.
 *
 * @since 0.2
 * @stable
 * @example
 *     import { PHASE_5_DEFERRED } from "@invinite-org/chartlang-conformance";
 *     // PHASE_5_DEFERRED.includes("correlationCoeff")
 *     void PHASE_5_DEFERRED;
 */
export const PHASE_5_DEFERRED: ReadonlyArray<string> = Object.freeze([
    // Multi-timeframe / external-series math.
    "correlationCoeff",

    // Volume-profile family — needs `horizontal-histogram` PlotKind
    // + viewport / anchor / session input plumbing.
    "visibleRangeVolumeProfile",
    "sessionVolumeProfile",
    "fixedRangeVolumeProfile",

    // Trade-narrative external-data primitives — need
    // `input.externalSeries` + `adapter.feedExternalSeries`.
    "transactionMarkers",
    "riskLevels",
    "tradeMaeMfeMarkers",
    "tradeCostBasis",
    "tradeEquityCurve",
    "tradeRMultiple",
    "tradeDistanceToStop",
] as const);
