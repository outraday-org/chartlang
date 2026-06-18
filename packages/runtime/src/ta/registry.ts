// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type {
    AdlOpts,
    AdrOpts,
    AdxOpts,
    AlmaOpts,
    AnchoredVolumeProfileOpts,
    AnchoredVolumeProfileResult,
    AnchoredVwapOpts,
    AoOpts,
    AroonOpts,
    AroonOscOpts,
    AroonResult,
    AtrOpts,
    BarssinceOpts,
    BbOpts,
    BbPercentBOpts,
    BbResult,
    BbwOpts,
    BopOpts,
    CciOpts,
    ChaikinOscOpts,
    ChandeKrollStopOpts,
    ChandeKrollStopResult,
    ChandelierOpts,
    ChandelierResult,
    ChangeOpts,
    ChopOpts,
    CmfOpts,
    CmoOpts,
    ConnorsRsiOpts,
    CoppockOpts,
    CrossoverOpts,
    CrossunderOpts,
    DemaOpts,
    DmiOpts,
    DmiResult,
    DonchianOpts,
    DonchianResult,
    DpoOpts,
    EmaOpts,
    EnvelopeOpts,
    EnvelopeResult,
    EomOpts,
    FisherOpts,
    FisherResult,
    FixedRangeVolumeProfileOpts,
    FixedRangeVolumeProfileResult,
    HighestOpts,
    HighestbarsOpts,
    HmaOpts,
    HvOpts,
    IchimokuOpts,
    IchimokuResult,
    KamaOpts,
    KeltnerOpts,
    KeltnerResult,
    KlingerOpts,
    KlingerResult,
    KstOpts,
    KstResult,
    LowestOpts,
    LowestbarsOpts,
    LsmaOpts,
    MaRibbonOpts,
    MaRibbonResult,
    MacdOpts,
    MacdResult,
    MassIndexOpts,
    McginleyOpts,
    MedianOpts,
    MfiOpts,
    MomentumOpts,
    NetVolumeOpts,
    NviOpts,
    ObvOpts,
    PivotsHighLowOpts,
    PivotsHighLowResult,
    PivotsStandardOpts,
    PivotsStandardResult,
    PmoOpts,
    PmoResult,
    PpoOpts,
    PpoResult,
    PsarOpts,
    PsarResult,
    PviOpts,
    PvoOpts,
    PvoResult,
    PvtOpts,
    RocOpts,
    RsiOpts,
    RvgiOpts,
    RvgiResult,
    RviOpts,
    Series,
    SessionVolumeProfileOpts,
    SessionVolumeProfileResult,
    SmaOpts,
    SmiOpts,
    SmiResult,
    SmmaOpts,
    StdevOpts,
    StochOpts,
    StochResult,
    StochRsiOpts,
    StochRsiResult,
    SupertrendOpts,
    SupertrendResult,
    TemaOpts,
    TrendStrengthIndexOpts,
    TrixOpts,
    TrixResult,
    TsiOpts,
    TsiResult,
    UlcerIndexOpts,
    UltimateOscOpts,
    ValuewhenOpts,
    VisibleRangeVolumeProfileOpts,
    VisibleRangeVolumeProfileResult,
    VolOpts,
    VolatilityStopOpts,
    VolatilityStopResult,
    VortexOpts,
    VortexResult,
    VwapOpts,
    VwmaOpts,
    WilliamsFractalOpts,
    WilliamsFractalResult,
    WilliamsROpts,
    WmaOpts,
    ZigZagOpts,
    ZigZagResult,
} from "@invinite-org/chartlang-core";

import { adl } from "./adl.js";
import { adr } from "./adr.js";
import { adx } from "./adx.js";
import { alma } from "./alma.js";
import { anchoredVolumeProfile } from "./anchoredVolumeProfile.js";
import { anchoredVwap } from "./anchoredVwap.js";
import { ao } from "./ao.js";
import { aroon } from "./aroon.js";
import { aroonOsc } from "./aroonOsc.js";
import { atr } from "./atr.js";
import { barssince } from "./barssince.js";
import { bb } from "./bb.js";
import { bbPercentB } from "./bbPercentB.js";
import { bbw } from "./bbw.js";
import { bop } from "./bop.js";
import { cci } from "./cci.js";
import { chaikinOsc } from "./chaikinOsc.js";
import { chandeKrollStop } from "./chandeKrollStop.js";
import { chandelier } from "./chandelier.js";
import { change } from "./change.js";
import { chop } from "./chop.js";
import { cmf } from "./cmf.js";
import { cmo } from "./cmo.js";
import { connorsRsi } from "./connorsRsi.js";
import { coppock } from "./coppock.js";
import { crossover } from "./crossover.js";
import { crossunder } from "./crossunder.js";
import { dema } from "./dema.js";
import { dmi } from "./dmi.js";
import { donchian } from "./donchian.js";
import { dpo } from "./dpo.js";
import { ema } from "./ema.js";
import { envelope } from "./envelope.js";
import { eom } from "./eom.js";
import { fisher } from "./fisher.js";
import { fixedRangeVolumeProfile } from "./fixedRangeVolumeProfile.js";
import { highest } from "./highest.js";
import { highestbars } from "./highestbars.js";
import { historicalVolatility } from "./historicalVolatility.js";
import { hma } from "./hma.js";
import { ichimoku } from "./ichimoku.js";
import { kama } from "./kama.js";
import { keltner } from "./keltner.js";
import { klinger } from "./klinger.js";
import { kst } from "./kst.js";
import type { ScalarOrSeries } from "./lib/sourceValue.js";
import { lowest } from "./lowest.js";
import { lowestbars } from "./lowestbars.js";
import { lsma } from "./lsma.js";
import { maRibbon } from "./maRibbon.js";
import { macd } from "./macd.js";
import { massIndex } from "./massIndex.js";
import { mcginley } from "./mcginley.js";
import { median } from "./median.js";
import { mfi } from "./mfi.js";
import { momentum } from "./momentum.js";
import { netVolume } from "./netVolume.js";
import { nvi } from "./nvi.js";
import { nz } from "./nz.js";
import { obv } from "./obv.js";
import { pivotsHighLow } from "./pivotsHighLow.js";
import { pivotsStandard } from "./pivotsStandard.js";
import { pmo } from "./pmo.js";
import { ppo } from "./ppo.js";
import { psar } from "./psar.js";
import { pvi } from "./pvi.js";
import { pvo } from "./pvo.js";
import { pvt } from "./pvt.js";
import { roc } from "./roc.js";
import { rsi } from "./rsi.js";
import { rvgi } from "./rvgi.js";
import { rvi } from "./rvi.js";
import { sessionVolumeProfile } from "./sessionVolumeProfile.js";
import { sma } from "./sma.js";
import { smi } from "./smi.js";
import { smma } from "./smma.js";
import { stdev } from "./stdev.js";
import { stoch } from "./stoch.js";
import { stochRsi } from "./stochRsi.js";
import { supertrend } from "./supertrend.js";
import { tema } from "./tema.js";
import { trendStrengthIndex } from "./trendStrengthIndex.js";
import { trix } from "./trix.js";
import { tsi } from "./tsi.js";
import { ulcerIndex } from "./ulcerIndex.js";
import { ultimateOsc } from "./ultimateOsc.js";
import { valuewhen } from "./valuewhen.js";
import { visibleRangeVolumeProfile } from "./visibleRangeVolumeProfile.js";
import { vol } from "./vol.js";
import { volatilityStop } from "./volatilityStop.js";
import { vortex } from "./vortex.js";
import { vwap } from "./vwap.js";
import { vwma } from "./vwma.js";
import { williamsFractal } from "./williamsFractal.js";
import { williamsR } from "./williamsR.js";
import { wma } from "./wma.js";
import { zigZag } from "./zigZag.js";

/**
 * The runtime-facing surface of the `ta` namespace. Each method takes
 * a compiler-injected `slotId` as its first argument, then the user-
 * facing arguments core's `TaNamespace` types. The compiler (Task 2)
 * inlines the slot id as a string literal at every callsite so the
 * runtime can look up its per-callsite hidden state in
 * `RuntimeContext.stream.taSlots`. Script authors never see the slot
 * arg — they import `ta` and call `ta.ema(close, 20)`; the bundled
 * output becomes `runtime.ta.ema("slot-id", close, 20)`.
 *
 * @formula  N/A — type surface, see per-primitive JSDoc
 * @since 0.1
 * @stable
 * @example
 *     // import type { RuntimeTaNamespace } from "@invinite-org/chartlang-runtime";
 *     // const fn: RuntimeTaNamespace["ema"] = (slotId, src, length) =>
 *     //     ({ current: NaN, length: 0 }) as never;
 */
export type RuntimeTaNamespace = {
    sma(slotId: string, source: ScalarOrSeries, length: number, opts?: SmaOpts): Series<number>;
    ema(slotId: string, source: ScalarOrSeries, length: number, opts?: EmaOpts): Series<number>;
    stdev(slotId: string, source: ScalarOrSeries, length: number, opts?: StdevOpts): Series<number>;
    bb(slotId: string, source: ScalarOrSeries, length: number, opts?: BbOpts): BbResult;
    rsi(slotId: string, source: ScalarOrSeries, length: number, opts?: RsiOpts): Series<number>;
    macd(slotId: string, source: ScalarOrSeries, opts?: MacdOpts): MacdResult;
    atr(slotId: string, length: number, opts?: AtrOpts): Series<number>;
    crossover(
        slotId: string,
        a: ScalarOrSeries,
        b: ScalarOrSeries,
        opts?: CrossoverOpts,
    ): Series<boolean>;
    crossunder(
        slotId: string,
        a: ScalarOrSeries,
        b: ScalarOrSeries,
        opts?: CrossunderOpts,
    ): Series<boolean>;
    nz(value: number, replacement?: number): number;
    highest(
        slotId: string,
        source: ScalarOrSeries,
        length: number,
        opts?: HighestOpts,
    ): Series<number>;
    lowest(
        slotId: string,
        source: ScalarOrSeries,
        length: number,
        opts?: LowestOpts,
    ): Series<number>;
    highestbars(
        slotId: string,
        source: ScalarOrSeries,
        length: number,
        opts?: HighestbarsOpts,
    ): Series<number>;
    lowestbars(
        slotId: string,
        source: ScalarOrSeries,
        length: number,
        opts?: LowestbarsOpts,
    ): Series<number>;
    change(slotId: string, source: ScalarOrSeries, opts?: ChangeOpts): Series<number>;
    valuewhen(
        slotId: string,
        condition: Series<boolean>,
        source: ScalarOrSeries,
        occurrence?: number,
        opts?: ValuewhenOpts,
    ): Series<number>;
    barssince(slotId: string, condition: Series<boolean>, opts?: BarssinceOpts): Series<number>;
    wma(slotId: string, source: ScalarOrSeries, length: number, opts?: WmaOpts): Series<number>;
    vwma(slotId: string, source: ScalarOrSeries, length: number, opts?: VwmaOpts): Series<number>;
    hma(slotId: string, source: ScalarOrSeries, length: number, opts?: HmaOpts): Series<number>;
    smma(slotId: string, source: ScalarOrSeries, length: number, opts?: SmmaOpts): Series<number>;
    dema(slotId: string, source: ScalarOrSeries, length: number, opts?: DemaOpts): Series<number>;
    tema(slotId: string, source: ScalarOrSeries, length: number, opts?: TemaOpts): Series<number>;
    kama(slotId: string, source: ScalarOrSeries, opts?: KamaOpts): Series<number>;
    alma(slotId: string, source: ScalarOrSeries, length: number, opts?: AlmaOpts): Series<number>;
    lsma(slotId: string, source: ScalarOrSeries, length: number, opts?: LsmaOpts): Series<number>;
    mcginley(
        slotId: string,
        source: ScalarOrSeries,
        length: number,
        opts?: McginleyOpts,
    ): Series<number>;
    maRibbon(slotId: string, source: ScalarOrSeries, opts?: MaRibbonOpts): MaRibbonResult;
    ao(slotId: string, opts?: AoOpts): Series<number>;
    cmo(slotId: string, source: ScalarOrSeries, length: number, opts?: CmoOpts): Series<number>;
    momentum(
        slotId: string,
        source: ScalarOrSeries,
        length: number,
        opts?: MomentumOpts,
    ): Series<number>;
    roc(slotId: string, source: ScalarOrSeries, length: number, opts?: RocOpts): Series<number>;
    pmo(slotId: string, source: ScalarOrSeries, opts?: PmoOpts): PmoResult;
    smi(slotId: string, opts?: SmiOpts): SmiResult;
    tsi(slotId: string, source: ScalarOrSeries, opts?: TsiOpts): TsiResult;
    cci(slotId: string, source: ScalarOrSeries, length: number, opts?: CciOpts): Series<number>;
    stoch(slotId: string, opts?: StochOpts): StochResult;
    williamsR(slotId: string, length: number, opts?: WilliamsROpts): Series<number>;
    stochRsi(slotId: string, source: ScalarOrSeries, opts?: StochRsiOpts): StochRsiResult;
    ultimateOsc(slotId: string, opts?: UltimateOscOpts): Series<number>;
    coppock(slotId: string, source: ScalarOrSeries, opts?: CoppockOpts): Series<number>;
    ppo(slotId: string, source: ScalarOrSeries, opts?: PpoOpts): PpoResult;
    dpo(slotId: string, source: ScalarOrSeries, length: number, opts?: DpoOpts): Series<number>;
    connorsRsi(slotId: string, source: ScalarOrSeries, opts?: ConnorsRsiOpts): Series<number>;
    kst(slotId: string, source: ScalarOrSeries, opts?: KstOpts): KstResult;
    fisher(slotId: string, length: number, opts?: FisherOpts): FisherResult;
    klinger(slotId: string, opts?: KlingerOpts): KlingerResult;
    rvgi(slotId: string, opts?: RvgiOpts): RvgiResult;
    aroon(slotId: string, length: number, opts?: AroonOpts): AroonResult;
    aroonOsc(slotId: string, length: number, opts?: AroonOscOpts): Series<number>;
    vol(slotId: string, opts?: VolOpts): Series<number>;
    vwap(slotId: string, opts?: VwapOpts): Series<number>;
    anchoredVwap(slotId: string, anchorTime: number, opts?: AnchoredVwapOpts): Series<number>;
    anchoredVolumeProfile(
        slotId: string,
        opts: AnchoredVolumeProfileOpts,
    ): AnchoredVolumeProfileResult;
    fixedRangeVolumeProfile(
        slotId: string,
        opts: FixedRangeVolumeProfileOpts,
    ): FixedRangeVolumeProfileResult;
    sessionVolumeProfile(
        slotId: string,
        opts?: SessionVolumeProfileOpts,
    ): SessionVolumeProfileResult;
    visibleRangeVolumeProfile(
        slotId: string,
        opts?: VisibleRangeVolumeProfileOpts,
    ): VisibleRangeVolumeProfileResult;
    obv(slotId: string, opts?: ObvOpts): Series<number>;
    adl(slotId: string, opts?: AdlOpts): Series<number>;
    bop(slotId: string, opts?: BopOpts): Series<number>;
    cmf(slotId: string, length: number, opts?: CmfOpts): Series<number>;
    chaikinOsc(slotId: string, opts?: ChaikinOscOpts): Series<number>;
    mfi(slotId: string, length: number, opts?: MfiOpts): Series<number>;
    netVolume(slotId: string, opts?: NetVolumeOpts): Series<number>;
    pvo(slotId: string, opts?: PvoOpts): PvoResult;
    pvt(slotId: string, opts?: PvtOpts): Series<number>;
    eom(slotId: string, length: number, opts?: EomOpts): Series<number>;
    nvi(slotId: string, opts?: NviOpts): Series<number>;
    pvi(slotId: string, opts?: PviOpts): Series<number>;
    bbPercentB(
        slotId: string,
        source: ScalarOrSeries,
        length: number,
        opts?: BbPercentBOpts,
    ): Series<number>;
    bbw(slotId: string, source: ScalarOrSeries, length: number, opts?: BbwOpts): Series<number>;
    donchian(slotId: string, length: number, opts?: DonchianOpts): DonchianResult;
    keltner(slotId: string, opts?: KeltnerOpts): KeltnerResult;
    envelope(slotId: string, source: ScalarOrSeries, opts?: EnvelopeOpts): EnvelopeResult;
    chop(slotId: string, length: number, opts?: ChopOpts): Series<number>;
    median(
        slotId: string,
        source: ScalarOrSeries,
        length: number,
        opts?: MedianOpts,
    ): Series<number>;
    adr(slotId: string, opts?: AdrOpts): Series<number>;
    ulcerIndex(
        slotId: string,
        source: ScalarOrSeries,
        length: number,
        opts?: UlcerIndexOpts,
    ): Series<number>;
    historicalVolatility(
        slotId: string,
        source: ScalarOrSeries,
        length: number,
        opts?: HvOpts,
    ): Series<number>;
    rvi(slotId: string, source: ScalarOrSeries, length: number, opts?: RviOpts): Series<number>;
    massIndex(slotId: string, opts?: MassIndexOpts): Series<number>;
    psar(slotId: string, opts?: PsarOpts): PsarResult;
    supertrend(slotId: string, opts?: SupertrendOpts): SupertrendResult;
    chandelier(slotId: string, opts?: ChandelierOpts): ChandelierResult;
    chandeKrollStop(slotId: string, opts?: ChandeKrollStopOpts): ChandeKrollStopResult;
    williamsFractal(slotId: string, opts?: WilliamsFractalOpts): WilliamsFractalResult;
    zigZag(slotId: string, opts?: ZigZagOpts): ZigZagResult;
    pivotsHighLow(slotId: string, opts?: PivotsHighLowOpts): PivotsHighLowResult;
    pivotsStandard(slotId: string, opts?: PivotsStandardOpts): PivotsStandardResult;
    volatilityStop(slotId: string, opts?: VolatilityStopOpts): VolatilityStopResult;
    adx(slotId: string, length: number, opts?: AdxOpts): Series<number>;
    dmi(slotId: string, length: number, opts?: DmiOpts): DmiResult;
    trix(slotId: string, source: ScalarOrSeries, length: number, opts?: TrixOpts): TrixResult;
    vortex(slotId: string, length: number, opts?: VortexOpts): VortexResult;
    trendStrengthIndex(
        slotId: string,
        source: ScalarOrSeries,
        length: number,
        opts?: TrendStrengthIndexOpts,
    ): Series<number>;
    ichimoku(slotId: string, opts?: IchimokuOpts): IchimokuResult;
};

/**
 * Frozen registry of every Phase-1 + Phase-2 `ta.*` primitive. Wave-5
 * cardinality grows as each parallel task lands; the final Phase-2
 * count is verified at closeout (Task 30). Phase-1 ships 9; cross-
 * functional Task 5 adds 6; Task 6 adds 4 MA ports (`wma`, `vwma`,
 * `hma`, `smma`); Task 9 adds 3 oscillators; Task 13 adds 4 momentum;
 * Task 15 adds 2 trend.
 *
 * @formula  N/A — frozen registry, see per-primitive JSDoc
 * @since 0.1
 * @stable
 * @example
 *     // import { TA_REGISTRY } from "@invinite-org/chartlang-runtime";
 *     // const keys = Object.keys(TA_REGISTRY);
 */
export const TA_REGISTRY = Object.freeze({
    sma,
    ema,
    stdev,
    bb,
    rsi,
    macd,
    atr,
    crossover,
    crossunder,
    nz,
    highest,
    lowest,
    highestbars,
    lowestbars,
    change,
    valuewhen,
    barssince,
    wma,
    vwma,
    hma,
    smma,
    dema,
    tema,
    kama,
    alma,
    lsma,
    mcginley,
    maRibbon,
    ao,
    cmo,
    momentum,
    roc,
    pmo,
    smi,
    tsi,
    cci,
    stoch,
    williamsR,
    stochRsi,
    ultimateOsc,
    coppock,
    ppo,
    dpo,
    connorsRsi,
    kst,
    fisher,
    klinger,
    rvgi,
    aroon,
    aroonOsc,
    vol,
    vwap,
    anchoredVwap,
    anchoredVolumeProfile,
    fixedRangeVolumeProfile,
    sessionVolumeProfile,
    visibleRangeVolumeProfile,
    obv,
    adl,
    bop,
    cmf,
    chaikinOsc,
    mfi,
    netVolume,
    pvo,
    pvt,
    eom,
    nvi,
    pvi,
    bbPercentB,
    bbw,
    donchian,
    keltner,
    envelope,
    chop,
    median,
    adr,
    ulcerIndex,
    historicalVolatility,
    rvi,
    massIndex,
    psar,
    supertrend,
    chandelier,
    chandeKrollStop,
    williamsFractal,
    zigZag,
    pivotsHighLow,
    pivotsStandard,
    volatilityStop,
    adx,
    dmi,
    trix,
    vortex,
    trendStrengthIndex,
    ichimoku,
} as const);

/**
 * Y-domain hint a primitive can advertise. `"auto"` is the default —
 * the renderer fits the visible-window data range. `"fixed"` pins the
 * range to a `[min, max]` interval (bounded oscillators like Stoch /
 * Williams %R).
 *
 * @formula  N/A — metadata type, see consumer renderers
 * @since 0.2
 * @stable
 * @example
 *     // const stochYDomain: YDomainSpec = { kind: "fixed", min: 0, max: 100 };
 */
export type YDomainSpec = Readonly<{ kind: "auto" } | { kind: "fixed"; min: number; max: number }>;

/**
 * Per-primitive metadata layer the registry surfaces for renderers
 * (pane layout, legend ordering, y-axis scaling). Every field is
 * optional — primitives that don't advertise metadata default to
 * `primarySeriesKey = "default"` and `yDomain = { kind: "auto" }` in
 * the consumer. Phase-2 Task 9 introduces this surface; future
 * bounded oscillators (`stochRsi`, `ultimateOsc`) populate it
 * verbatim.
 *
 * @formula  N/A — metadata type, see consumer renderers
 * @since 0.2
 * @stable
 * @example
 *     // const meta: PrimitiveMetadata = {
 *     //     primarySeriesKey: "k",
 *     //     visibleSeriesKeys: ["k", "d"],
 *     //     yDomain: { kind: "fixed", min: 0, max: 100 },
 *     // };
 */
export type PrimitiveMetadata = Readonly<{
    primarySeriesKey?: string;
    visibleSeriesKeys?: ReadonlyArray<string>;
    yDomain?: YDomainSpec;
}>;

/**
 * Frozen metadata table keyed by `TA_REGISTRY` id. Only primitives
 * with a non-default metadata payload appear. `ta.stoch` records its
 * `[0, 100]` range + `primarySeriesKey: "k"` + the visible-series
 * order for the legend. `ta.williamsR` records its `[-100, 0]` range.
 * Phase-1 entries + the cross-functional Task-5 entries are
 * unannotated.
 *
 * @formula  N/A — frozen metadata table, see per-primitive `PrimitiveMetadata`
 * @since 0.2
 * @stable
 * @example
 *     // import { TA_REGISTRY_METADATA } from "@invinite-org/chartlang-runtime";
 *     // const stochMeta = TA_REGISTRY_METADATA.stoch;
 */
export const TA_REGISTRY_METADATA: Readonly<
    Partial<Record<keyof typeof TA_REGISTRY, PrimitiveMetadata>>
> = Object.freeze({
    stoch: Object.freeze({
        primarySeriesKey: "k",
        visibleSeriesKeys: Object.freeze(["k", "d"]) as ReadonlyArray<string>,
        yDomain: Object.freeze({ kind: "fixed", min: 0, max: 100 } as const),
    }),
    williamsR: Object.freeze({
        yDomain: Object.freeze({ kind: "fixed", min: -100, max: 0 } as const),
    }),
    stochRsi: Object.freeze({
        primarySeriesKey: "k",
        visibleSeriesKeys: Object.freeze(["k", "d"]) as ReadonlyArray<string>,
        yDomain: Object.freeze({ kind: "fixed", min: 0, max: 100 } as const),
    }),
    ultimateOsc: Object.freeze({
        yDomain: Object.freeze({ kind: "fixed", min: 0, max: 100 } as const),
    }),
    ppo: Object.freeze({
        primarySeriesKey: "ppo",
        visibleSeriesKeys: Object.freeze(["ppo", "signal", "hist"]) as ReadonlyArray<string>,
        yDomain: Object.freeze({ kind: "auto" } as const),
    }),
    pvo: Object.freeze({
        primarySeriesKey: "pvo",
        visibleSeriesKeys: Object.freeze(["pvo", "signal", "hist"]) as ReadonlyArray<string>,
        yDomain: Object.freeze({ kind: "auto" } as const),
    }),
    sessionVolumeProfile: Object.freeze({
        primarySeriesKey: "poc",
        visibleSeriesKeys: Object.freeze(["poc", "valHigh", "valLow"]) as ReadonlyArray<string>,
        yDomain: Object.freeze({ kind: "auto" } as const),
    }),
    fixedRangeVolumeProfile: Object.freeze({
        primarySeriesKey: "poc",
        visibleSeriesKeys: Object.freeze(["poc", "valHigh", "valLow"]) as ReadonlyArray<string>,
        yDomain: Object.freeze({ kind: "auto" } as const),
    }),
    connorsRsi: Object.freeze({
        yDomain: Object.freeze({ kind: "fixed", min: 0, max: 100 } as const),
    }),
    pmo: Object.freeze({
        primarySeriesKey: "pmo",
        visibleSeriesKeys: Object.freeze(["pmo", "signal"]) as ReadonlyArray<string>,
        yDomain: Object.freeze({ kind: "auto" } as const),
    }),
    smi: Object.freeze({
        primarySeriesKey: "smi",
        visibleSeriesKeys: Object.freeze(["smi", "signal"]) as ReadonlyArray<string>,
        yDomain: Object.freeze({ kind: "fixed", min: -100, max: 100 } as const),
    }),
    tsi: Object.freeze({
        primarySeriesKey: "tsi",
        visibleSeriesKeys: Object.freeze(["tsi", "signal"]) as ReadonlyArray<string>,
        yDomain: Object.freeze({ kind: "auto" } as const),
    }),
    kst: Object.freeze({
        primarySeriesKey: "kst",
        visibleSeriesKeys: Object.freeze(["kst", "signal"]) as ReadonlyArray<string>,
        yDomain: Object.freeze({ kind: "auto" } as const),
    }),
    fisher: Object.freeze({
        primarySeriesKey: "fisher",
        visibleSeriesKeys: Object.freeze(["fisher", "trigger"]) as ReadonlyArray<string>,
        yDomain: Object.freeze({ kind: "auto" } as const),
    }),
    klinger: Object.freeze({
        primarySeriesKey: "klinger",
        visibleSeriesKeys: Object.freeze(["klinger", "signal"]) as ReadonlyArray<string>,
        yDomain: Object.freeze({ kind: "auto" } as const),
    }),
    rvgi: Object.freeze({
        primarySeriesKey: "rvgi",
        visibleSeriesKeys: Object.freeze(["rvgi", "signal"]) as ReadonlyArray<string>,
        yDomain: Object.freeze({ kind: "auto" } as const),
    }),
    anchoredVolumeProfile: Object.freeze({
        primarySeriesKey: "poc",
        visibleSeriesKeys: Object.freeze(["poc", "valHigh", "valLow"]) as ReadonlyArray<string>,
        yDomain: Object.freeze({ kind: "auto" } as const),
    }),
    aroon: Object.freeze({
        primarySeriesKey: "up",
        visibleSeriesKeys: Object.freeze(["up", "down"]) as ReadonlyArray<string>,
        yDomain: Object.freeze({ kind: "fixed", min: 0, max: 100 } as const),
    }),
    aroonOsc: Object.freeze({
        yDomain: Object.freeze({ kind: "fixed", min: -100, max: 100 } as const),
    }),
    donchian: Object.freeze({
        primarySeriesKey: "middle",
        visibleSeriesKeys: Object.freeze(["upper", "middle", "lower"]) as ReadonlyArray<string>,
        yDomain: Object.freeze({ kind: "auto" } as const),
    }),
    keltner: Object.freeze({
        primarySeriesKey: "middle",
        visibleSeriesKeys: Object.freeze(["upper", "middle", "lower"]) as ReadonlyArray<string>,
        yDomain: Object.freeze({ kind: "auto" } as const),
    }),
    envelope: Object.freeze({
        primarySeriesKey: "middle",
        visibleSeriesKeys: Object.freeze(["upper", "middle", "lower"]) as ReadonlyArray<string>,
        yDomain: Object.freeze({ kind: "auto" } as const),
    }),
    chop: Object.freeze({
        yDomain: Object.freeze({ kind: "fixed", min: 0, max: 100 } as const),
    }),
    psar: Object.freeze({
        primarySeriesKey: "sar",
        visibleSeriesKeys: Object.freeze(["sar", "direction"]) as ReadonlyArray<string>,
        yDomain: Object.freeze({ kind: "auto" } as const),
    }),
    supertrend: Object.freeze({
        primarySeriesKey: "line",
        visibleSeriesKeys: Object.freeze(["line", "direction"]) as ReadonlyArray<string>,
        yDomain: Object.freeze({ kind: "auto" } as const),
    }),
    chandelier: Object.freeze({
        primarySeriesKey: "long",
        visibleSeriesKeys: Object.freeze(["long", "short"]) as ReadonlyArray<string>,
        yDomain: Object.freeze({ kind: "auto" } as const),
    }),
    chandeKrollStop: Object.freeze({
        primarySeriesKey: "long",
        visibleSeriesKeys: Object.freeze(["long", "short"]) as ReadonlyArray<string>,
        yDomain: Object.freeze({ kind: "auto" } as const),
    }),
    williamsFractal: Object.freeze({
        primarySeriesKey: "up",
        visibleSeriesKeys: Object.freeze(["up", "down"]) as ReadonlyArray<string>,
        yDomain: Object.freeze({ kind: "auto" } as const),
    }),
    zigZag: Object.freeze({
        primarySeriesKey: "value",
        visibleSeriesKeys: Object.freeze(["value", "direction"]) as ReadonlyArray<string>,
        yDomain: Object.freeze({ kind: "auto" } as const),
    }),
    pivotsHighLow: Object.freeze({
        primarySeriesKey: "high",
        visibleSeriesKeys: Object.freeze(["high", "low"]) as ReadonlyArray<string>,
        yDomain: Object.freeze({ kind: "auto" } as const),
    }),
    pivotsStandard: Object.freeze({
        primarySeriesKey: "pp",
        visibleSeriesKeys: Object.freeze([
            "pp",
            "r1",
            "s1",
            "r2",
            "s2",
            "r3",
            "s3",
        ]) as ReadonlyArray<string>,
        yDomain: Object.freeze({ kind: "auto" } as const),
    }),
    volatilityStop: Object.freeze({
        primarySeriesKey: "value",
        visibleSeriesKeys: Object.freeze(["value", "direction"]) as ReadonlyArray<string>,
        yDomain: Object.freeze({ kind: "auto" } as const),
    }),
    maRibbon: Object.freeze({
        primarySeriesKey: "ma_50",
        visibleSeriesKeys: Object.freeze([
            "ma_10",
            "ma_20",
            "ma_30",
            "ma_40",
            "ma_50",
        ]) as ReadonlyArray<string>,
        yDomain: Object.freeze({ kind: "auto" } as const),
    }),
    adx: Object.freeze({
        yDomain: Object.freeze({ kind: "fixed", min: 0, max: 100 } as const),
    }),
    dmi: Object.freeze({
        primarySeriesKey: "plusDi",
        visibleSeriesKeys: Object.freeze(["plusDi", "minusDi"]) as ReadonlyArray<string>,
        yDomain: Object.freeze({ kind: "fixed", min: 0, max: 100 } as const),
    }),
    trix: Object.freeze({
        primarySeriesKey: "trix",
        visibleSeriesKeys: Object.freeze(["trix", "signal"]) as ReadonlyArray<string>,
        yDomain: Object.freeze({ kind: "auto" } as const),
    }),
    vortex: Object.freeze({
        primarySeriesKey: "plus",
        visibleSeriesKeys: Object.freeze(["plus", "minus"]) as ReadonlyArray<string>,
        yDomain: Object.freeze({ kind: "auto" } as const),
    }),
    trendStrengthIndex: Object.freeze({
        yDomain: Object.freeze({ kind: "fixed", min: -1, max: 1 } as const),
    }),
    ichimoku: Object.freeze({
        primarySeriesKey: "tenkan",
        visibleSeriesKeys: Object.freeze([
            "tenkan",
            "kijun",
            "senkouA",
            "senkouB",
            "chikou",
        ]) as ReadonlyArray<string>,
        yDomain: Object.freeze({ kind: "auto" } as const),
    }),
});

/**
 * The script-facing `ta` constant the compiler binds against. Equal
 * by identity to {@link TA_REGISTRY}; typed as the slot-aware
 * {@link RuntimeTaNamespace} so downstream consumers (the host-worker
 * boot, the conformance harness) get the runtime signature.
 *
 * @formula  N/A — script-facing namespace, see per-primitive JSDoc
 * @since 0.1
 * @stable
 * @example
 *     // import { ta } from "@invinite-org/chartlang-runtime";
 *     // const out = ta.ema("slot-id", { current: 12 }, 20);
 */
export const ta: RuntimeTaNamespace = TA_REGISTRY;
