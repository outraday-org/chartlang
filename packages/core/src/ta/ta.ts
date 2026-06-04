// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Series } from "../types";

/**
 * Options bag for `ta.sma`. Phase 1 ships no flags; the type exists so the
 * Phase-2 ports can extend it without breaking call sites.
 *
 * @formula  N/A — placeholder
 * @since 0.1
 * @experimental
 * @example
 *     const opts: SmaOpts = {};
 */
export type SmaOpts = Readonly<Record<string, never>>;

/**
 * Options bag for `ta.ema`. Empty in Phase 1.
 *
 * @formula  N/A — placeholder
 * @since 0.1
 * @experimental
 * @example
 *     const opts: EmaOpts = {};
 */
export type EmaOpts = Readonly<Record<string, never>>;

/**
 * Options bag for `ta.stdev`. `biased` toggles between population (default)
 * and sample standard deviation.
 *
 * @formula  σ_biased = sqrt(Σ(x_i − μ)² / N); σ_sample = sqrt(Σ / (N − 1))
 * @since 0.1
 * @experimental
 * @example
 *     const opts: StdevOpts = { biased: false };
 */
export type StdevOpts = Readonly<{ biased?: boolean }>;

/**
 * Options bag for `ta.bb`. `multiplier` defaults to `2` and scales the upper /
 * lower bands away from the middle.
 *
 * @formula  upper = sma + multiplier * stdev, lower = sma − multiplier * stdev
 * @since 0.1
 * @experimental
 * @example
 *     const opts: BbOpts = { multiplier: 2 };
 */
export type BbOpts = Readonly<{ multiplier?: number }>;

/**
 * Options bag for `ta.rsi`. Empty in Phase 1.
 *
 * @formula  N/A — placeholder
 * @since 0.1
 * @experimental
 * @example
 *     const opts: RsiOpts = {};
 */
export type RsiOpts = Readonly<Record<string, never>>;

/**
 * Options bag for `ta.macd`. Fast / slow / signal lengths default to the
 * Appel-era 12 / 26 / 9 when omitted.
 *
 * @formula  N/A — see `ta.macd` JSDoc
 * @since 0.1
 * @experimental
 * @example
 *     const opts: MacdOpts = { fastLength: 12, slowLength: 26, signalLength: 9 };
 */
export type MacdOpts = Readonly<{
    fastLength?: number;
    slowLength?: number;
    signalLength?: number;
}>;

/**
 * Options bag for `ta.atr`. Empty in Phase 1.
 *
 * @formula  N/A — placeholder
 * @since 0.1
 * @experimental
 * @example
 *     const opts: AtrOpts = {};
 */
export type AtrOpts = Readonly<Record<string, never>>;

/**
 * The three-series result of `ta.bb`. Each component is a separate `Series`
 * the runtime updates in lock-step with the source.
 *
 * @formula  upper = sma + k * stdev, lower = sma − k * stdev
 * @since 0.1
 * @experimental
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
 * @experimental
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
 * @experimental
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
    crossover(a: Series<number>, b: Series<number> | number): Series<boolean>;
    crossunder(a: Series<number>, b: Series<number> | number): Series<boolean>;
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
 * @experimental
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
});
