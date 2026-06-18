// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { PlotLineStyle, Series, Time } from "../types.js";

/**
 * Options bag for `ta.sma`. `offset` shifts the output forward by `n`
 * bars per the universal `opts.offset` convention:
 * positive `n` makes `series.current` return the value `n` bars ago,
 * negative `n` reads into the future (NaN at the head).
 *
 * @formula  N/A — placeholder
 * @since 0.1
 * @stable
 * @example
 *     const opts: SmaOpts = { offset: 0 };
 */
export type SmaOpts = Readonly<{ offset?: number }>;

/**
 * Options bag for `ta.ema`. `offset` matches {@link SmaOpts}.
 *
 * @formula  N/A — placeholder
 * @since 0.1
 * @stable
 * @example
 *     const opts: EmaOpts = { offset: 0 };
 */
export type EmaOpts = Readonly<{ offset?: number }>;

/**
 * Options bag for `ta.stdev`. `biased` toggles between population (default)
 * and sample standard deviation. `offset` matches {@link SmaOpts}.
 *
 * @formula  σ_biased = sqrt(Σ(x_i − μ)² / N); σ_sample = sqrt(Σ / (N − 1))
 * @since 0.1
 * @stable
 * @example
 *     const opts: StdevOpts = { biased: false, offset: 0 };
 */
export type StdevOpts = Readonly<{ biased?: boolean; offset?: number }>;

/**
 * Options bag for `ta.bb`. `multiplier` defaults to `2` and scales the upper /
 * lower bands away from the middle. `offset` matches {@link SmaOpts} and
 * shifts all three bands (upper / middle / lower) in lockstep.
 *
 * @formula  upper = sma + multiplier * stdev, lower = sma − multiplier * stdev
 * @since 0.1
 * @stable
 * @example
 *     const opts: BbOpts = { multiplier: 2, offset: 0 };
 */
export type BbOpts = Readonly<{ multiplier?: number; offset?: number }>;

/**
 * Options bag for `ta.rsi`. `offset` matches {@link SmaOpts}.
 *
 * @formula  N/A — placeholder
 * @since 0.1
 * @stable
 * @example
 *     const opts: RsiOpts = { offset: 0 };
 */
export type RsiOpts = Readonly<{ offset?: number }>;

/**
 * Options bag for `ta.macd`. Fast / slow / signal lengths default to the
 * Appel-era 12 / 26 / 9 when omitted. `offset` matches {@link SmaOpts}
 * and shifts all three outputs (macd / signal / hist) in lockstep.
 *
 * @formula  N/A — see `ta.macd` JSDoc
 * @since 0.1
 * @stable
 * @example
 *     const opts: MacdOpts = { fastLength: 12, slowLength: 26, signalLength: 9 };
 */
export type MacdOpts = Readonly<{
    fastLength?: number;
    slowLength?: number;
    signalLength?: number;
    offset?: number;
}>;

/**
 * Options bag for `ta.atr`. `offset` matches {@link SmaOpts}.
 *
 * @formula  N/A — placeholder
 * @since 0.1
 * @stable
 * @example
 *     const opts: AtrOpts = { offset: 0 };
 */
export type AtrOpts = Readonly<{ offset?: number }>;

/**
 * Options bag for `ta.crossover`. `offset` matches {@link SmaOpts}
 * (shifts the boolean output so `series.current` returns the crossover
 * detection `offset` bars ago).
 *
 * @formula  N/A — see `ta.crossover` JSDoc
 * @since 0.1
 * @stable
 * @example
 *     const opts: CrossoverOpts = { offset: 0 };
 */
export type CrossoverOpts = Readonly<{ offset?: number }>;

/**
 * Options bag for `ta.crossunder`. Mirrors {@link CrossoverOpts}.
 *
 * @formula  N/A — see `ta.crossunder` JSDoc
 * @since 0.1
 * @stable
 * @example
 *     const opts: CrossunderOpts = { offset: 0 };
 */
export type CrossunderOpts = Readonly<{ offset?: number }>;

/**
 * Options bag for `ta.highest`. `offset` shifts the read window backwards
 * by `n` bars (Phase-2 backfill).
 *
 * @formula  N/A — see `ta.highest` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const opts: HighestOpts = { offset: 0 };
 */
export type HighestOpts = Readonly<{ offset?: number }>;

/**
 * Options bag for `ta.lowest`. Mirrors {@link HighestOpts}.
 *
 * @formula  N/A — see `ta.lowest` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const opts: LowestOpts = { offset: 0 };
 */
export type LowestOpts = Readonly<{ offset?: number }>;

/**
 * Options bag for `ta.highestbars`. `offset` shifts the read window
 * backwards by `n` bars per the universal `opts.offset` convention.
 *
 * @formula  N/A — see `ta.highestbars` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const opts: HighestbarsOpts = { offset: 0 };
 */
export type HighestbarsOpts = Readonly<{ offset?: number }>;

/**
 * Options bag for `ta.lowestbars`. Mirrors {@link HighestbarsOpts}.
 *
 * @formula  N/A — see `ta.lowestbars` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const opts: LowestbarsOpts = { offset: 0 };
 */
export type LowestbarsOpts = Readonly<{ offset?: number }>;

/**
 * Options bag for `ta.change`. `length` is the lookback distance (default
 * `1` — first-difference); `offset` shifts the read window backwards.
 *
 * @formula  out = source[0] − source[length]
 * @since 0.2
 * @stable
 * @example
 *     const opts: ChangeOpts = { length: 1 };
 */
export type ChangeOpts = Readonly<{ length?: number; offset?: number }>;

/**
 * Options bag for `ta.valuewhen`. `offset` shifts the emitted series after the
 * occurrence lookup has been evaluated.
 *
 * @formula  N/A — see `ta.valuewhen` JSDoc
 * @since 0.4
 * @stable
 * @example
 *     const opts: ValuewhenOpts = { offset: 0 };
 */
export type ValuewhenOpts = Readonly<{ offset?: number }>;

/**
 * Options bag for `ta.barssince`. `offset` shifts the elapsed-bars output.
 *
 * @formula  N/A — see `ta.barssince` JSDoc
 * @since 0.4
 * @stable
 * @example
 *     const opts: BarssinceOpts = { offset: 0 };
 */
export type BarssinceOpts = Readonly<{ offset?: number }>;

/**
 * Options bag for `ta.wma`. `offset` shifts the output forward by `n`
 * bars (Task-29 universal-offset backfill). `lineStyle` is a
 * pass-through for the script-author's downstream `plot(wma, { lineStyle })`
 * call — not consumed by the primitive itself.
 *
 * @formula  N/A — see `ta.wma` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const opts: WmaOpts = { offset: 0 };
 */
export type WmaOpts = Readonly<{ offset?: number; lineStyle?: PlotLineStyle }>;

/**
 * Options bag for `ta.vwma`. Mirrors {@link WmaOpts}.
 *
 * @formula  N/A — see `ta.vwma` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const opts: VwmaOpts = { offset: 0 };
 */
export type VwmaOpts = Readonly<{ offset?: number; lineStyle?: PlotLineStyle }>;

/**
 * Options bag for `ta.hma`. Mirrors {@link WmaOpts}.
 *
 * @formula  N/A — see `ta.hma` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const opts: HmaOpts = { offset: 0 };
 */
export type HmaOpts = Readonly<{ offset?: number; lineStyle?: PlotLineStyle }>;

/**
 * Options bag for `ta.smma` (smoothed moving average, Wilder's RMA).
 * Mirrors {@link WmaOpts}.
 *
 * @formula  N/A — see `ta.smma` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const opts: SmmaOpts = { offset: 0 };
 */
export type SmmaOpts = Readonly<{ offset?: number; lineStyle?: PlotLineStyle }>;

/**
 * Options bag for `ta.dema` (double EMA). Mirrors {@link WmaOpts}.
 *
 * @formula  N/A — see `ta.dema` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const opts: DemaOpts = { offset: 0 };
 */
export type DemaOpts = Readonly<{ offset?: number; lineStyle?: PlotLineStyle }>;

/**
 * Options bag for `ta.tema` (triple EMA). Mirrors {@link WmaOpts}.
 *
 * @formula  N/A — see `ta.tema` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const opts: TemaOpts = { offset: 0 };
 */
export type TemaOpts = Readonly<{ offset?: number; lineStyle?: PlotLineStyle }>;

/**
 * Options bag for `ta.kama` (Kaufman Adaptive MA). `length` (default
 * `10`) is the efficiency-ratio window; `fastLength` / `slowLength`
 * (defaults `2` / `30`) define the bounding alphas the smoothing
 * constant interpolates between. `offset` matches {@link WmaOpts};
 * `lineStyle` is a forward-compat plot-styling hint.
 *
 * @formula  N/A — see `ta.kama` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const opts: KamaOpts = { length: 10, fastLength: 2, slowLength: 30 };
 */
export type KamaOpts = Readonly<{
    length?: number;
    fastLength?: number;
    slowLength?: number;
    offset?: number;
    lineStyle?: PlotLineStyle;
}>;

/**
 * Options bag for `ta.alma` (Arnaud Legoux MA). `offset` is the
 * Gaussian-centre position in `[0, 1]` (default `0.85`) — NOT the
 * universal bar-shift; the universal shift on ALMA uses the distinct
 * `barShift` field. `sigma` (default `6`) sets the Gaussian spread
 * (spread = `length / sigma`). `lineStyle` is a forward-compat
 * plot-styling hint.
 *
 * @formula  N/A — see `ta.alma` JSDoc
 * @anchors  offset, sigma
 * @since 0.2
 * @stable
 * @example
 *     const opts: AlmaOpts = { offset: 0.85, sigma: 6 };
 */
export type AlmaOpts = Readonly<{
    offset?: number;
    sigma?: number;
    barShift?: number;
    lineStyle?: PlotLineStyle;
}>;

/**
 * Options bag for `ta.lsma` (least-squares regression value at the
 * trailing window's last bar). Mirrors {@link WmaOpts}.
 *
 * @formula  N/A — see `ta.lsma` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const opts: LsmaOpts = { offset: 0 };
 */
export type LsmaOpts = Readonly<{ offset?: number; lineStyle?: PlotLineStyle }>;

/**
 * Options bag for `ta.mcginley` (McGinley Dynamic). Mirrors
 * {@link WmaOpts}.
 *
 * @formula  N/A — see `ta.mcginley` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const opts: McginleyOpts = { offset: 0 };
 */
export type McginleyOpts = Readonly<{ offset?: number; lineStyle?: PlotLineStyle }>;

/**
 * Canonical moving-average kind union, excluding `"vwma"`. Shared with
 * the runtime's `lib/maTypes.ts` (byte-equal string-literal union) and
 * referenced by the surface types that accept an `maType` opt
 * (`ta.maRibbon` today; more once Phase-2 ports land). VWMA is
 * excluded because it requires a parallel volume array — derived
 * Float64 inputs (the chained-MA dispatch path) carry no matching
 * volume stream.
 *
 * @formula  N/A — string-literal union type
 * @since 0.2
 * @stable
 * @example
 *     const k: MaTypeNoVolume = "ema";
 */
export type MaTypeNoVolume = "sma" | "ema" | "wma" | "smma";

/**
 * Options bag for `ta.maRibbon` (a fan of K MAs at different lengths).
 * Defaults: `lengths = [10, 20, 30, 40, 50]`, `maType = "sma"`.
 * `offset` is the universal bar-shift applied to
 * every output series. `outputs` is forward-compat per-key plot styling
 * (typed but not consumed by the runtime impl).
 *
 * @formula  N/A — see `ta.maRibbon` JSDoc
 * @anchors  lengths, maType
 * @since 0.2
 * @stable
 * @example
 *     const opts: MaRibbonOpts = { lengths: [10, 20, 30], maType: "ema" };
 */
export type MaRibbonOpts = Readonly<{
    lengths?: ReadonlyArray<number>;
    maType?: MaTypeNoVolume;
    offset?: number;
    outputs?: Readonly<Record<string, { lineStyle?: PlotLineStyle }>>;
}>;

/**
 * Result of `ta.maRibbon` — a dynamic-key record keyed by
 * `ma_<length>` (one entry per resolved `lengths` value). Iteration
 * order matches the resolved `lengths` array; use the sibling
 * `maRibbonOutputKeys` helper (exported from
 * `@invinite-org/chartlang-runtime`) for stable iteration over an
 * `opts` value.
 *
 * @formula  N/A — dynamic-key record type, see `ta.maRibbon` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     declare const r: MaRibbonResult;
 *     void r.ma_10?.current;
 */
export type MaRibbonResult = Readonly<Record<string, Series<number>>>;

/**
 * Options bag for `ta.ao` (Awesome Oscillator). Fast / slow lengths
 * default to the Pine-canonical `5` / `34` over the `hl2` midpoint.
 * `lineStyle` is a forward-compat plot-styling hint surfaced for
 * §9.1 ergonomics.
 *
 * @formula  out = SMA(hl2, fastLength) − SMA(hl2, slowLength)
 * @since 0.2
 * @stable
 * @example
 *     const opts: AoOpts = { fastLength: 5, slowLength: 34 };
 */
export type AoOpts = Readonly<{
    fastLength?: number;
    slowLength?: number;
    offset?: number;
    lineStyle?: PlotLineStyle;
}>;

/**
 * Options bag for `ta.cmo` (Chande Momentum Oscillator). `offset` shifts
 * the read window; `lineStyle` is a forward-compat plot-styling hint.
 *
 * @formula  CMO = 100 · (Σ gain − Σ loss) / (Σ gain + Σ loss)
 * @since 0.2
 * @stable
 * @example
 *     const opts: CmoOpts = { offset: 0 };
 */
export type CmoOpts = Readonly<{ offset?: number; lineStyle?: PlotLineStyle }>;

/**
 * Options bag for `ta.momentum` (Pine `mom`).
 *
 * @formula  out = source[0] − source[length]
 * @since 0.2
 * @stable
 * @example
 *     const opts: MomentumOpts = { offset: 0 };
 */
export type MomentumOpts = Readonly<{ offset?: number; lineStyle?: PlotLineStyle }>;

/**
 * Options bag for `ta.roc` (Rate of Change).
 *
 * @formula  ROC = 100 · (source[0] − source[length]) / source[length]
 * @since 0.2
 * @stable
 * @example
 *     const opts: RocOpts = { offset: 0 };
 */
export type RocOpts = Readonly<{ offset?: number; lineStyle?: PlotLineStyle }>;

/**
 * Options bag for `ta.pmo` (Carl Swenlin's Price Momentum Oscillator).
 * `firstSmoothing` / `secondSmoothing` / `signalLength` default to the
 * TradingView-canonical `35` / `20` / `10`. The inner two stages use a
 * non-canonical EMA factor (`α = 2 / length`); the signal line uses
 * the standard EMA (`α = 2 / (length + 1)`).
 *
 * @formula  N/A — see `ta.pmo` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const opts: PmoOpts = { firstSmoothing: 35, secondSmoothing: 20, signalLength: 10 };
 */
export type PmoOpts = Readonly<{
    firstSmoothing?: number;
    secondSmoothing?: number;
    signalLength?: number;
    offset?: number;
    lineStyle?: PlotLineStyle;
}>;

/**
 * The two-series result of `ta.pmo` — the `pmo` line plus its `signal`
 * line (standard EMA over the pmo output, `signalLength` window).
 * `primarySeriesKey: "pmo"` is recorded on `TA_REGISTRY_METADATA`.
 *
 * @formula  see `ta.pmo` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const p = ta.pmo(bar.close);
 *     plot(p.pmo);
 *     plot(p.signal);
 */
export type PmoResult = Readonly<{
    pmo: Series<number>;
    signal: Series<number>;
}>;

/**
 * Options bag for `ta.smi` (William Blau's Stochastic Momentum Index).
 * `kLength` is the rolling high/low window (default `10`);
 * `firstSmoothing` / `secondSmoothing` are the double-EMA smoothing
 * lengths for both numerator and denominator (defaults `3` / `5`);
 * `dLength` is the signal-line EMA length (default `3`).
 *
 * @formula  N/A — see `ta.smi` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const opts: SmiOpts = { kLength: 10, firstSmoothing: 3, secondSmoothing: 5, dLength: 3 };
 */
export type SmiOpts = Readonly<{
    kLength?: number;
    firstSmoothing?: number;
    secondSmoothing?: number;
    dLength?: number;
    offset?: number;
    lineStyle?: PlotLineStyle;
}>;

/**
 * The two-series result of `ta.smi` — the `smi` line bounded
 * `[-100, 100]` plus its `signal` line (EMA(`dLength`) of `smi`).
 * `primarySeriesKey: "smi"` is recorded on `TA_REGISTRY_METADATA`
 * with `yDomain: { kind: "fixed", min: -100, max: 100 }`.
 *
 * @formula  see `ta.smi` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const s = ta.smi();
 *     plot(s.smi);
 *     plot(s.signal);
 */
export type SmiResult = Readonly<{
    smi: Series<number>;
    signal: Series<number>;
}>;

/**
 * Options bag for `ta.tsi` (William Blau's True Strength Index — the
 * momentum-class oscillator). `firstSmoothing` is the outer (longer)
 * EMA length (default `25`); `secondSmoothing` is the inner (shorter)
 * EMA length (default `13`); `signalLength` is the signal-line EMA
 * length (default `13`).
 *
 * @formula  N/A — see `ta.tsi` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const opts: TsiOpts = { firstSmoothing: 25, secondSmoothing: 13, signalLength: 13 };
 */
export type TsiOpts = Readonly<{
    firstSmoothing?: number;
    secondSmoothing?: number;
    signalLength?: number;
    offset?: number;
    lineStyle?: PlotLineStyle;
}>;

/**
 * The two-series result of `ta.tsi` — the `tsi` line bounded
 * `[-100, 100]` by construction plus its `signal` line
 * (EMA(`signalLength`) of `tsi`). `primarySeriesKey: "tsi"` is
 * recorded on `TA_REGISTRY_METADATA` with `yDomain: { kind: "auto" }`
 * (TSI rarely approaches ±100 — we follow invinite's plugin choice
 * and let the renderer fit the visible range).
 *
 * @formula  see `ta.tsi` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const t = ta.tsi(bar.close);
 *     plot(t.tsi);
 *     plot(t.signal);
 */
export type TsiResult = Readonly<{
    tsi: Series<number>;
    signal: Series<number>;
}>;

/**
 * Options bag for `ta.cci`. `offset` shifts the read window backwards
 * (Phase-2 backfill). `lineStyle` is a pass-through
 * for the script-author's downstream `plot(cci, { lineStyle })` call
 * and is not consumed by the primitive itself.
 *
 * @formula  N/A — see `ta.cci` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const opts: CciOpts = { offset: 0 };
 */
export type CciOpts = Readonly<{ offset?: number; lineStyle?: PlotLineStyle }>;

/**
 * Options bag for `ta.stoch`. `kLength` / `kSmoothing` / `dLength`
 * default to `14` / `3` / `3` — Pine's canonical Stochastic Oscillator
 * defaults.
 *
 * @formula  N/A — see `ta.stoch` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const opts: StochOpts = { kLength: 14, kSmoothing: 3, dLength: 3 };
 */
export type StochOpts = Readonly<{
    kLength?: number;
    kSmoothing?: number;
    dLength?: number;
    offset?: number;
}>;

/**
 * Options bag for `ta.williamsR`. Mirrors {@link CciOpts}.
 *
 * @formula  N/A — see `ta.williamsR` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const opts: WilliamsROpts = { offset: 0 };
 */
export type WilliamsROpts = Readonly<{ offset?: number; lineStyle?: PlotLineStyle }>;

/**
 * The two-series result of `ta.stoch` — the `%K` line and the `%D`
 * signal line. Both Series are updated in lock-step with the source.
 * `primarySeriesKey: "k"` (the registry metadata records this).
 *
 * @formula  k = sma(kRaw, kSmoothing); d = sma(k, dLength)
 * @since 0.2
 * @stable
 * @example
 *     const s = ta.stoch({ kLength: 14, kSmoothing: 3, dLength: 3 });
 *     plot(s.k);
 *     plot(s.d);
 */
export type StochResult = Readonly<{
    k: Series<number>;
    d: Series<number>;
}>;

/**
 * Options bag for `ta.stochRsi`. `rsiLength` / `stochLength` /
 * `kSmoothing` / `dSmoothing` default to the Pine-canonical
 * `14` / `14` / `3` / `3` Stochastic-RSI settings. `offset`
 * shifts the read window backwards.
 *
 * @formula  N/A — see `ta.stochRsi` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const opts: StochRsiOpts = { rsiLength: 14, stochLength: 14, kSmoothing: 3, dSmoothing: 3 };
 */
export type StochRsiOpts = Readonly<{
    rsiLength?: number;
    stochLength?: number;
    kSmoothing?: number;
    dSmoothing?: number;
    offset?: number;
}>;

/**
 * Options bag for `ta.ultimateOsc`. `shortLength` / `mediumLength` /
 * `longLength` default to Larry Williams' canonical `7` / `14` / `28`.
 * `offset` shifts the read window backwards; `lineStyle` is a
 * forward-compat plot-styling hint.
 *
 * @formula  N/A — see `ta.ultimateOsc` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const opts: UltimateOscOpts = { shortLength: 7, mediumLength: 14, longLength: 28 };
 */
export type UltimateOscOpts = Readonly<{
    shortLength?: number;
    mediumLength?: number;
    longLength?: number;
    offset?: number;
    lineStyle?: PlotLineStyle;
}>;

/**
 * Options bag for `ta.coppock`. `roc1Length` / `roc2Length` /
 * `wmaLength` default to the Edwin Coppock canonical `11` / `14` /
 * `10`. `offset` shifts the read window backwards; `lineStyle` is a
 * forward-compat plot-styling hint.
 *
 * @formula  N/A — see `ta.coppock` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const opts: CoppockOpts = { roc1Length: 11, roc2Length: 14, wmaLength: 10 };
 */
export type CoppockOpts = Readonly<{
    roc1Length?: number;
    roc2Length?: number;
    wmaLength?: number;
    offset?: number;
    lineStyle?: PlotLineStyle;
}>;

/**
 * Options bag for `ta.ppo`. `fastLength` / `slowLength` / `signalLength`
 * default to the Appel-era `12` / `26` / `9` (mirrors `ta.macd`).
 * `offset` shifts all three outputs (`ppo`, `signal`, `hist`) in
 * lockstep per the universal `opts.offset` convention.
 *
 * @formula  N/A — see `ta.ppo` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const opts: PpoOpts = { fastLength: 12, slowLength: 26, signalLength: 9 };
 */
export type PpoOpts = Readonly<{
    fastLength?: number;
    slowLength?: number;
    signalLength?: number;
    offset?: number;
}>;

/**
 * Options bag for `ta.dpo`. `offset` shifts the read window backwards
 *. `lineStyle` is a forward-compat plot-styling hint
 * surfaced for §9.1 ergonomics — not consumed by the primitive
 * itself.
 *
 * @formula  N/A — see `ta.dpo` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const opts: DpoOpts = { offset: 0 };
 */
export type DpoOpts = Readonly<{ offset?: number; lineStyle?: PlotLineStyle }>;

/**
 * Options bag for `ta.connorsRsi`. `rsiLength` / `streakLength` /
 * `rocLength` default to Larry Connors' canonical `3` / `2` / `100`.
 * `offset` shifts the read window backwards.
 *
 * @formula  N/A — see `ta.connorsRsi` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const opts: ConnorsRsiOpts = { rsiLength: 3, streakLength: 2, rocLength: 100 };
 */
export type ConnorsRsiOpts = Readonly<{
    rsiLength?: number;
    streakLength?: number;
    rocLength?: number;
    offset?: number;
}>;

/**
 * The three-series result of `ta.ppo` — the PPO line, its signal
 * line, and the histogram of their difference. All three Series are
 * updated in lock-step with the source. `primarySeriesKey: "ppo"` is
 * recorded in `TA_REGISTRY_METADATA`.
 *
 * @formula  ppo    = 100 · (ema(src, fast) − ema(src, slow)) / ema(src, slow) ;
 *           signal = ema(ppo, signalLength) ;
 *           hist   = ppo − signal
 * @since 0.2
 * @stable
 * @example
 *     const p = ta.ppo(bar.close);
 *     plot(p.ppo); plot(p.signal); plot(p.hist);
 */
export type PpoResult = Readonly<{
    ppo: Series<number>;
    signal: Series<number>;
    hist: Series<number>;
}>;

/**
 * The two-series result of `ta.stochRsi` — the `%K` line (stochastic
 * applied to the RSI series, smoothed by `kSmoothing`) and the `%D`
 * signal (SMA of `%K` over `dSmoothing`). Both Series ∈ [0, 100]
 * when defined; the runtime emits NaN through the warmup window or
 * when the rolling RSI range is flat (zero denominator).
 *
 * `primarySeriesKey: "k"` (recorded in `TA_REGISTRY_METADATA`).
 *
 * @formula  rsi  = rsi(source, rsiLength) ;
 *           kRaw = 100 · (rsi − lowest(rsi, stochLength))
 *                       / (highest(rsi, stochLength) − lowest(rsi, stochLength)) ;
 *           k    = sma(kRaw, kSmoothing) ;
 *           d    = sma(k, dSmoothing)
 * @since 0.2
 * @stable
 * @example
 *     const s = ta.stochRsi(bar.close);
 *     plot(s.k);
 *     plot(s.d);
 */
export type StochRsiResult = Readonly<{
    k: Series<number>;
    d: Series<number>;
}>;

/**
 * Options bag for `ta.kst` (Know Sure Thing). Defaults match Pring's
 * canonical settings `(10, 15, 20, 30, 10, 10, 10, 15, 9)`. Source is
 * positional (`ta.kst(source, opts?)`). `offset` shifts the read window
 * backwards (accepted on the surface).
 *
 * @formula  N/A — see `ta.kst` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const opts: KstOpts = { roc1Length: 10, roc2Length: 15, roc3Length: 20, roc4Length: 30 };
 */
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

/**
 * The two-series result of `ta.kst` — the KST line (weighted sum of
 * four smoothed percentage ROCs) and its SMA signal line.
 * `primarySeriesKey: "kst"` (recorded in `TA_REGISTRY_METADATA`).
 *
 * @formula  rN  = sma(rocN(source, rocNLength), rocNSmooth) for N in 1..4 ;
 *           kst = r1 + 2·r2 + 3·r3 + 4·r4 ; NaN if any rN NaN ;
 *           signal = sma(kst, signalLength)
 * @since 0.2
 * @stable
 * @example
 *     const k = ta.kst(bar.close);
 *     plot(k.kst);
 *     plot(k.signal);
 */
export type KstResult = Readonly<{
    kst: Series<number>;
    signal: Series<number>;
}>;

/**
 * Options bag for `ta.fisher`. `length` is positional on the call
 * (`ta.fisher(length, opts?)`); the bag carries only the universal
 * `offset` (accepted on the surface).
 *
 * @formula  N/A — see `ta.fisher` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const opts: FisherOpts = { offset: 0 };
 */
export type FisherOpts = Readonly<{ offset?: number }>;

/**
 * The two-series result of `ta.fisher` — the Fisher Transform line and
 * its 1-bar-lagged `trigger` (the prior bar's Fisher value). Both are
 * unbounded; `yDomain: { kind: "auto" }`. The first bar's `trigger` is
 * NaN (no prior Fisher).
 *
 * `primarySeriesKey: "fisher"` (recorded in `TA_REGISTRY_METADATA`).
 *
 * @formula  mid = (high + low) / 2 ;
 *           normalised = flatRange ? 0 : (mid − lowest(mid, length)) / (highest − lowest) − 0.5 ;
 *           x = 0.66 · normalised + 0.67 · prevX ; NaN at fisher if |x| ≥ 1 ;
 *           fisher = 0.5 · ln((1 + x) / (1 − x)) + 0.5 · prevFisher ;
 *           trigger[t] = prevFisher (the value of fisher before this close)
 * @since 0.2
 * @stable
 * @example
 *     const f = ta.fisher(9);
 *     plot(f.fisher);
 *     plot(f.trigger);
 */
export type FisherResult = Readonly<{
    fisher: Series<number>;
    trigger: Series<number>;
}>;

/**
 * Options bag for `ta.klinger` (Klinger Volume Oscillator). Defaults
 * `(fastLength=34, slowLength=55, signalLength=13)` match invinite.
 * `offset` shifts the read window backwards (accepted
 * on the surface).
 *
 * @formula  N/A — see `ta.klinger` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const opts: KlingerOpts = { fastLength: 34, slowLength: 55, signalLength: 13 };
 */
export type KlingerOpts = Readonly<{
    fastLength?: number;
    slowLength?: number;
    signalLength?: number;
    offset?: number;
}>;

/**
 * The two-series result of `ta.klinger` — the Klinger Oscillator line
 * (`EMA(fast)(vf) − EMA(slow)(vf)` over the Volume Force accumulator)
 * and its `EMA(signalLength)(klinger)` signal. `primarySeriesKey:
 * "klinger"` (recorded in `TA_REGISTRY_METADATA`).
 *
 * @formula  trend = sign(hlc − prevHlc) carried forward on equality ;
 *           cm    = trend === prevTrend ? prevCm + dm : prevDm + dm ;
 *           vf    = volume · |2·(dm/cm − 1)| · trend · 100 ; 0 on cm = 0 ;
 *           klinger = ema(vf, fastLength) − ema(vf, slowLength) ;
 *           signal  = ema(klinger, signalLength)
 * @since 0.2
 * @stable
 * @example
 *     const k = ta.klinger();
 *     plot(k.klinger);
 *     plot(k.signal);
 */
export type KlingerResult = Readonly<{
    klinger: Series<number>;
    signal: Series<number>;
}>;

/**
 * Options bag for `ta.rvgi` (Relative Vigor Index). `length` is the SMA
 * smoothing of the 4-bar weighted numerator / denominator (default
 * `10`). `offset` shifts the read window backwards (—
 * accepted on the surface).
 *
 * @formula  N/A — see `ta.rvgi` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const opts: RvgiOpts = { length: 10 };
 */
export type RvgiOpts = Readonly<{
    length?: number;
    offset?: number;
}>;

/**
 * The two-series result of `ta.rvgi` — the Relative Vigor Index line
 * (`SMA(numerator, length) / SMA(denominator, length)`) and its 4-bar
 * weighted signal. `primarySeriesKey: "rvgi"` (recorded in
 * `TA_REGISTRY_METADATA`).
 *
 * @formula  num = (co0 + 2·co1 + 2·co2 + co3) / 6 where coN = close − open ;
 *           den = (hl0 + 2·hl1 + 2·hl2 + hl3) / 6 where hlN = high − low ;
 *           rvgi   = sma(num, length) / sma(den, length) ; NaN on flat den ;
 *           signal = (rvgi[0] + 2·rvgi[1] + 2·rvgi[2] + rvgi[3]) / 6
 * @since 0.2
 * @stable
 * @example
 *     const r = ta.rvgi();
 *     plot(r.rvgi);
 *     plot(r.signal);
 */
export type RvgiResult = Readonly<{
    rvgi: Series<number>;
    signal: Series<number>;
}>;

/**
 * Options bag for `ta.aroon`. `offset` shifts the read window backwards
 *. `outputs` carries per-output styling hints that
 * downstream `plot()` callsites can lift defaults from; the runtime
 * itself ignores it in Phase 2 — script-author `plot(a.up,
 * { lineStyle })` is the styling seam.
 *
 * @formula  N/A — see `ta.aroon` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const opts: AroonOpts = { offset: 0 };
 */
export type AroonOpts = Readonly<{
    offset?: number;
    outputs?: Readonly<Record<"up" | "down", { lineStyle?: PlotLineStyle }>>;
}>;

/**
 * Options bag for `ta.aroonOsc`. `lineStyle` is a forward-compat
 * plot-styling hint; the runtime itself reads `offset` only.
 *
 * @formula  N/A — see `ta.aroonOsc` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const opts: AroonOscOpts = { offset: 0 };
 */
export type AroonOscOpts = Readonly<{ offset?: number; lineStyle?: PlotLineStyle }>;

/**
 * Options bag for `ta.median` (rolling median). Mirrors {@link WmaOpts}.
 *
 * @formula  N/A — see `ta.median` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const opts: MedianOpts = { offset: 0 };
 */
export type MedianOpts = Readonly<{ offset?: number; lineStyle?: PlotLineStyle }>;

/**
 * Options bag for `ta.adr` (Average Daily Range). `length` defaults to
 * `14` — Pine / TradingView canonical. `offset` shifts the read window
 * backwards; `lineStyle` is a forward-compat plot-styling hint.
 *
 * @formula  N/A — see `ta.adr` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const opts: AdrOpts = { length: 14 };
 */
export type AdrOpts = Readonly<{
    length?: number;
    offset?: number;
    lineStyle?: PlotLineStyle;
}>;

/**
 * Options bag for `ta.ulcerIndex`. Mirrors {@link WmaOpts}.
 *
 * @formula  N/A — see `ta.ulcerIndex` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const opts: UlcerIndexOpts = { offset: 0 };
 */
export type UlcerIndexOpts = Readonly<{ offset?: number; lineStyle?: PlotLineStyle }>;

/**
 * Options bag for `ta.vol`. `offset` shifts the read window backwards
 * (universal offset). `ta.vol` is a pass-through of
 * `bar.volume`; the opts bag exists so authors can attach the
 * universal `offset` without an extra wrapper.
 *
 * @formula  N/A — see `ta.vol` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const opts: VolOpts = { offset: 0 };
 */
export type VolOpts = Readonly<{ offset?: number }>;

/**
 * Options bag for `ta.vwap`. `source` selects the per-bar price
 * (default `"hlc3"` per Pine). `offset` shifts the read window
 * backwards.
 *
 * @formula  vwap = Σ(source · volume) / Σ(volume) per session window
 * @since 0.2
 * @stable
 * @example
 *     const opts: VwapOpts = { source: "hlc3" };
 */
export type VwapOpts = Readonly<{
    source?: "hlc3" | "close" | "hl2" | "ohlc4" | "hlcc4";
    offset?: number;
}>;

/**
 * Options bag for `ta.anchoredVwap`. Mirrors {@link VwapOpts}; the
 * `anchorTime` (a UTC millisecond epoch the script author hard-codes)
 * is passed positionally, not via this bag.
 *
 * @formula  vwap_anchored = Σ_{t ≥ anchor}(source · volume) / Σ_{t ≥ anchor}(volume)
 * @since 0.2
 * @stable
 * @example
 *     const opts: AnchoredVwapOpts = { source: "hlc3" };
 */
export type AnchoredVwapOpts = Readonly<{
    source?: "hlc3" | "close" | "hl2" | "ohlc4" | "hlcc4";
    offset?: number;
}>;

/**
 * Options bag for `ta.visibleRangeVolumeProfile`. `rowSize` selects
 * the number of price rows when positive; `0` / omitted falls back to
 * the runtime's automatic row count. `valueAreaPct` accepts either
 * a fraction (`0.7`) or percentage (`70`). `bucketColor` is copied to
 * each emitted horizontal-histogram bucket.
 *
 * @formula  N/A — see `ta.visibleRangeVolumeProfile` JSDoc
 * @since 0.5
 * @stable
 * @example
 *     const opts: VisibleRangeVolumeProfileOpts = {
 *         rowSize: 24,
 *         valueAreaPct: 0.7,
 *         bucketColor: "#90caf9",
 *     };
 */
export type VisibleRangeVolumeProfileOpts = Readonly<{
    rowSize?: number;
    valueAreaPct?: number;
    offset?: number;
    bucketColor?: string;
}>;

/**
 * Multi-output result from `ta.visibleRangeVolumeProfile`.
 *
 * @formula  POC / VAH / VAL from the visible-range volume-profile
 *           bucket set.
 * @since 0.5
 * @stable
 * @example
 *     declare const vp: VisibleRangeVolumeProfileResult;
 *     const poc = vp.poc.current;
 */
export type VisibleRangeVolumeProfileResult = Readonly<{
    poc: Series<number>;
    valHigh: Series<number>;
    valLow: Series<number>;
    buckets: ReadonlyArray<Readonly<{ price: number; volume: number; color?: string }>>;
}>;

/**
 * Options bag for `ta.anchoredVolumeProfile`. `anchor` is a UTC
 * millisecond epoch, typically resolved from
 * `input.time(..., { pickFromChart: true })`; `rowSize` selects the
 * number of price rows when positive; `0` / omitted falls back to the
 * runtime's automatic row count. `valueAreaPct` accepts either a
 * fraction (`0.7`) or percentage (`70`). `bucketColor` is copied to
 * each emitted horizontal-histogram bucket.
 *
 * @formula  N/A — see `ta.anchoredVolumeProfile` JSDoc
 * @since 0.5
 * @stable
 * @example
 *     const opts: AnchoredVolumeProfileOpts = {
 *         anchor: 1_700_000_000_000,
 *         rowSize: 24,
 *         valueAreaPct: 0.7,
 *     };
 */
export type AnchoredVolumeProfileOpts = Readonly<{
    anchor: Time;
    rowSize?: number;
    valueAreaPct?: number;
    offset?: number;
    bucketColor?: string;
}>;

/**
 * Multi-output result from `ta.anchoredVolumeProfile`.
 *
 * @formula  POC / VAH / VAL from the anchor→current volume-profile
 *           bucket set.
 * @since 0.5
 * @stable
 * @example
 *     declare const vp: AnchoredVolumeProfileResult;
 *     const buckets = vp.buckets;
 */
export type AnchoredVolumeProfileResult = Readonly<{
    poc: Series<number>;
    valHigh: Series<number>;
    valLow: Series<number>;
    buckets: ReadonlyArray<Readonly<{ price: number; volume: number; color?: string }>>;
}>;

/**
 * Options bag for `ta.sessionVolumeProfile`. `sessionStart` is an
 * explicit UTC millisecond boundary override; omitted values derive the
 * current session from `syminfo.session` when adapters provide it, or
 * UTC-day fallback boundaries otherwise. `rowSize`, `valueAreaPct`,
 * `offset`, and `bucketColor` mirror the other volume-profile primitives.
 *
 * @formula  N/A — see `ta.sessionVolumeProfile` JSDoc
 * @since 0.5
 * @stable
 * @example
 *     const opts: SessionVolumeProfileOpts = {
 *         rowSize: 24,
 *         valueAreaPct: 0.7,
 *         sessionStart: 1_700_000_000_000,
 *     };
 */
export type SessionVolumeProfileOpts = Readonly<{
    rowSize?: number;
    valueAreaPct?: number;
    offset?: number;
    bucketColor?: string;
    sessionStart?: Time;
}>;

/**
 * Multi-output result from `ta.sessionVolumeProfile`.
 *
 * @formula  POC / VAH / VAL from the current-session volume-profile
 *           bucket set.
 * @since 0.5
 * @stable
 * @example
 *     declare const vp: SessionVolumeProfileResult;
 *     const poc = vp.poc.current;
 */
export type SessionVolumeProfileResult = Readonly<{
    poc: Series<number>;
    valHigh: Series<number>;
    valLow: Series<number>;
    buckets: ReadonlyArray<Readonly<{ price: number; volume: number; color?: string }>>;
}>;

/**
 * Options bag for `ta.fixedRangeVolumeProfile`. `from` and `to` are
 * UTC millisecond anchors, typically resolved from two
 * `input.time(..., { pickFromChart: true })` inputs. `from > to`
 * is invalid and diagnoses at runtime; `from === to` is a
 * single-bar window.
 *
 * @formula  N/A — see `ta.fixedRangeVolumeProfile` JSDoc
 * @since 0.5
 * @stable
 * @example
 *     const opts: FixedRangeVolumeProfileOpts = {
 *         from: 1_700_000_000_000,
 *         to: 1_700_060_000_000,
 *         rowSize: 24,
 *     };
 */
export type FixedRangeVolumeProfileOpts = Readonly<{
    from: Time;
    to: Time;
    rowSize?: number;
    valueAreaPct?: number;
    offset?: number;
    bucketColor?: string;
}>;

/**
 * Multi-output result from `ta.fixedRangeVolumeProfile`.
 *
 * @formula  POC / VAH / VAL from the fixed-range volume-profile
 *           bucket set.
 * @since 0.5
 * @stable
 * @example
 *     declare const vp: FixedRangeVolumeProfileResult;
 *     const buckets = vp.buckets;
 */
export type FixedRangeVolumeProfileResult = Readonly<{
    poc: Series<number>;
    valHigh: Series<number>;
    valLow: Series<number>;
    buckets: ReadonlyArray<Readonly<{ price: number; volume: number; color?: string }>>;
}>;

/**
 * Options bag for `ta.obv` (On-Balance Volume). `offset` shifts the
 * read window backwards (universal offset). `lineStyle`
 * is a forward-compat plot-styling hint surfaced for §9.1 ergonomics —
 * not consumed by the primitive itself.
 *
 * @formula  N/A — see `ta.obv` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const opts: ObvOpts = { offset: 0 };
 */
export type ObvOpts = Readonly<{ offset?: number; lineStyle?: PlotLineStyle }>;

/**
 * Options bag for `ta.adl` (Accumulation Distribution Line). Mirrors
 * {@link ObvOpts}.
 *
 * @formula  N/A — see `ta.adl` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const opts: AdlOpts = { offset: 0 };
 */
export type AdlOpts = Readonly<{ offset?: number; lineStyle?: PlotLineStyle }>;

/**
 * Options bag for `ta.bop` (Balance of Power). Mirrors {@link ObvOpts}.
 *
 * @formula  N/A — see `ta.bop` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const opts: BopOpts = { offset: 0 };
 */
export type BopOpts = Readonly<{ offset?: number; lineStyle?: PlotLineStyle }>;

/**
 * Options bag for `ta.cmf` (Chaikin Money Flow). `length` is positional
 * on the call (Pine-canonical `ta.cmf(length)`), so the opts bag carries
 * only the universal `offset` + the styling hint.
 *
 * @formula  N/A — see `ta.cmf` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const opts: CmfOpts = { offset: 0 };
 */
export type CmfOpts = Readonly<{ offset?: number; lineStyle?: PlotLineStyle }>;

/**
 * Options bag for `ta.chaikinOsc` (Chaikin Oscillator). Defaults
 * match Pine / invinite: `fastLength = 3`, `slowLength = 10`. `offset`
 * shifts the read window backwards (universal offset).
 *
 * @formula  N/A — see `ta.chaikinOsc` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const opts: ChaikinOscOpts = { fastLength: 3, slowLength: 10 };
 */
export type ChaikinOscOpts = Readonly<{
    fastLength?: number;
    slowLength?: number;
    offset?: number;
}>;

/**
 * Options bag for `ta.mfi` (Money Flow Index). `length` is positional
 * on the call (Pine-canonical `ta.mfi(length)`), so the opts bag carries
 * only the universal `offset` + the styling hint.
 *
 * @formula  N/A — see `ta.mfi` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const opts: MfiOpts = { offset: 0 };
 */
export type MfiOpts = Readonly<{ offset?: number; lineStyle?: PlotLineStyle }>;

/**
 * Options bag for `ta.netVolume` (signed-volume cumulative — math
 * equals `ta.obv`, exposed separately for naming parity with Pine /
 * invinite). Mirrors {@link ObvOpts}.
 *
 * @formula  N/A — see `ta.netVolume` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const opts: NetVolumeOpts = { offset: 0 };
 */
export type NetVolumeOpts = Readonly<{ offset?: number; lineStyle?: PlotLineStyle }>;

/**
 * Options bag for `ta.pvo` (Percentage Volume Oscillator). MACD-shape
 * applied to `bar.volume`. Defaults match Appel-era `12 / 26 / 9`
 * (mirrors `ta.ppo` / `ta.macd`). `offset` shifts all three outputs
 * (`pvo`, `signal`, `hist`) in lockstep per the universal `opts.offset`
 * convention.
 *
 * @formula  N/A — see `ta.pvo` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const opts: PvoOpts = { fastLength: 12, slowLength: 26, signalLength: 9 };
 */
export type PvoOpts = Readonly<{
    fastLength?: number;
    slowLength?: number;
    signalLength?: number;
    offset?: number;
}>;

/**
 * The three-series result of `ta.pvo` — the PVO line, its signal
 * line, and the histogram of their difference. All three Series are
 * updated in lock-step with `bar.volume`. `primarySeriesKey: "pvo"`
 * is recorded in `TA_REGISTRY_METADATA`.
 *
 * @formula  pvo    = 100 · (ema(volume, fast) − ema(volume, slow)) / ema(volume, slow) ;
 *           signal = ema(pvo, signalLength) ;
 *           hist   = pvo − signal
 * @since 0.2
 * @stable
 * @example
 *     const p = ta.pvo();
 *     plot(p.pvo); plot(p.signal); plot(p.hist);
 */
export type PvoResult = Readonly<{
    pvo: Series<number>;
    signal: Series<number>;
    hist: Series<number>;
}>;

/**
 * Options bag for `ta.pvt` (Price Volume Trend). Cumulative
 * `volume · (close − prevClose) / prevClose`. `offset` shifts the
 * read window backwards (universal offset). `lineStyle`
 * is a forward-compat plot-styling hint surfaced for §9.1 ergonomics —
 * not consumed by the primitive itself.
 *
 * @formula  N/A — see `ta.pvt` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const opts: PvtOpts = { offset: 0 };
 */
export type PvtOpts = Readonly<{ offset?: number; lineStyle?: PlotLineStyle }>;

/**
 * Options bag for `ta.eom` (Ease of Movement). `length` is positional
 * on the call (Pine-canonical `ta.eom(length)`), so the opts bag carries
 * only the universal `offset` + the styling hint.
 *
 * @formula  N/A — see `ta.eom` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const opts: EomOpts = { offset: 0 };
 */
export type EomOpts = Readonly<{ offset?: number; lineStyle?: PlotLineStyle }>;

/**
 * Options bag for `ta.nvi` (Negative Volume Index). Cumulative `prev ·
 * (1 + (close − prevClose) / prevClose)` on bars where `volume <
 * prevVolume`; carry forward otherwise. Seeded at 1000 (pinned by the
 * runtime's `@anchors seedValue`).
 *
 * @formula  N/A — see `ta.nvi` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const opts: NviOpts = { offset: 0 };
 */
export type NviOpts = Readonly<{ offset?: number; lineStyle?: PlotLineStyle }>;

/**
 * Options bag for `ta.pvi` (Positive Volume Index). Mirror of
 * {@link NviOpts}; updates only on bars where `volume > prevVolume`.
 * Seeded at 1000.
 *
 * @formula  N/A — see `ta.pvi` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const opts: PviOpts = { offset: 0 };
 */
export type PviOpts = Readonly<{ offset?: number; lineStyle?: PlotLineStyle }>;

/**
 * The two-series result of `ta.aroon` — the Up line tracking
 * recency of N-bar highs and the Down line tracking recency of
 * N-bar lows. Both Series ∈ [0, 100] when defined; the runtime
 * emits NaN through the `length` warmup window.
 *
 * @formula  up   = 100 · (length − barsSinceHigh) / length ;
 *           down = 100 · (length − barsSinceLow)  / length
 * @since 0.2
 * @stable
 * @example
 *     const a = ta.aroon(14);
 *     plot(a.up);
 *     plot(a.down);
 */
export type AroonResult = Readonly<{
    up: Series<number>;
    down: Series<number>;
}>;

/**
 * Options bag for `ta.bbPercentB`. `multiplier` scales the BB envelope
 * (defaults to `2`, mirroring Pine / TradingView). `offset` shifts the
 * read window backwards; `lineStyle` is a forward-compat
 * plot-styling hint surfaced for §9.1 ergonomics.
 *
 * @formula  N/A — see `ta.bbPercentB` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const opts: BbPercentBOpts = { multiplier: 2 };
 */
export type BbPercentBOpts = Readonly<{
    multiplier?: number;
    offset?: number;
    lineStyle?: PlotLineStyle;
}>;

/**
 * Options bag for `ta.bbw`. Mirrors {@link BbPercentBOpts}; the
 * runtime emits the raw `(upper − lower) / middle` ratio (no ×100
 * TV-parity scale — multiply in the script for that).
 *
 * @formula  N/A — see `ta.bbw` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const opts: BbwOpts = { multiplier: 2 };
 */
export type BbwOpts = Readonly<{
    multiplier?: number;
    offset?: number;
    lineStyle?: PlotLineStyle;
}>;

/**
 * Options bag for `ta.historicalVolatility`. `annualisationFactor`
 * defaults to `365` (TradingView's "Crypto" / 24-7 convention; use
 * `252` for trading-day equity series). `offset` shifts the read
 * window backwards.
 *
 * @formula  N/A — see `ta.historicalVolatility` JSDoc
 * @anchors  annualisationFactor
 * @since 0.2
 * @stable
 * @example
 *     const opts: HvOpts = { annualisationFactor: 252 };
 */
export type HvOpts = Readonly<{
    annualisationFactor?: number;
    offset?: number;
    lineStyle?: PlotLineStyle;
}>;

/**
 * Options bag for `ta.rvi`. `offset` shifts the read window
 * backwards; `lineStyle` is a forward-compat
 * plot-styling hint surfaced for §9.1 ergonomics.
 *
 * @formula  N/A — see `ta.rvi` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const opts: RviOpts = { offset: 0 };
 */
export type RviOpts = Readonly<{
    offset?: number;
    lineStyle?: PlotLineStyle;
}>;

/**
 * Options bag for `ta.massIndex`. `emaLength` defaults to `9` (the
 * inner EMA-of-range and outer EMA-of-EMA window); `sumLength`
 * defaults to `25` (the rolling-sum-of-ratio window). `offset`
 * shifts the read window backwards.
 *
 * @formula  N/A — see `ta.massIndex` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const opts: MassIndexOpts = { emaLength: 9, sumLength: 25 };
 */
export type MassIndexOpts = Readonly<{
    emaLength?: number;
    sumLength?: number;
    offset?: number;
    lineStyle?: PlotLineStyle;
}>;

/**
 * Options bag for `ta.donchian`. `offset` shifts the read window
 * backwards. `outputs` carries per-output styling
 * hints downstream `plot()` callsites can lift defaults from; the
 * runtime itself ignores it in Phase 2.
 *
 * @formula  N/A — see `ta.donchian` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const opts: DonchianOpts = { offset: 0 };
 */
export type DonchianOpts = Readonly<{
    offset?: number;
    outputs?: Readonly<Record<"upper" | "middle" | "lower", { lineStyle?: PlotLineStyle }>>;
}>;

/**
 * The three-series result of `ta.donchian` — the upper / middle /
 * lower bands of the Donchian channel envelope. All three Series are
 * updated in lock-step with the trailing `length`-bar high/low
 * window. `primarySeriesKey: "middle"` (recorded in
 * `TA_REGISTRY_METADATA`).
 *
 * @formula  upper = highest(high, length) ;
 *           lower = lowest(low, length) ;
 *           middle = (upper + lower) / 2
 * @since 0.2
 * @stable
 * @example
 *     const d = ta.donchian(20);
 *     plot(d.upper);
 *     plot(d.middle);
 *     plot(d.lower);
 */
export type DonchianResult = Readonly<{
    upper: Series<number>;
    middle: Series<number>;
    lower: Series<number>;
}>;

/**
 * Options bag for `ta.keltner` (Keltner Channels). `length` is the
 * MA / ATR period (default `20`); `multiplier` scales the ATR-derived
 * band offset from the middle MA (default `2`); `maType` picks the
 * middle MA kind (default `"ema"` per the Linda Raschke / TradingView
 * canonical form — Chester Keltner's original used SMA over a hand-
 * rolled "typical range", but every modern reference defaults to EMA
 * over close + Wilder ATR). `offset` is the universal bar-shift
 * (accepted on the surface). `outputs` carries
 * per-output styling hints downstream `plot()` callsites can lift
 * defaults from; the runtime itself ignores it in Phase 2.
 *
 * @formula  N/A — see `ta.keltner` JSDoc
 * @anchors  maType
 * @since 0.2
 * @stable
 * @example
 *     const opts: KeltnerOpts = { length: 20, multiplier: 2, maType: "ema" };
 */
export type KeltnerOpts = Readonly<{
    length?: number;
    multiplier?: number;
    maType?: MaTypeNoVolume;
    offset?: number;
    outputs?: Readonly<Record<"upper" | "middle" | "lower", { lineStyle?: PlotLineStyle }>>;
}>;

/**
 * The three-series result of `ta.keltner` — the upper / middle /
 * lower bands of the Keltner channel envelope. All three Series
 * update in lock-step with the source close + ATR. The middle band
 * is identity-shared with the composed MA sub-primitive's output;
 * the upper / lower bands are derived per bar.
 *
 * @formula  middle = MA(close, length, maType) ;
 *           upper  = middle + multiplier · atr(length) ;
 *           lower  = middle − multiplier · atr(length)
 * @since 0.2
 * @stable
 * @example
 *     const k = ta.keltner({ length: 20, multiplier: 2 });
 *     plot(k.upper);
 *     plot(k.middle);
 *     plot(k.lower);
 */
export type KeltnerResult = Readonly<{
    upper: Series<number>;
    middle: Series<number>;
    lower: Series<number>;
}>;

/**
 * Options bag for `ta.envelope` (price-percent envelope). `length`
 * is the MA period (default `20`); `percent` is the band offset as a
 * percentage of the middle MA (default `10`); `maType` picks the MA
 * kind (default `"sma"`). `offset` is the universal bar-shift
 * (accepted on the surface).
 *
 * @formula  N/A — see `ta.envelope` JSDoc
 * @anchors  maType
 * @since 0.2
 * @stable
 * @example
 *     const opts: EnvelopeOpts = { length: 20, percent: 10, maType: "sma" };
 */
export type EnvelopeOpts = Readonly<{
    length?: number;
    percent?: number;
    maType?: MaTypeNoVolume;
    offset?: number;
}>;

/**
 * The three-series result of `ta.envelope` — the upper / middle /
 * lower bands of a price-percent envelope around an MA. The middle
 * band is identity-shared with the composed MA sub-primitive's
 * output; the bands are a pure multiplicative offset.
 *
 * @formula  middle = MA(source, length, maType) ;
 *           upper  = middle · (1 + percent / 100) ;
 *           lower  = middle · (1 − percent / 100)
 * @since 0.2
 * @stable
 * @example
 *     const e = ta.envelope(bar.close, { percent: 10 });
 *     plot(e.upper);
 *     plot(e.middle);
 *     plot(e.lower);
 */
export type EnvelopeResult = Readonly<{
    upper: Series<number>;
    middle: Series<number>;
    lower: Series<number>;
}>;

/**
 * Options bag for `ta.chop` (Choppiness Index). `offset` is the
 * universal bar-shift (accepted on the surface).
 * `lineStyle` is a forward-compat plot-styling hint surfaced for
 * §9.1 ergonomics — not consumed by the primitive itself.
 *
 * @formula  N/A — see `ta.chop` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const opts: ChopOpts = { offset: 0 };
 */
export type ChopOpts = Readonly<{ offset?: number; lineStyle?: PlotLineStyle }>;

/**
 * Options bag for `ta.psar` (Parabolic SAR). `accelerationStart` /
 * `accelerationStep` / `accelerationMax` default to the canonical
 * Wilder values `0.02` / `0.02` / `0.2`. `offset` shifts the read
 * window backwards (accepted on the surface).
 *
 * @formula  N/A — see `ta.psar` JSDoc
 * @anchors  accelerationStart, accelerationStep, accelerationMax
 * @since 0.2
 * @stable
 * @example
 *     const opts: PsarOpts = { accelerationStart: 0.02, accelerationStep: 0.02, accelerationMax: 0.2 };
 */
export type PsarOpts = Readonly<{
    accelerationStart?: number;
    accelerationStep?: number;
    accelerationMax?: number;
    offset?: number;
}>;

/**
 * The two-series result of `ta.psar` — the SAR (stop-and-reverse)
 * level and the per-bar `direction` (`+1` uptrend, `-1` downtrend,
 * NaN during warmup or NaN-suspension). `direction` carries plain
 * `number` (not a narrow `+1 | -1` literal) to match the runtime's
 * `Series<number>` convention.
 *
 * @formula  sar derived from extreme-point + acceleration-factor recurrence ;
 *           direction flips when bar.low ≤ candidateSar (up→down) or
 *           bar.high ≥ candidateSar (down→up)
 * @since 0.2
 * @stable
 * @example
 *     const p = ta.psar();
 *     plot(p.sar);
 */
export type PsarResult = Readonly<{
    sar: Series<number>;
    direction: Series<number>;
}>;

/**
 * Options bag for `ta.supertrend`. `length` is the ATR period
 * (default `10`); `multiplier` scales the band offset from `hl2`
 * (default `3`). `offset` shifts the read window backwards
 * (accepted on the surface). The source is hard-coded
 * to `hl2` (Pine-canonical Supertrend); a `source` opt could land in
 * a follow-up.
 *
 * @formula  N/A — see `ta.supertrend` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const opts: SupertrendOpts = { length: 10, multiplier: 3 };
 */
export type SupertrendOpts = Readonly<{
    length?: number;
    multiplier?: number;
    offset?: number;
}>;

/**
 * The two-series result of `ta.supertrend` — the trailing-stop
 * `line` (the active final band per current direction) and the
 * per-bar `direction` (`+1` uptrend → `line = finalLower`,
 * `-1` downtrend → `line = finalUpper`, NaN during warmup).
 *
 * @formula  finalUpper, finalLower derived from hl2 ± multiplier·atr ;
 *           direction flips when close crosses prior finalUpper / finalLower ;
 *           line = direction === +1 ? finalLower : finalUpper
 * @since 0.2
 * @stable
 * @example
 *     const s = ta.supertrend({ length: 10, multiplier: 3 });
 *     plot(s.line);
 */
export type SupertrendResult = Readonly<{
    line: Series<number>;
    direction: Series<number>;
}>;

/**
 * Options bag for `ta.chandelier` (Chandelier Exit). `length` is the
 * ATR period AND the rolling extreme window (default `22`);
 * `multiplier` scales the ATR offset (default `3`). `offset` shifts
 * the read window backwards (accepted on the surface).
 *
 * @formula  N/A — see `ta.chandelier` JSDoc
 * @anchors  length, multiplier
 * @since 0.2
 * @stable
 * @example
 *     const opts: ChandelierOpts = { length: 22, multiplier: 3 };
 */
export type ChandelierOpts = Readonly<{
    length?: number;
    multiplier?: number;
    offset?: number;
}>;

/**
 * The two-series result of `ta.chandelier` — `long` is the trailing
 * stop for long trades (`highest(high, length) − multiplier · atr`),
 * `short` is the trailing stop for short trades (`lowest(low, length)
 * + multiplier · atr`). Both Series carry NaN through the
 * `length`-bar warmup (ATR + highest/lowest sub-slots' warmups).
 *
 * @formula  long  = highest(high, length) − multiplier · atr(length) ;
 *           short = lowest(low,   length) + multiplier · atr(length)
 * @since 0.2
 * @stable
 * @example
 *     const c = ta.chandelier({ length: 22, multiplier: 3 });
 *     plot(c.long);
 *     plot(c.short);
 */
export type ChandelierResult = Readonly<{
    long: Series<number>;
    short: Series<number>;
}>;

/**
 * Options bag for `ta.chandeKrollStop`. `length` controls BOTH the
 * ATR period AND the first-pass rolling extreme window (default
 * `10`); `multiplier` scales the ATR offset (default `1`);
 * `smoothingLength` is the second-pass extreme window (default `9`)
 * — matches Chande Kroll's 1995 paper. `offset` shifts the read
 * window backwards (accepted on the surface).
 *
 * @formula  N/A — see `ta.chandeKrollStop` JSDoc
 * @anchors  length, multiplier
 * @since 0.2
 * @stable
 * @example
 *     const opts: ChandeKrollStopOpts = { length: 10, multiplier: 1, smoothingLength: 9 };
 */
export type ChandeKrollStopOpts = Readonly<{
    length?: number;
    multiplier?: number;
    smoothingLength?: number;
    offset?: number;
}>;

/**
 * The two-series result of `ta.chandeKrollStop` — `long` is the
 * smoothed long-trade trailing stop (second-pass max of the
 * first-pass long stops); `short` is the smoothed short-trade
 * trailing stop (second-pass min of the first-pass short stops).
 * Both Series carry NaN through the `length + smoothingLength`
 * warmup.
 *
 * @formula  firstHigh = highest(high, length) − multiplier · atr(length) ;
 *           firstLow  = lowest(low,   length) + multiplier · atr(length) ;
 *           long  = max(firstHigh over smoothingLength bars) ;
 *           short = min(firstLow  over smoothingLength bars)
 * @since 0.2
 * @stable
 * @example
 *     const c = ta.chandeKrollStop();
 *     plot(c.long);
 *     plot(c.short);
 */
export type ChandeKrollStopResult = Readonly<{
    long: Series<number>;
    short: Series<number>;
}>;

/**
 * Options bag for `ta.williamsFractal`. `length` is the symmetric
 * left / right window size (default `2` — total 5-bar window: 2
 * left + centre + 2 right). `offset` shifts the read window
 * backwards (accepted on the surface).
 *
 * @formula  N/A — see `ta.williamsFractal` JSDoc
 * @anchors  length
 * @since 0.2
 * @stable
 * @example
 *     const opts: WilliamsFractalOpts = { length: 2 };
 */
export type WilliamsFractalOpts = Readonly<{
    length?: number;
    offset?: number;
}>;

/**
 * The two-series result of `ta.williamsFractal` — the centred
 * fractal markers. `up.current` is the centre bar's `bar.high` when
 * the centre bar is an up-fractal (its high is strictly greater
 * than the `length` bars on either side), NaN otherwise.
 * `down.current` is the centre bar's `bar.low` for down-fractals.
 *
 * The output is centred: at live bar `t`, the value emitted is the
 * fractal status of bar `t − length` (when bar `t` closes, we now
 * have enough right-window bars to confirm bar `t − length`). The
 * most recent `length` bars of each Series are intentionally NaN
 * (pending right-window confirmation).
 *
 * Note: deviates from the task spec's literal `Series<boolean>`
 * wording in favour of price levels (matches invinite's
 * `upFractals[i] = high`). This gives the `marker` plot a y-anchor
 * — the high or low at which the fractal triggered — which is what
 * TradingView visually shows.
 *
 * @formula  up   = bar.high(centre) when centre is up-fractal, NaN otherwise ;
 *           down = bar.low(centre)  when centre is down-fractal, NaN otherwise
 * @since 0.2
 * @stable
 * @example
 *     const f = ta.williamsFractal();
 *     plot(f.up,   { style: { kind: "marker", shape: "triangle-up",   size: 6 } });
 *     plot(f.down, { style: { kind: "marker", shape: "triangle-down", size: 6 } });
 */
export type WilliamsFractalResult = Readonly<{
    up: Series<number>;
    down: Series<number>;
}>;

/**
 * Options bag for `ta.zigZag`. `deviation` is the percentage move
 * (default `5`) required to confirm a reversal pivot from the running
 * candidate; `depth` is the minimum number of bars (default `10`) that
 * must elapse before a pivot can be confirmed. `offset` shifts the
 * read window backwards (accepted on the surface).
 *
 * @formula  N/A — see `ta.zigZag` JSDoc
 * @anchors  deviation, depth
 * @since 0.2
 * @stable
 * @example
 *     const opts: ZigZagOpts = { deviation: 5, depth: 10 };
 */
export type ZigZagOpts = Readonly<{
    deviation?: number;
    depth?: number;
    offset?: number;
}>;

/**
 * The two-series result of `ta.zigZag` — `value` carries the price of
 * the most-recently-confirmed swing pivot (held constant between
 * confirmations, NaN until the first confirmation); `direction` is
 * `+1` (uptrend), `-1` (downtrend), or NaN before the first
 * confirmation.
 *
 * Streaming adaptation of invinite's batch ZigZag: the runtime is
 * append-only and cannot retroactively rewrite earlier output slots,
 * so the linear-interpolation rendering between confirmed pivots that
 * invinite paints is intentionally not modelled here — the output
 * series is the "last-confirmed-pivot level" (a trailing horizontal
 * line a Pine author would use as a reference).
 *
 * @formula  see `ta.zigZag` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const z = ta.zigZag({ deviation: 5 });
 *     plot(z.value);
 */
export type ZigZagResult = Readonly<{
    value: Series<number>;
    direction: Series<number>;
}>;

/**
 * Options bag for `ta.pivotsHighLow`. `leftLength` / `rightLength`
 * default to `4` (a 9-bar centred window); they may differ to surface
 * asymmetric `ta.pivothigh` / `ta.pivotlow` behaviour. `offset` shifts
 * the read window backwards (accepted on the surface).
 *
 * @formula  N/A — see `ta.pivotsHighLow` JSDoc
 * @anchors  leftLength, rightLength
 * @since 0.2
 * @stable
 * @example
 *     const opts: PivotsHighLowOpts = { leftLength: 4, rightLength: 4 };
 */
export type PivotsHighLowOpts = Readonly<{
    leftLength?: number;
    rightLength?: number;
    offset?: number;
}>;

/**
 * The two-series result of `ta.pivotsHighLow` — the centred swing-
 * high / swing-low markers. `high.current` = `bar.high(centre)` when
 * the centre bar is a confirmed up-pivot (strict-greater on the left
 * window, geq on the right — matches Pine `ta.pivothigh`); NaN
 * otherwise. `low.current` mirrors for down-pivots with `bar.low`.
 *
 * Output is centred — at live bar `t`, the value emitted is the
 * pivot status of bar `t − rightLength` (when bar `t` closes, we now
 * have enough right-window bars to confirm bar `t − rightLength`).
 * The most recent `rightLength` slots of each Series are
 * intentionally NaN (pending right-window confirmation).
 *
 * @formula  high = bar.high(centre) when centre is up-pivot, NaN otherwise ;
 *           low  = bar.low(centre)  when centre is down-pivot, NaN otherwise
 * @since 0.2
 * @stable
 * @example
 *     const p = ta.pivotsHighLow({ leftLength: 4, rightLength: 4 });
 *     plot(p.high);
 *     plot(p.low);
 */
export type PivotsHighLowResult = Readonly<{
    high: Series<number>;
    low: Series<number>;
}>;

/**
 * The classical pivot-points formula systems supported by
 * `ta.pivotsStandard`. `"classic"` is the default; `"fibonacci"` /
 * `"camarilla"` / `"woodie"` mirror the published TradingView
 * formulas. DeMark / Traditional are deferred to a later phase.
 *
 * @formula  N/A — string-literal union type
 * @since 0.2
 * @stable
 * @example
 *     const sys: PivotsStandardSystem = "classic";
 */
export type PivotsStandardSystem = "classic" | "fibonacci" | "camarilla" | "woodie";

/**
 * Options bag for `ta.pivotsStandard`. `system` picks the formula
 * family (default `"classic"`). `offset` shifts the read window
 * backwards (accepted on the surface).
 *
 * @formula  N/A — see `ta.pivotsStandard` JSDoc
 * @anchors  system
 * @since 0.2
 * @stable
 * @example
 *     const opts: PivotsStandardOpts = { system: "fibonacci" };
 */
export type PivotsStandardOpts = Readonly<{
    system?: PivotsStandardSystem;
    offset?: number;
}>;

/**
 * The seven-series result of `ta.pivotsStandard` — the classical
 * pivot point `pp` plus three resistance / three support levels
 * derived from the prior UTC-day's high / low / close. The runtime
 * resets the day aggregate on every UTC-day boundary (detected via
 * `Math.floor(bar.time / 86_400_000)`); the levels for the current
 * day are computed from the prior closed day's HLC.
 *
 * R4 / R5 / S4 / S5 are intentionally deferred — Phase 2 ships
 * R1..R3 / S1..S3 only per the Phase-2 README "Deferred / Follow-Up
 * Work" footnote.
 *
 * @formula  see `ta.pivotsStandard` JSDoc (per-system formula table)
 * @since 0.2
 * @stable
 * @example
 *     const p = ta.pivotsStandard();
 *     plot(p.pp);
 *     plot(p.r1);
 *     plot(p.s1);
 */
export type PivotsStandardResult = Readonly<{
    pp: Series<number>;
    r1: Series<number>;
    s1: Series<number>;
    r2: Series<number>;
    s2: Series<number>;
    r3: Series<number>;
    s3: Series<number>;
}>;

/**
 * Options bag for `ta.volatilityStop`. `length` is the ATR period
 * (default `20`); `multiplier` scales the ATR offset (default `2`).
 * `offset` shifts the read window backwards (accepted
 * on the surface). Source is hard-coded to `bar.close` (Pine
 * `ta.vstop` convention); an explicit `source` opt could land in a
 * follow-up.
 *
 * @formula  N/A — see `ta.volatilityStop` JSDoc
 * @anchors  length, multiplier
 * @since 0.2
 * @stable
 * @example
 *     const opts: VolatilityStopOpts = { length: 20, multiplier: 2 };
 */
export type VolatilityStopOpts = Readonly<{
    length?: number;
    multiplier?: number;
    offset?: number;
}>;

/**
 * The two-series result of `ta.volatilityStop` — the trailing-stop
 * `value` (analogous to PSAR's `sar`) and the per-bar `direction`
 * (`+1` uptrend → stop is BELOW price, `-1` downtrend → stop is
 * ABOVE price, NaN during warmup or NaN-suspension).
 *
 * @formula  trend up:   value = max(prevStop, src − multiplier · atr) ;
 *           trend down: value = min(prevStop, src + multiplier · atr) ;
 *           flip on src crossing the stop
 * @since 0.2
 * @stable
 * @example
 *     const v = ta.volatilityStop({ length: 20, multiplier: 2 });
 *     plot(v.value);
 */
export type VolatilityStopResult = Readonly<{
    value: Series<number>;
    direction: Series<number>;
}>;

/**
 * Options bag for `ta.adx` (Wilder's Average Directional Index).
 * `smoothing` is the second-stage Wilder window applied to DX
 * (default `14` — matches the DI window). `offset` shifts the
 * output. `lineStyle` is a forward-compat plot-
 * styling hint surfaced for §9.1 ergonomics — not consumed by the
 * primitive itself.
 *
 * @formula  N/A — see `ta.adx` JSDoc
 * @anchors  smoothing
 * @since 0.2
 * @stable
 * @example
 *     const opts: AdxOpts = { smoothing: 14 };
 */
export type AdxOpts = Readonly<{
    smoothing?: number;
    offset?: number;
    lineStyle?: PlotLineStyle;
}>;

/**
 * Options bag for `ta.dmi` (Directional Movement Index). `offset`
 * shifts both output series in lockstep. `outputs`
 * carries per-output styling hints downstream `plot()` callsites
 * can lift defaults from; the runtime itself ignores it in Phase 2
 * — script-author `plot(d.plusDi, { lineStyle })` is the styling
 * seam.
 *
 * @formula  N/A — see `ta.dmi` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const opts: DmiOpts = { offset: 0 };
 */
export type DmiOpts = Readonly<{
    offset?: number;
    outputs?: Readonly<Record<"plusDi" | "minusDi", { lineStyle?: PlotLineStyle }>>;
}>;

/**
 * The two-series result of `ta.dmi` — Wilder's `+DI` / `−DI` pair.
 * Both ∈ [0, 100] when defined; NaN through the `length` warmup
 * window. `primarySeriesKey: "plusDi"` (recorded in
 * `TA_REGISTRY_METADATA`) with `yDomain: { kind: "fixed", min: 0,
 * max: 100 }`.
 *
 * @formula  see `ta.dmi` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const d = ta.dmi(14);
 *     plot(d.plusDi);
 *     plot(d.minusDi);
 */
export type DmiResult = Readonly<{
    plusDi: Series<number>;
    minusDi: Series<number>;
}>;

/**
 * Options bag for `ta.trix` (Triple-smoothed EMA Rate-of-Change).
 * `signalLength` is the EMA-smoothing length of the TRIX signal
 * line (default `9`). `offset` shifts both output series in
 * lockstep.
 *
 * @formula  N/A — see `ta.trix` JSDoc
 * @anchors  signalLength
 * @since 0.2
 * @stable
 * @example
 *     const opts: TrixOpts = { signalLength: 9 };
 */
export type TrixOpts = Readonly<{
    signalLength?: number;
    offset?: number;
}>;

/**
 * The two-series result of `ta.trix` — the TRIX momentum line and
 * its EMA signal line. Both are unbounded; `yDomain: { kind:
 * "auto" }`. `primarySeriesKey: "trix"` (recorded in
 * `TA_REGISTRY_METADATA`).
 *
 * @formula  see `ta.trix` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const t = ta.trix(bar.close, 18);
 *     plot(t.trix);
 *     plot(t.signal);
 */
export type TrixResult = Readonly<{
    trix: Series<number>;
    signal: Series<number>;
}>;

/**
 * Options bag for `ta.vortex` (Botes & Siepman Vortex Indicator).
 * `length` is positional on the call (`ta.vortex(length, opts?)`), so
 * the opts bag carries only the universal `offset` +
 * per-output styling hints. The runtime emits `NaN` on zero-TR
 * windows (chartlang surfaces the degenerate window — invinite emits
 * 0 in the same case).
 *
 * @formula  N/A — see `ta.vortex` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const opts: VortexOpts = { offset: 0 };
 */
export type VortexOpts = Readonly<{
    offset?: number;
    outputs?: Readonly<Record<"plus" | "minus", { lineStyle?: PlotLineStyle }>>;
}>;

/**
 * The two-series result of `ta.vortex` — the `+VI` / `−VI` Vortex
 * lines (Botes & Siepman, 2010). Typical operating range `[0, 2]`
 * (`yDomain: { kind: "auto" }`). `primarySeriesKey: "plus"` is
 * recorded in `TA_REGISTRY_METADATA`.
 *
 * @formula  see `ta.vortex` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const v = ta.vortex(14);
 *     plot(v.plus);
 *     plot(v.minus);
 */
export type VortexResult = Readonly<{
    plus: Series<number>;
    minus: Series<number>;
}>;

/**
 * Options bag for `ta.trendStrengthIndex` — TradingView's Trend
 * Strength Index, the Pearson correlation between `source` and the
 * bar index. Distinct from `ta.tsi` (Task 14's True Strength Index
 * momentum oscillator). Default `length = 20` (positional). `offset`
 * matches the universal §9.1 convention.
 *
 * @formula  N/A — see `ta.trendStrengthIndex` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const opts: TrendStrengthIndexOpts = { offset: 0 };
 */
export type TrendStrengthIndexOpts = Readonly<{
    offset?: number;
    lineStyle?: PlotLineStyle;
}>;

/**
 * Options bag for `ta.ichimoku`. Defaults follow Pine / TradingView
 * canonical Ichimoku — `conversionLength = 9, baseLength = 26,
 * leadingSpanBLength = 52, displacement = 26`. `offset` shifts all
 * five outputs in lockstep. `outputs` carries
 * per-output styling hints downstream `plot()` callsites can lift
 * defaults from; the runtime itself ignores it in Phase 2.
 *
 * @formula  N/A — see `ta.ichimoku` JSDoc
 * @anchors  displacement, conversionLength, baseLength, leadingSpanBLength
 * @since 0.2
 * @stable
 * @example
 *     const opts: IchimokuOpts = {
 *         conversionLength: 9,
 *         baseLength: 26,
 *         leadingSpanBLength: 52,
 *         displacement: 26,
 *     };
 */
export type IchimokuOpts = Readonly<{
    conversionLength?: number;
    baseLength?: number;
    leadingSpanBLength?: number;
    displacement?: number;
    offset?: number;
    outputs?: Readonly<
        Record<"tenkan" | "kijun" | "senkouA" | "senkouB" | "chikou", { lineStyle?: PlotLineStyle }>
    >;
}>;

/**
 * The five-series result of `ta.ichimoku` — Tenkan (Conversion Line),
 * Kijun (Base Line), Senkou Span A / B (Leading Spans, forward-shifted
 * by `displacement`), Chikou (Lagging Span — backward-shifted close).
 * `primarySeriesKey: "tenkan"` (recorded in `TA_REGISTRY_METADATA`)
 * with `yDomain: { kind: "auto" }`. The cloud renders as a
 * `filled-band` PlotKind (Task 1 prerequisite) between `senkouA` and
 * `senkouB`; the script author drives this via their `plot()` call —
 * the runtime emits the two series.
 *
 * @formula  see `ta.ichimoku` JSDoc
 * @since 0.2
 * @stable
 * @example
 *     const i = ta.ichimoku();
 *     plot(i.tenkan);
 *     plot(i.kijun);
 *     plot(i.senkouA);
 *     plot(i.senkouB);
 *     plot(i.chikou);
 */
export type IchimokuResult = Readonly<{
    tenkan: Series<number>;
    kijun: Series<number>;
    senkouA: Series<number>;
    senkouB: Series<number>;
    chikou: Series<number>;
}>;

/**
 * The three-series result of `ta.bb`. Each component is a separate `Series`
 * the runtime updates in lock-step with the source.
 *
 * @formula  upper = sma + k * stdev, lower = sma − k * stdev
 * @since 0.1
 * @stable
 * @example
 *     declare const close: Series<number>;
 *     const bands = ta.bb(close, 20, { multiplier: 2 });
 *     plot(bands.upper);
 */
export type BbResult = Readonly<{
    upper: Series<number>;
    middle: Series<number>;
    lower: Series<number>;
}>;

/**
 * The three-series result of `ta.macd` — the MACD line, its signal line, and
 * the histogram of their difference.
 *
 * @formula  macd = ema(src, fast) − ema(src, slow); signal = ema(macd, signal);
 *           hist = macd − signal
 * @since 0.1
 * @stable
 * @example
 *     declare const close: Series<number>;
 *     const m = ta.macd(close);
 *     plot(m.hist);
 */
export type MacdResult = Readonly<{
    macd: Series<number>;
    signal: Series<number>;
    hist: Series<number>;
}>;

/**
 * The typed surface of the `ta` namespace. The runtime registers concrete
 * implementations against this interface; scripts call it through the
 * `ta` constant exported from `@invinite-org/chartlang-core`.
 *
 * `ta.atr` takes no `source` because ATR is derived from bar OHLC in the
 * runtime (mirrors Pine's signature).
 *
 * @formula  see per-method JSDoc on the `ta` const below
 * @since 0.1
 * @stable
 * @example
 *     declare const close: Series<number>;
 *     const e: Series<number> = ta.ema(close, 20);
 */
export type TaNamespace = {
    sma(source: Series<number>, length: number, opts?: SmaOpts): Series<number>;
    ema(source: Series<number>, length: number, opts?: EmaOpts): Series<number>;
    stdev(source: Series<number>, length: number, opts?: StdevOpts): Series<number>;
    bb(source: Series<number>, length: number, opts?: BbOpts): BbResult;
    rsi(source: Series<number>, length: number, opts?: RsiOpts): Series<number>;
    macd(source: Series<number>, opts?: MacdOpts): MacdResult;
    atr(length: number, opts?: AtrOpts): Series<number>;
    crossover(a: Series<number>, b: Series<number> | number, opts?: CrossoverOpts): Series<boolean>;
    crossunder(
        a: Series<number>,
        b: Series<number> | number,
        opts?: CrossunderOpts,
    ): Series<boolean>;
    nz(value: number, replacement?: number): number;
    highest(source: Series<number>, length: number, opts?: HighestOpts): Series<number>;
    lowest(source: Series<number>, length: number, opts?: LowestOpts): Series<number>;
    highestbars(source: Series<number>, length: number, opts?: HighestbarsOpts): Series<number>;
    lowestbars(source: Series<number>, length: number, opts?: LowestbarsOpts): Series<number>;
    change(source: Series<number>, opts?: ChangeOpts): Series<number>;
    valuewhen(
        condition: Series<boolean>,
        source: Series<number>,
        occurrence?: number,
        opts?: ValuewhenOpts,
    ): Series<number>;
    barssince(condition: Series<boolean>, opts?: BarssinceOpts): Series<number>;
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
    cci(source: Series<number>, length: number, opts?: CciOpts): Series<number>;
    stoch(opts?: StochOpts): StochResult;
    williamsR(length: number, opts?: WilliamsROpts): Series<number>;
    stochRsi(source: Series<number>, opts?: StochRsiOpts): StochRsiResult;
    ultimateOsc(opts?: UltimateOscOpts): Series<number>;
    coppock(source: Series<number>, opts?: CoppockOpts): Series<number>;
    ppo(source: Series<number>, opts?: PpoOpts): PpoResult;
    dpo(source: Series<number>, length: number, opts?: DpoOpts): Series<number>;
    connorsRsi(source: Series<number>, opts?: ConnorsRsiOpts): Series<number>;
    kst(source: Series<number>, opts?: KstOpts): KstResult;
    fisher(length: number, opts?: FisherOpts): FisherResult;
    klinger(opts?: KlingerOpts): KlingerResult;
    rvgi(opts?: RvgiOpts): RvgiResult;
    ao(opts?: AoOpts): Series<number>;
    cmo(source: Series<number>, length: number, opts?: CmoOpts): Series<number>;
    momentum(source: Series<number>, length: number, opts?: MomentumOpts): Series<number>;
    roc(source: Series<number>, length: number, opts?: RocOpts): Series<number>;
    pmo(source: Series<number>, opts?: PmoOpts): PmoResult;
    smi(opts?: SmiOpts): SmiResult;
    tsi(source: Series<number>, opts?: TsiOpts): TsiResult;
    aroon(length: number, opts?: AroonOpts): AroonResult;
    aroonOsc(length: number, opts?: AroonOscOpts): Series<number>;
    median(source: Series<number>, length: number, opts?: MedianOpts): Series<number>;
    adr(opts?: AdrOpts): Series<number>;
    ulcerIndex(source: Series<number>, length: number, opts?: UlcerIndexOpts): Series<number>;
    vol(opts?: VolOpts): Series<number>;
    vwap(opts?: VwapOpts): Series<number>;
    anchoredVwap(anchorTime: number, opts?: AnchoredVwapOpts): Series<number>;
    anchoredVolumeProfile(opts: AnchoredVolumeProfileOpts): AnchoredVolumeProfileResult;
    fixedRangeVolumeProfile(opts: FixedRangeVolumeProfileOpts): FixedRangeVolumeProfileResult;
    sessionVolumeProfile(opts?: SessionVolumeProfileOpts): SessionVolumeProfileResult;
    visibleRangeVolumeProfile(
        opts?: VisibleRangeVolumeProfileOpts,
    ): VisibleRangeVolumeProfileResult;
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
    bbPercentB(source: Series<number>, length: number, opts?: BbPercentBOpts): Series<number>;
    bbw(source: Series<number>, length: number, opts?: BbwOpts): Series<number>;
    donchian(length: number, opts?: DonchianOpts): DonchianResult;
    keltner(opts?: KeltnerOpts): KeltnerResult;
    envelope(source: Series<number>, opts?: EnvelopeOpts): EnvelopeResult;
    chop(length: number, opts?: ChopOpts): Series<number>;
    historicalVolatility(source: Series<number>, length: number, opts?: HvOpts): Series<number>;
    rvi(source: Series<number>, length: number, opts?: RviOpts): Series<number>;
    massIndex(opts?: MassIndexOpts): Series<number>;
    psar(opts?: PsarOpts): PsarResult;
    supertrend(opts?: SupertrendOpts): SupertrendResult;
    chandelier(opts?: ChandelierOpts): ChandelierResult;
    chandeKrollStop(opts?: ChandeKrollStopOpts): ChandeKrollStopResult;
    williamsFractal(opts?: WilliamsFractalOpts): WilliamsFractalResult;
    zigZag(opts?: ZigZagOpts): ZigZagResult;
    pivotsHighLow(opts?: PivotsHighLowOpts): PivotsHighLowResult;
    pivotsStandard(opts?: PivotsStandardOpts): PivotsStandardResult;
    volatilityStop(opts?: VolatilityStopOpts): VolatilityStopResult;
    adx(length: number, opts?: AdxOpts): Series<number>;
    dmi(length: number, opts?: DmiOpts): DmiResult;
    trix(source: Series<number>, length: number, opts?: TrixOpts): TrixResult;
    vortex(length: number, opts?: VortexOpts): VortexResult;
    trendStrengthIndex(
        source: Series<number>,
        length: number,
        opts?: TrendStrengthIndexOpts,
    ): Series<number>;
    ichimoku(opts?: IchimokuOpts): IchimokuResult;
};

/**
 * The compile-time callable hole for the `ta` namespace. Every method throws
 * the `"ta.<name> called outside compiled runtime"` sentinel — the compiler
 * (Task 2) rewrites callsites to re-target the real runtime implementations.
 *
 * Scripts import this constant; the compiler swaps the call target at build
 * time. Direct invocation (outside a compiled script) is the failure mode
 * these sentinels guard.
 *
 * @formula  see method-specific JSDoc on the runtime implementations
 * @since 0.1
 * @stable
 * @example
 * ```ts
 * import { defineIndicator, ta, plot } from "@invinite-org/chartlang-core";
 *
 * export default defineIndicator({
 *     name: "EMA(20)",
 *     apiVersion: 1,
 *     compute: ({ bar }) => {
 *         plot(ta.ema(bar.close, 20));
 *     },
 * });
 * ```
 */
export const ta: TaNamespace = /* @__PURE__ */ Object.freeze({
    sma: () => {
        throw new Error("ta.sma called outside compiled runtime");
    },
    ema: () => {
        throw new Error("ta.ema called outside compiled runtime");
    },
    stdev: () => {
        throw new Error("ta.stdev called outside compiled runtime");
    },
    bb: () => {
        throw new Error("ta.bb called outside compiled runtime");
    },
    rsi: () => {
        throw new Error("ta.rsi called outside compiled runtime");
    },
    macd: () => {
        throw new Error("ta.macd called outside compiled runtime");
    },
    atr: () => {
        throw new Error("ta.atr called outside compiled runtime");
    },
    crossover: () => {
        throw new Error("ta.crossover called outside compiled runtime");
    },
    crossunder: () => {
        throw new Error("ta.crossunder called outside compiled runtime");
    },
    nz: () => {
        throw new Error("ta.nz called outside compiled runtime");
    },
    highest: () => {
        throw new Error("ta.highest called outside compiled runtime");
    },
    lowest: () => {
        throw new Error("ta.lowest called outside compiled runtime");
    },
    highestbars: () => {
        throw new Error("ta.highestbars called outside compiled runtime");
    },
    lowestbars: () => {
        throw new Error("ta.lowestbars called outside compiled runtime");
    },
    change: () => {
        throw new Error("ta.change called outside compiled runtime");
    },
    valuewhen: () => {
        throw new Error("ta.valuewhen called outside compiled runtime");
    },
    barssince: () => {
        throw new Error("ta.barssince called outside compiled runtime");
    },
    wma: () => {
        throw new Error("ta.wma called outside compiled runtime");
    },
    vwma: () => {
        throw new Error("ta.vwma called outside compiled runtime");
    },
    hma: () => {
        throw new Error("ta.hma called outside compiled runtime");
    },
    smma: () => {
        throw new Error("ta.smma called outside compiled runtime");
    },
    dema: () => {
        throw new Error("ta.dema called outside compiled runtime");
    },
    tema: () => {
        throw new Error("ta.tema called outside compiled runtime");
    },
    kama: () => {
        throw new Error("ta.kama called outside compiled runtime");
    },
    alma: () => {
        throw new Error("ta.alma called outside compiled runtime");
    },
    lsma: () => {
        throw new Error("ta.lsma called outside compiled runtime");
    },
    mcginley: () => {
        throw new Error("ta.mcginley called outside compiled runtime");
    },
    maRibbon: () => {
        throw new Error("ta.maRibbon called outside compiled runtime");
    },
    cci: () => {
        throw new Error("ta.cci called outside compiled runtime");
    },
    stoch: () => {
        throw new Error("ta.stoch called outside compiled runtime");
    },
    williamsR: () => {
        throw new Error("ta.williamsR called outside compiled runtime");
    },
    stochRsi: () => {
        throw new Error("ta.stochRsi called outside compiled runtime");
    },
    ultimateOsc: () => {
        throw new Error("ta.ultimateOsc called outside compiled runtime");
    },
    coppock: () => {
        throw new Error("ta.coppock called outside compiled runtime");
    },
    ppo: () => {
        throw new Error("ta.ppo called outside compiled runtime");
    },
    dpo: () => {
        throw new Error("ta.dpo called outside compiled runtime");
    },
    connorsRsi: () => {
        throw new Error("ta.connorsRsi called outside compiled runtime");
    },
    kst: () => {
        throw new Error("ta.kst called outside compiled runtime");
    },
    fisher: () => {
        throw new Error("ta.fisher called outside compiled runtime");
    },
    klinger: () => {
        throw new Error("ta.klinger called outside compiled runtime");
    },
    rvgi: () => {
        throw new Error("ta.rvgi called outside compiled runtime");
    },
    ao: () => {
        throw new Error("ta.ao called outside compiled runtime");
    },
    cmo: () => {
        throw new Error("ta.cmo called outside compiled runtime");
    },
    momentum: () => {
        throw new Error("ta.momentum called outside compiled runtime");
    },
    roc: () => {
        throw new Error("ta.roc called outside compiled runtime");
    },
    pmo: () => {
        throw new Error("ta.pmo called outside compiled runtime");
    },
    smi: () => {
        throw new Error("ta.smi called outside compiled runtime");
    },
    tsi: () => {
        throw new Error("ta.tsi called outside compiled runtime");
    },
    aroon: () => {
        throw new Error("ta.aroon called outside compiled runtime");
    },
    aroonOsc: () => {
        throw new Error("ta.aroonOsc called outside compiled runtime");
    },
    median: () => {
        throw new Error("ta.median called outside compiled runtime");
    },
    adr: () => {
        throw new Error("ta.adr called outside compiled runtime");
    },
    ulcerIndex: () => {
        throw new Error("ta.ulcerIndex called outside compiled runtime");
    },
    vol: () => {
        throw new Error("ta.vol called outside compiled runtime");
    },
    vwap: () => {
        throw new Error("ta.vwap called outside compiled runtime");
    },
    anchoredVwap: () => {
        throw new Error("ta.anchoredVwap called outside compiled runtime");
    },
    anchoredVolumeProfile: () => {
        throw new Error("ta.anchoredVolumeProfile called outside compiled runtime");
    },
    fixedRangeVolumeProfile: () => {
        throw new Error("ta.fixedRangeVolumeProfile called outside compiled runtime");
    },
    sessionVolumeProfile: () => {
        throw new Error("ta.sessionVolumeProfile called outside compiled runtime");
    },
    visibleRangeVolumeProfile: () => {
        throw new Error("ta.visibleRangeVolumeProfile called outside compiled runtime");
    },
    obv: () => {
        throw new Error("ta.obv called outside compiled runtime");
    },
    adl: () => {
        throw new Error("ta.adl called outside compiled runtime");
    },
    bop: () => {
        throw new Error("ta.bop called outside compiled runtime");
    },
    cmf: () => {
        throw new Error("ta.cmf called outside compiled runtime");
    },
    chaikinOsc: () => {
        throw new Error("ta.chaikinOsc called outside compiled runtime");
    },
    mfi: () => {
        throw new Error("ta.mfi called outside compiled runtime");
    },
    netVolume: () => {
        throw new Error("ta.netVolume called outside compiled runtime");
    },
    pvo: () => {
        throw new Error("ta.pvo called outside compiled runtime");
    },
    pvt: () => {
        throw new Error("ta.pvt called outside compiled runtime");
    },
    eom: () => {
        throw new Error("ta.eom called outside compiled runtime");
    },
    nvi: () => {
        throw new Error("ta.nvi called outside compiled runtime");
    },
    pvi: () => {
        throw new Error("ta.pvi called outside compiled runtime");
    },
    bbPercentB: () => {
        throw new Error("ta.bbPercentB called outside compiled runtime");
    },
    bbw: () => {
        throw new Error("ta.bbw called outside compiled runtime");
    },
    donchian: () => {
        throw new Error("ta.donchian called outside compiled runtime");
    },
    keltner: () => {
        throw new Error("ta.keltner called outside compiled runtime");
    },
    envelope: () => {
        throw new Error("ta.envelope called outside compiled runtime");
    },
    chop: () => {
        throw new Error("ta.chop called outside compiled runtime");
    },
    historicalVolatility: () => {
        throw new Error("ta.historicalVolatility called outside compiled runtime");
    },
    rvi: () => {
        throw new Error("ta.rvi called outside compiled runtime");
    },
    massIndex: () => {
        throw new Error("ta.massIndex called outside compiled runtime");
    },
    psar: () => {
        throw new Error("ta.psar called outside compiled runtime");
    },
    supertrend: () => {
        throw new Error("ta.supertrend called outside compiled runtime");
    },
    chandelier: () => {
        throw new Error("ta.chandelier called outside compiled runtime");
    },
    chandeKrollStop: () => {
        throw new Error("ta.chandeKrollStop called outside compiled runtime");
    },
    williamsFractal: () => {
        throw new Error("ta.williamsFractal called outside compiled runtime");
    },
    zigZag: () => {
        throw new Error("ta.zigZag called outside compiled runtime");
    },
    pivotsHighLow: () => {
        throw new Error("ta.pivotsHighLow called outside compiled runtime");
    },
    pivotsStandard: () => {
        throw new Error("ta.pivotsStandard called outside compiled runtime");
    },
    volatilityStop: () => {
        throw new Error("ta.volatilityStop called outside compiled runtime");
    },
    adx: () => {
        throw new Error("ta.adx called outside compiled runtime");
    },
    dmi: () => {
        throw new Error("ta.dmi called outside compiled runtime");
    },
    trix: () => {
        throw new Error("ta.trix called outside compiled runtime");
    },
    vortex: () => {
        throw new Error("ta.vortex called outside compiled runtime");
    },
    trendStrengthIndex: () => {
        throw new Error("ta.trendStrengthIndex called outside compiled runtime");
    },
    ichimoku: () => {
        throw new Error("ta.ichimoku called outside compiled runtime");
    },
});
