// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import ts from "typescript";

/**
 * Virtual on-disk path the in-memory `@invinite-org/chartlang-core` ambient
 * declaration file is served from. Kept stable so the analysis passes can
 * detect callee declarations coming from core (vs. user-shadowed names).
 *
 * @since 0.1
 * @example
 *     import { CORE_MODULE_PATH } from "@invinite-org/chartlang-compiler/program";
 *     void CORE_MODULE_PATH;
 */
export const CORE_MODULE_PATH = "/__chartlang__/core.d.ts";

/**
 * Ambient `.d.ts` shim covering the exact `@invinite-org/chartlang-core`
 * surface the compiler needs for symbol resolution. Lives in-memory so the
 * compiler is deterministic and host-machine independent — no on-disk
 * resolution of `workspace:*` packages required.
 *
 * The shim mirrors the runtime types; it does NOT carry the throw-sentinel
 * bodies the real callable holes ship. That doesn't matter — the compiler
 * only does static analysis; it never executes script source.
 */
const CORE_AMBIENT_SHIM = `
declare module "@invinite-org/chartlang-core" {
    export type Time = number;
    export type Price = number;
    export type Volume = number;
    export type Color = string;
    export type LineStyle = "solid" | "dashed" | "dotted";
    export type AlertSeverity = "info" | "warning" | "critical";
    export type CapabilityId = "indicators" | "drawings" | "alerts";
    export type ValueFormat = "price" | "volume" | "percent" | "compact";
    export type ScaleAxis = "price" | "left" | "right" | "new";
    export type DrawingCounts = {
        readonly lines: number;
        readonly labels: number;
        readonly boxes: number;
        readonly polylines: number;
        readonly other: number;
    };
    export type ScriptOverrides = Readonly<{
        maxBarsBack?: number;
        format?: ValueFormat;
        precision?: number;
        scale?: ScaleAxis;
        requiresIntervals?: ReadonlyArray<string>;
        shortName?: string;
    }>;
    export type Bar = {
        readonly time: Time;
        readonly open: Price;
        readonly high: Price;
        readonly low: Price;
        readonly close: Price;
        readonly volume: Volume;
        readonly symbol: string;
        readonly interval: string;
        readonly hl2: Price;
        readonly hlc3: Price;
        readonly ohlc4: Price;
        readonly hlcc4: Price;
    };
    export type Series<T> = {
        readonly current: T;
        readonly [n: number]: T;
        readonly length: number;
    };
    export type SmaOpts = Readonly<{ offset?: number }>;
    export type EmaOpts = Readonly<{ offset?: number }>;
    export type StdevOpts = Readonly<{ biased?: boolean; offset?: number }>;
    export type BbOpts = Readonly<{ multiplier?: number; offset?: number }>;
    export type RsiOpts = Readonly<{ offset?: number }>;
    export type MacdOpts = Readonly<{
        fastLength?: number;
        slowLength?: number;
        signalLength?: number;
        offset?: number;
    }>;
    export type AtrOpts = Readonly<{ offset?: number }>;
    export type CrossoverOpts = Readonly<{ offset?: number }>;
    export type CrossunderOpts = Readonly<{ offset?: number }>;
    export type HighestOpts = Readonly<{ offset?: number }>;
    export type LowestOpts = Readonly<{ offset?: number }>;
    export type ChangeOpts = Readonly<{ length?: number; offset?: number }>;
    export type PlotLineStyle = "line" | "step" | "dashed" | "circles" | "cross";
    export type WmaOpts = Readonly<{ offset?: number; lineStyle?: PlotLineStyle }>;
    export type VwmaOpts = Readonly<{ offset?: number; lineStyle?: PlotLineStyle }>;
    export type HmaOpts = Readonly<{ offset?: number; lineStyle?: PlotLineStyle }>;
    export type SmmaOpts = Readonly<{ offset?: number; lineStyle?: PlotLineStyle }>;
    export type DemaOpts = Readonly<{ offset?: number; lineStyle?: PlotLineStyle }>;
    export type TemaOpts = Readonly<{ offset?: number; lineStyle?: PlotLineStyle }>;
    export type KamaOpts = Readonly<{
        length?: number;
        fastLength?: number;
        slowLength?: number;
        offset?: number;
        lineStyle?: PlotLineStyle;
    }>;
    export type AlmaOpts = Readonly<{
        offset?: number;
        sigma?: number;
        barShift?: number;
        lineStyle?: PlotLineStyle;
    }>;
    export type LsmaOpts = Readonly<{ offset?: number; lineStyle?: PlotLineStyle }>;
    export type McginleyOpts = Readonly<{ offset?: number; lineStyle?: PlotLineStyle }>;
    export type MaTypeNoVolume = "sma" | "ema" | "wma" | "smma";
    export type MaRibbonOpts = Readonly<{
        lengths?: ReadonlyArray<number>;
        maType?: MaTypeNoVolume;
        offset?: number;
        outputs?: Readonly<Record<string, { lineStyle?: PlotLineStyle }>>;
    }>;
    export type MaRibbonResult = Readonly<Record<string, Series<number>>>;
    export type AoOpts = Readonly<{
        fastLength?: number;
        slowLength?: number;
        offset?: number;
        lineStyle?: PlotLineStyle;
    }>;
    export type CmoOpts = Readonly<{ offset?: number; lineStyle?: PlotLineStyle }>;
    export type MomentumOpts = Readonly<{ offset?: number; lineStyle?: PlotLineStyle }>;
    export type RocOpts = Readonly<{ offset?: number; lineStyle?: PlotLineStyle }>;
    export type CciOpts = Readonly<{ offset?: number; lineStyle?: PlotLineStyle }>;
    export type StochOpts = Readonly<{
        kLength?: number;
        kSmoothing?: number;
        dLength?: number;
        offset?: number;
    }>;
    export type WilliamsROpts = Readonly<{ offset?: number; lineStyle?: PlotLineStyle }>;
    export type StochResult = Readonly<{
        k: Series<number>;
        d: Series<number>;
    }>;
    export type StochRsiOpts = Readonly<{
        rsiLength?: number;
        stochLength?: number;
        kSmoothing?: number;
        dSmoothing?: number;
        offset?: number;
    }>;
    export type StochRsiResult = Readonly<{
        k: Series<number>;
        d: Series<number>;
    }>;
    export type UltimateOscOpts = Readonly<{
        shortLength?: number;
        mediumLength?: number;
        longLength?: number;
        offset?: number;
        lineStyle?: PlotLineStyle;
    }>;
    export type CoppockOpts = Readonly<{
        roc1Length?: number;
        roc2Length?: number;
        wmaLength?: number;
        offset?: number;
        lineStyle?: PlotLineStyle;
    }>;
    export type PpoOpts = Readonly<{
        fastLength?: number;
        slowLength?: number;
        signalLength?: number;
        offset?: number;
    }>;
    export type PpoResult = Readonly<{
        ppo: Series<number>;
        signal: Series<number>;
        hist: Series<number>;
    }>;
    export type DpoOpts = Readonly<{ offset?: number; lineStyle?: PlotLineStyle }>;
    export type ConnorsRsiOpts = Readonly<{
        rsiLength?: number;
        streakLength?: number;
        rocLength?: number;
        offset?: number;
    }>;
    export type KstOpts = Readonly<{
        roc1Length?: number;
        roc2Length?: number;
        roc3Length?: number;
        roc4Length?: number;
        roc1Smooth?: number;
        roc2Smooth?: number;
        roc3Smooth?: number;
        roc4Smooth?: number;
        signalLength?: number;
        offset?: number;
    }>;
    export type KstResult = Readonly<{
        kst: Series<number>;
        signal: Series<number>;
    }>;
    export type FisherOpts = Readonly<{ offset?: number }>;
    export type FisherResult = Readonly<{
        fisher: Series<number>;
        trigger: Series<number>;
    }>;
    export type KlingerOpts = Readonly<{
        fastLength?: number;
        slowLength?: number;
        signalLength?: number;
        offset?: number;
    }>;
    export type KlingerResult = Readonly<{
        klinger: Series<number>;
        signal: Series<number>;
    }>;
    export type RvgiOpts = Readonly<{
        length?: number;
        offset?: number;
    }>;
    export type RvgiResult = Readonly<{
        rvgi: Series<number>;
        signal: Series<number>;
    }>;
    export type AroonOpts = Readonly<{
        offset?: number;
        outputs?: Readonly<Record<"up" | "down", { lineStyle?: PlotLineStyle }>>;
    }>;
    export type AroonOscOpts = Readonly<{ offset?: number; lineStyle?: PlotLineStyle }>;
    export type VolOpts = Readonly<{ offset?: number }>;
    export type VwapOpts = Readonly<{
        source?: "hlc3" | "close" | "hl2" | "ohlc4" | "hlcc4";
        offset?: number;
    }>;
    export type AnchoredVwapOpts = Readonly<{
        source?: "hlc3" | "close" | "hl2" | "ohlc4" | "hlcc4";
        offset?: number;
    }>;
    export type ObvOpts = Readonly<{ offset?: number; lineStyle?: PlotLineStyle }>;
    export type AdlOpts = Readonly<{ offset?: number; lineStyle?: PlotLineStyle }>;
    export type BopOpts = Readonly<{ offset?: number; lineStyle?: PlotLineStyle }>;
    export type CmfOpts = Readonly<{ offset?: number; lineStyle?: PlotLineStyle }>;
    export type ChaikinOscOpts = Readonly<{
        fastLength?: number;
        slowLength?: number;
        offset?: number;
    }>;
    export type MfiOpts = Readonly<{ offset?: number; lineStyle?: PlotLineStyle }>;
    export type NetVolumeOpts = Readonly<{ offset?: number; lineStyle?: PlotLineStyle }>;
    export type PvoOpts = Readonly<{
        fastLength?: number;
        slowLength?: number;
        signalLength?: number;
        offset?: number;
    }>;
    export type PvoResult = Readonly<{
        pvo: Series<number>;
        signal: Series<number>;
        hist: Series<number>;
    }>;
    export type PvtOpts = Readonly<{ offset?: number; lineStyle?: PlotLineStyle }>;
    export type EomOpts = Readonly<{ offset?: number; lineStyle?: PlotLineStyle }>;
    export type NviOpts = Readonly<{ offset?: number; lineStyle?: PlotLineStyle }>;
    export type PviOpts = Readonly<{ offset?: number; lineStyle?: PlotLineStyle }>;
    export type PsarOpts = Readonly<{
        accelerationStart?: number;
        accelerationStep?: number;
        accelerationMax?: number;
        offset?: number;
    }>;
    export type PsarResult = Readonly<{
        sar: Series<number>;
        direction: Series<number>;
    }>;
    export type SupertrendOpts = Readonly<{
        length?: number;
        multiplier?: number;
        offset?: number;
    }>;
    export type SupertrendResult = Readonly<{
        line: Series<number>;
        direction: Series<number>;
    }>;
    export type ChandelierOpts = Readonly<{
        length?: number;
        multiplier?: number;
        offset?: number;
    }>;
    export type ChandelierResult = Readonly<{
        long: Series<number>;
        short: Series<number>;
    }>;
    export type ChandeKrollStopOpts = Readonly<{
        length?: number;
        multiplier?: number;
        smoothingLength?: number;
        offset?: number;
    }>;
    export type ChandeKrollStopResult = Readonly<{
        long: Series<number>;
        short: Series<number>;
    }>;
    export type WilliamsFractalOpts = Readonly<{
        length?: number;
        offset?: number;
    }>;
    export type WilliamsFractalResult = Readonly<{
        up: Series<number>;
        down: Series<number>;
    }>;
    export type ZigZagOpts = Readonly<{
        deviation?: number;
        depth?: number;
        offset?: number;
    }>;
    export type ZigZagResult = Readonly<{
        value: Series<number>;
        direction: Series<number>;
    }>;
    export type PivotsHighLowOpts = Readonly<{
        leftLength?: number;
        rightLength?: number;
        offset?: number;
    }>;
    export type PivotsHighLowResult = Readonly<{
        high: Series<number>;
        low: Series<number>;
    }>;
    export type PivotsStandardSystem = "classic" | "fibonacci" | "camarilla" | "woodie";
    export type PivotsStandardOpts = Readonly<{
        system?: PivotsStandardSystem;
        offset?: number;
    }>;
    export type PivotsStandardResult = Readonly<{
        pp: Series<number>;
        r1: Series<number>;
        s1: Series<number>;
        r2: Series<number>;
        s2: Series<number>;
        r3: Series<number>;
        s3: Series<number>;
    }>;
    export type VolatilityStopOpts = Readonly<{
        length?: number;
        multiplier?: number;
        offset?: number;
    }>;
    export type VolatilityStopResult = Readonly<{
        value: Series<number>;
        direction: Series<number>;
    }>;
    export type BbPercentBOpts = Readonly<{
        multiplier?: number;
        offset?: number;
        lineStyle?: PlotLineStyle;
    }>;
    export type BbwOpts = Readonly<{
        multiplier?: number;
        offset?: number;
        lineStyle?: PlotLineStyle;
    }>;
    export type DonchianOpts = Readonly<{
        offset?: number;
        outputs?: Readonly<
            Record<"upper" | "middle" | "lower", { lineStyle?: PlotLineStyle }>
        >;
    }>;
    export type DonchianResult = Readonly<{
        upper: Series<number>;
        middle: Series<number>;
        lower: Series<number>;
    }>;
    export type KeltnerOpts = Readonly<{
        length?: number;
        multiplier?: number;
        maType?: MaTypeNoVolume;
        offset?: number;
        outputs?: Readonly<
            Record<"upper" | "middle" | "lower", { lineStyle?: PlotLineStyle }>
        >;
    }>;
    export type KeltnerResult = Readonly<{
        upper: Series<number>;
        middle: Series<number>;
        lower: Series<number>;
    }>;
    export type EnvelopeOpts = Readonly<{
        length?: number;
        percent?: number;
        maType?: MaTypeNoVolume;
        offset?: number;
    }>;
    export type EnvelopeResult = Readonly<{
        upper: Series<number>;
        middle: Series<number>;
        lower: Series<number>;
    }>;
    export type ChopOpts = Readonly<{
        offset?: number;
        lineStyle?: PlotLineStyle;
    }>;
    export type HvOpts = Readonly<{
        annualisationFactor?: number;
        offset?: number;
        lineStyle?: PlotLineStyle;
    }>;
    export type RviOpts = Readonly<{
        offset?: number;
        lineStyle?: PlotLineStyle;
    }>;
    export type MassIndexOpts = Readonly<{
        emaLength?: number;
        sumLength?: number;
        offset?: number;
        lineStyle?: PlotLineStyle;
    }>;
    export type AroonResult = Readonly<{
        up: Series<number>;
        down: Series<number>;
    }>;
    export type BbResult = Readonly<{
        upper: Series<number>;
        middle: Series<number>;
        lower: Series<number>;
    }>;
    export type MacdResult = Readonly<{
        macd: Series<number>;
        signal: Series<number>;
        hist: Series<number>;
    }>;
    export type TaNamespace = {
        sma(source: Series<number>, length: number, opts?: SmaOpts): Series<number>;
        ema(source: Series<number>, length: number, opts?: EmaOpts): Series<number>;
        stdev(source: Series<number>, length: number, opts?: StdevOpts): Series<number>;
        bb(source: Series<number>, length: number, opts?: BbOpts): BbResult;
        rsi(source: Series<number>, length: number, opts?: RsiOpts): Series<number>;
        macd(source: Series<number>, opts?: MacdOpts): MacdResult;
        atr(length: number, opts?: AtrOpts): Series<number>;
        crossover(
            a: Series<number>,
            b: Series<number> | number,
            opts?: CrossoverOpts,
        ): Series<boolean>;
        crossunder(
            a: Series<number>,
            b: Series<number> | number,
            opts?: CrossunderOpts,
        ): Series<boolean>;
        nz(value: number, replacement?: number): number;
        highest(source: Series<number>, length: number, opts?: HighestOpts): Series<number>;
        lowest(source: Series<number>, length: number, opts?: LowestOpts): Series<number>;
        change(source: Series<number>, opts?: ChangeOpts): Series<number>;
        valuewhen(
            condition: Series<boolean>,
            source: Series<number>,
            occurrence?: number,
        ): Series<number>;
        barssince(condition: Series<boolean>): Series<number>;
        wma(source: Series<number>, length: number, opts?: WmaOpts): Series<number>;
        vwma(source: Series<number>, length: number, opts?: VwmaOpts): Series<number>;
        hma(source: Series<number>, length: number, opts?: HmaOpts): Series<number>;
        smma(source: Series<number>, length: number, opts?: SmmaOpts): Series<number>;
        dema(source: Series<number>, length: number, opts?: DemaOpts): Series<number>;
        tema(source: Series<number>, length: number, opts?: TemaOpts): Series<number>;
        kama(source: Series<number>, opts?: KamaOpts): Series<number>;
        alma(source: Series<number>, length: number, opts?: AlmaOpts): Series<number>;
        lsma(source: Series<number>, length: number, opts?: LsmaOpts): Series<number>;
        mcginley(source: Series<number>, length: number, opts?: McginleyOpts): Series<number>;
        maRibbon(source: Series<number>, opts?: MaRibbonOpts): MaRibbonResult;
        ao(opts?: AoOpts): Series<number>;
        cmo(source: Series<number>, length: number, opts?: CmoOpts): Series<number>;
        momentum(source: Series<number>, length: number, opts?: MomentumOpts): Series<number>;
        roc(source: Series<number>, length: number, opts?: RocOpts): Series<number>;
        cci(source: Series<number>, length: number, opts?: CciOpts): Series<number>;
        stoch(opts?: StochOpts): StochResult;
        williamsR(length: number, opts?: WilliamsROpts): Series<number>;
        aroon(length: number, opts?: AroonOpts): AroonResult;
        aroonOsc(length: number, opts?: AroonOscOpts): Series<number>;
        vol(opts?: VolOpts): Series<number>;
        vwap(opts?: VwapOpts): Series<number>;
        anchoredVwap(anchorTime: number, opts?: AnchoredVwapOpts): Series<number>;
        obv(opts?: ObvOpts): Series<number>;
        adl(opts?: AdlOpts): Series<number>;
        bop(opts?: BopOpts): Series<number>;
        cmf(length: number, opts?: CmfOpts): Series<number>;
        chaikinOsc(opts?: ChaikinOscOpts): Series<number>;
        mfi(length: number, opts?: MfiOpts): Series<number>;
        netVolume(opts?: NetVolumeOpts): Series<number>;
        pvo(opts?: PvoOpts): PvoResult;
        pvt(opts?: PvtOpts): Series<number>;
        eom(length: number, opts?: EomOpts): Series<number>;
        nvi(opts?: NviOpts): Series<number>;
        pvi(opts?: PviOpts): Series<number>;
        psar(opts?: PsarOpts): PsarResult;
        supertrend(opts?: SupertrendOpts): SupertrendResult;
        chandelier(opts?: ChandelierOpts): ChandelierResult;
        chandeKrollStop(opts?: ChandeKrollStopOpts): ChandeKrollStopResult;
        williamsFractal(opts?: WilliamsFractalOpts): WilliamsFractalResult;
        zigZag(opts?: ZigZagOpts): ZigZagResult;
        pivotsHighLow(opts?: PivotsHighLowOpts): PivotsHighLowResult;
        pivotsStandard(opts?: PivotsStandardOpts): PivotsStandardResult;
        volatilityStop(opts?: VolatilityStopOpts): VolatilityStopResult;
        bbPercentB(
            source: Series<number>,
            length: number,
            opts?: BbPercentBOpts,
        ): Series<number>;
        bbw(source: Series<number>, length: number, opts?: BbwOpts): Series<number>;
        donchian(length: number, opts?: DonchianOpts): DonchianResult;
        keltner(opts?: KeltnerOpts): KeltnerResult;
        envelope(source: Series<number>, opts?: EnvelopeOpts): EnvelopeResult;
        chop(length: number, opts?: ChopOpts): Series<number>;
        historicalVolatility(
            source: Series<number>,
            length: number,
            opts?: HvOpts,
        ): Series<number>;
        rvi(source: Series<number>, length: number, opts?: RviOpts): Series<number>;
        massIndex(opts?: MassIndexOpts): Series<number>;
        ppo(source: Series<number>, opts?: PpoOpts): PpoResult;
        dpo(source: Series<number>, length: number, opts?: DpoOpts): Series<number>;
        connorsRsi(source: Series<number>, opts?: ConnorsRsiOpts): Series<number>;
        kst(source: Series<number>, opts?: KstOpts): KstResult;
        fisher(length: number, opts?: FisherOpts): FisherResult;
        klinger(opts?: KlingerOpts): KlingerResult;
        rvgi(opts?: RvgiOpts): RvgiResult;
    };
    export const ta: TaNamespace;
    export type PlotKind = "line" | "step-line" | "horizontal-line";
    export type PlotOptsStyle =
        | { readonly kind: "line" }
        | { readonly kind: "step-line" }
        | { readonly kind: "histogram"; readonly baseline?: number }
        | {
              readonly kind: "marker";
              readonly shape: "circle" | "triangle-up" | "triangle-down" | "square" | "diamond";
              readonly size: number;
          };
    export type PlotOpts = Readonly<{
        color?: Color;
        title?: string;
        lineWidth?: number;
        lineStyle?: LineStyle;
        pane?: "overlay" | "new" | string;
        style?: PlotOptsStyle;
    }>;
    export type HLineOpts = Readonly<{
        color?: Color;
        title?: string;
        lineWidth?: number;
        lineStyle?: LineStyle;
    }>;
    export function plot(value: number | Series<number>, opts?: PlotOpts): void;
    export function hline(price: number, opts?: HLineOpts): void;
    export type JsonValue =
        | null
        | boolean
        | number
        | string
        | ReadonlyArray<JsonValue>
        | { readonly [k: string]: JsonValue };
    export type AlertOpts = Readonly<{
        severity?: AlertSeverity;
        meta?: Readonly<Record<string, JsonValue>>;
    }>;
    export function alert(message: string, opts?: AlertOpts): void;
    export type InputKind =
        | "int"
        | "float"
        | "bool"
        | "string"
        | "enum"
        | "color"
        | "source"
        | "time"
        | "price"
        | "symbol"
        | "interval"
        | "external-series";
    export type SourceField =
        | "open"
        | "high"
        | "low"
        | "close"
        | "hl2"
        | "hlc3"
        | "ohlc4"
        | "hlcc4";
    export type Schema<T> = Readonly<{ kind: "external-series-schema"; __brand?: T }>;
    type NumericInputOpts = Readonly<{ min?: number; max?: number; step?: number }>;
    type CommonInputDescriptor<K extends InputKind, T> = Readonly<{
        kind: K;
        defaultValue: T;
        title?: string;
    }>;
    export type IntDescriptor = CommonInputDescriptor<"int", number> & NumericInputOpts;
    export type FloatDescriptor = CommonInputDescriptor<"float", number> & NumericInputOpts;
    export type BoolDescriptor = CommonInputDescriptor<"bool", boolean>;
    export type StringDescriptor = CommonInputDescriptor<"string", string> & Readonly<{ multiline?: boolean }>;
    export type EnumDescriptor<T extends string> = CommonInputDescriptor<"enum", T> & Readonly<{ options: ReadonlyArray<T> }>;
    export type ColorDescriptor = CommonInputDescriptor<"color", Color>;
    export type SourceDescriptor = CommonInputDescriptor<"source", SourceField>;
    export type TimeDescriptor = CommonInputDescriptor<"time", number> & Readonly<{ pickFromChart?: boolean }>;
    export type PriceDescriptor = CommonInputDescriptor<"price", number>;
    export type SymbolDescriptor = CommonInputDescriptor<"symbol", string>;
    export type IntervalDescriptorInput = CommonInputDescriptor<"interval", string>;
    export type ExternalSeriesDescriptor<T> = Readonly<{
        kind: "external-series";
        name: string;
        schema: Schema<T>;
        title?: string;
    }>;
    export type InputDescriptor<T> =
        | IntDescriptor
        | FloatDescriptor
        | BoolDescriptor
        | StringDescriptor
        | EnumDescriptor<string>
        | ColorDescriptor
        | SourceDescriptor
        | TimeDescriptor
        | PriceDescriptor
        | SymbolDescriptor
        | IntervalDescriptorInput
        | ExternalSeriesDescriptor<T>;
    export const input: Readonly<{
        int(defaultValue: number, opts?: NumericInputOpts & Readonly<{ title?: string }>): IntDescriptor;
        float(defaultValue: number, opts?: NumericInputOpts & Readonly<{ title?: string }>): FloatDescriptor;
        bool(defaultValue: boolean, opts?: Readonly<{ title?: string }>): BoolDescriptor;
        string(defaultValue: string, opts?: Readonly<{ title?: string; multiline?: boolean }>): StringDescriptor;
        enum<T extends string>(
            defaultValue: T,
            options: ReadonlyArray<T>,
            opts?: Readonly<{ title?: string }>,
        ): EnumDescriptor<T>;
        color(defaultValue: Color, opts?: Readonly<{ title?: string }>): ColorDescriptor;
        source(defaultValue: SourceField, opts?: Readonly<{ title?: string }>): SourceDescriptor;
        time(defaultValue: Time, opts?: Readonly<{ title?: string; pickFromChart?: boolean }>): TimeDescriptor;
        price(defaultValue: Price, opts?: Readonly<{ title?: string }>): PriceDescriptor;
        symbol(defaultValue: string, opts?: Readonly<{ title?: string }>): SymbolDescriptor;
        interval(defaultValue: string, opts?: Readonly<{ title?: string }>): IntervalDescriptorInput;
        externalSeries<T>(args: Readonly<{ name: string; schema: Schema<T>; title?: string }>): ExternalSeriesDescriptor<T>;
    }>;
    export type InputSchema = Readonly<Record<string, InputDescriptor<unknown>>>;
    export type MutableSlot<T> = {
        value: T;
    };
    export type StateNamespace = Readonly<{
        float(init: number): MutableSlot<number>;
        int(init: number): MutableSlot<number>;
        bool(init: boolean): MutableSlot<boolean>;
        string(init: string): MutableSlot<string>;
        tick: Readonly<{
            float(init: number): MutableSlot<number>;
            int(init: number): MutableSlot<number>;
            bool(init: boolean): MutableSlot<boolean>;
            string(init: string): MutableSlot<string>;
        }>;
    }>;
    export const state: StateNamespace;
    export type BarStateView = {
        readonly isfirst: boolean;
        readonly islast: boolean;
        readonly isnew: boolean;
        readonly ishistory: boolean;
        readonly isrealtime: boolean;
        readonly isconfirmed: boolean;
    };
    export const barstate: BarStateView;
    export type SymbolType =
        | "equity"
        | "futures"
        | "forex"
        | "crypto"
        | "index"
        | "fund"
        | "bond"
        | "commodity"
        | "custom";
    export type SymInfoView = {
        readonly ticker: string;
        readonly type: SymbolType;
        readonly mintick: number;
        readonly currency: string;
        readonly basecurrency: string;
        readonly exchange: string;
        readonly timezone: string;
        readonly session: string;
        readonly meta: Readonly<Record<string, JsonValue>>;
    };
    export const syminfo: SymInfoView;
    export type TimeframeView = {
        readonly period: string;
        readonly isintraday: boolean;
        readonly isdaily: boolean;
        readonly isweekly: boolean;
        readonly ismonthly: boolean;
        readonly inSeconds: number;
    };
    export const timeframe: TimeframeView;
    export type RequestSecurityOpts = Readonly<{ interval: string }>;
    export type SecurityBar = Readonly<{
        readonly time: Series<Time>;
        readonly open: Series<Price>;
        readonly high: Series<Price>;
        readonly low: Series<Price>;
        readonly close: Series<Price>;
        readonly volume: Series<Volume>;
        readonly hl2: Series<Price>;
        readonly hlc3: Series<Price>;
        readonly ohlc4: Series<Price>;
        readonly hlcc4: Series<Price>;
        readonly symbol: Series<string>;
        readonly interval: Series<string>;
    }>;
    export type RequestNamespace = Readonly<{
        security(opts: RequestSecurityOpts): SecurityBar;
    }>;
    export const request: RequestNamespace;
    export type ScriptManifest = {
        readonly apiVersion: 1;
        readonly kind: "indicator" | "drawing" | "alert";
        readonly name: string;
        readonly inputs: InputSchema;
        readonly capabilities: ReadonlyArray<CapabilityId>;
        readonly requestedIntervals: ReadonlyArray<string>;
        readonly userPickableInterval: boolean;
        readonly seriesCapacities: Readonly<Record<string, number>>;
        readonly maxLookback: number;
        readonly maxDrawings?: DrawingCounts;
        readonly maxBarsBack?: number;
        readonly format?: ValueFormat;
        readonly precision?: number;
        readonly scale?: ScaleAxis;
        readonly shortName?: string;
        readonly requiresIntervals?: ReadonlyArray<string>;
    };
    export type Time = number;
    export type Price = number;
    export type WorldPoint = { readonly time: Time; readonly price: Price };
    export type LineDrawStyle = Readonly<{
        color?: Color;
        lineWidth?: number;
        lineStyle?: LineStyle;
        extendLeft?: boolean;
        extendRight?: boolean;
    }>;
    export type DrawingHandle = Readonly<{
        readonly id: string;
        update(patch: Readonly<Record<string, unknown>>): void;
        remove(): void;
    }>;
    // Phase-3 line-family draw surface (Task 5). Tasks 6-18 widen
    // DrawNamespace as their kinds ship. The compiler only needs
    // method signatures here to route call-site id injection.
    export type DrawNamespace = {
        line(a: WorldPoint, b: WorldPoint, opts?: LineDrawStyle): DrawingHandle;
        horizontalLine(price: Price, opts?: LineDrawStyle): DrawingHandle;
        horizontalRay(anchor: WorldPoint, opts?: LineDrawStyle): DrawingHandle;
        verticalLine(time: Time, opts?: LineDrawStyle): DrawingHandle;
        crossLine(anchor: WorldPoint, opts?: LineDrawStyle): DrawingHandle;
        trendAngle(a: WorldPoint, b: WorldPoint, opts?: LineDrawStyle): DrawingHandle;
    };
    export const draw: DrawNamespace;
    export type ComputeContext = {
        readonly bar: Bar;
        readonly inputs: Readonly<Record<string, unknown>>;
        readonly ta: TaNamespace;
        readonly plot: typeof plot;
        readonly hline: typeof hline;
        readonly alert: typeof alert;
        readonly draw: DrawNamespace;
        readonly state: StateNamespace;
        readonly barstate: BarStateView;
        readonly syminfo: SymInfoView;
        readonly timeframe: TimeframeView;
        readonly request: RequestNamespace;
    };
    export type ComputeFn = (ctx: ComputeContext) => void;
    export type CompiledScriptObject = {
        readonly manifest: ScriptManifest;
        readonly compute: ComputeFn;
    };
    export type DefineIndicatorOpts = Readonly<{
        name: string;
        apiVersion: 1;
        overlay?: boolean;
        inputs?: InputSchema;
        compute: ComputeFn;
        maxDrawings?: DrawingCounts;
    }> & ScriptOverrides;
    export type DefineAlertOpts = Readonly<{
        name: string;
        apiVersion: 1;
        inputs?: InputSchema;
        compute: ComputeFn;
    }> & Omit<ScriptOverrides, "scale" | "format" | "precision">;
    export type DefineDrawingOpts = Readonly<{
        name: string;
        apiVersion: 1;
        inputs?: InputSchema;
        compute: ComputeFn;
        maxDrawings?: DrawingCounts;
    }> & Omit<ScriptOverrides, "maxBarsBack" | "scale">;
    export function defineIndicator(opts: DefineIndicatorOpts): CompiledScriptObject;
    export function defineAlert(opts: DefineAlertOpts): CompiledScriptObject;
    export function defineDrawing(opts: DefineDrawingOpts): CompiledScriptObject;
    export type StatefulPrimitiveEntry = Readonly<{ name: string; slot: boolean }>;
    export const STATEFUL_PRIMITIVES: ReadonlySet<StatefulPrimitiveEntry>;
    export const STATEFUL_PRIMITIVES_BY_NAME: ReadonlyMap<string, StatefulPrimitiveEntry>;
}
`;

/**
 * The compiler options the compiler pins for every script. ES2022 target,
 * Bundler module resolution, strict mode, no DOM. Scripts that depend on
 * browser globals fail the `forbiddenConstructs` pass on the global access
 * itself; the `lib` setting keeps the typechecker from accepting them in the
 * first place.
 *
 * @since 0.1
 * @example
 *     import { COMPILER_OPTIONS } from "@invinite-org/chartlang-compiler/program";
 *     void COMPILER_OPTIONS;
 */
export const COMPILER_OPTIONS: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    noEmit: true,
    lib: ["lib.es2022.d.ts"],
    skipLibCheck: true,
    esModuleInterop: true,
    isolatedModules: true,
    verbatimModuleSyntax: false,
    allowJs: false,
};

/**
 * The return shape of `createProgramForSource`. Callers use `sourceFile` for
 * AST walks, `checker` for symbol resolution, and `program` as the root
 * handle when they need diagnostics from `tsc` itself (not used in Phase 1,
 * but kept on the type so Task 3 can plug in `program.getSemanticDiagnostics`
 * without an API change).
 *
 * @since 0.1
 * @example
 *     // const { sourceFile, checker } = createProgramForSource(src, opts);
 *     const shape: { sourceFile: unknown; checker: unknown; program: unknown } = {
 *         sourceFile: null,
 *         checker: null,
 *         program: null,
 *     };
 *     void shape;
 */
export type ProgramForSource = Readonly<{
    program: ts.Program;
    sourceFile: ts.SourceFile;
    checker: ts.TypeChecker;
}>;

/**
 * Build a single-file TypeScript program for an in-memory `.chart.ts`
 * source. The synthetic file lives at `sourcePath` (POSIX, as the user
 * would write it); imports of `@invinite-org/chartlang-core` resolve
 * against the in-memory ambient shim. Returns the source file and a
 * configured type checker — the caller never sees the underlying compiler
 * host plumbing.
 *
 * @since 0.1
 * @example
 *     // const { sourceFile, checker } = createProgramForSource(
 *     //     'export default defineIndicator({ name: "x", apiVersion: 1, compute: () => {} });',
 *     //     { sourcePath: "demo.chart.ts" },
 *     // );
 *     const fn: typeof createProgramForSource = createProgramForSource;
 *     void fn;
 */
export function createProgramForSource(
    source: string,
    opts: { readonly sourcePath: string },
): ProgramForSource {
    const sourcePath = normalisePath(opts.sourcePath);
    const VIRTUAL_FILE_SET: ReadonlySet<string> = new Set([sourcePath, CORE_MODULE_PATH]);
    const sourceFile = ts.createSourceFile(
        sourcePath,
        source,
        ts.ScriptTarget.ES2022,
        true,
        ts.ScriptKind.TS,
    );
    const shimFile = ts.createSourceFile(
        CORE_MODULE_PATH,
        CORE_AMBIENT_SHIM,
        ts.ScriptTarget.ES2022,
        true,
        ts.ScriptKind.TS,
    );

    const fallbackHost = ts.createCompilerHost(COMPILER_OPTIONS, true);

    const host: ts.CompilerHost = {
        ...fallbackHost,
        getSourceFile(
            fileName,
            languageVersionOrOptions,
            onError,
            shouldCreateNewSourceFile,
        ): ts.SourceFile | undefined {
            if (fileName === sourcePath) return sourceFile;
            if (fileName === CORE_MODULE_PATH) return shimFile;
            return fallbackHost.getSourceFile(
                fileName,
                languageVersionOrOptions,
                onError,
                shouldCreateNewSourceFile,
            );
        },
        fileExists(fileName) {
            return VIRTUAL_FILE_SET.has(fileName) || fallbackHost.fileExists(fileName);
        },
    };

    const program = ts.createProgram({
        rootNames: [sourcePath, CORE_MODULE_PATH],
        options: COMPILER_OPTIONS,
        host,
    });
    return Object.freeze({
        program,
        sourceFile,
        checker: program.getTypeChecker(),
    });
}

function normalisePath(p: string): string {
    return p.replace(/\\/g, "/").replace(/^\.\//, "");
}
