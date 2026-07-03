// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { PlotStyle } from "@invinite-org/chartlang-adapter-kit";
import type { Color, PlotBarOpts, PlotCandleOpts, Series } from "@invinite-org/chartlang-core";

import { ACTIVE_RUNTIME_CONTEXT, type RuntimeContext } from "../runtimeContext.js";
import { emitPlot, isNumberOrSeries, resolveValue } from "./plot.js";

const CANDLE_OUTSIDE_CTX_MESSAGE = "plotcandle called outside an active script step";
const BAR_OUTSIDE_CTX_MESSAGE = "plotbar called outside an active script step";

// The reference bull / bear body colors (the documented `candle-override`
// example values). There is no shared runtime palette constant to reuse, so
// they live here — the ONE place the candle / bar emit fills the required
// `bull` / `bear` (candle) and the resolved `color` (ohlc-bar) fields.
const DEFAULT_CANDLE_BULL: Color = "#26a69a";
const DEFAULT_CANDLE_BEAR: Color = "#ef5350";

/**
 * Resolve `plotcandle`'s four OHLC sources to per-bar scalars, build the
 * value-carrying `candle` {@link PlotStyle} (the OHLC quad + body colors live
 * INSIDE the style — the `filled-band` multi-value precedent), and route
 * through the shared {@link emitPlot} gate + emission core.
 *
 * A non-finite source becomes `null`; a fully-null quad is a legit gap bar and
 * a partial (mixed finite / null) quad is dropped by `validateEmission` as a
 * `malformed-emission` — quad coherence is delegated, never re-checked here.
 * `value` is the resolved `close` (single-channel, for the conformance
 * `plot-hash`). The emit adds no tick-specific branch: tick / close
 * reconciliation is the downstream `(slotId, bar)` last-write-wins dedup.
 *
 * @since 1.8
 * @example
 *     // Internal — `plotcandle` dispatches here with the compiler slotId.
 *     // const fn: typeof plotcandleImpl = plotcandleImpl;
 *     // void fn;
 */
export function plotcandleImpl(
    ctx: RuntimeContext,
    slotId: string,
    open: number | Series<number>,
    high: number | Series<number>,
    low: number | Series<number>,
    close: number | Series<number>,
    opts: PlotCandleOpts,
): void {
    const resolvedClose = resolveValue(close);
    const style: PlotStyle = {
        kind: "candle",
        open: resolveValue(open),
        high: resolveValue(high),
        low: resolveValue(low),
        close: resolvedClose,
        bull: opts.bull ?? DEFAULT_CANDLE_BULL,
        bear: opts.bear ?? DEFAULT_CANDLE_BEAR,
        ...(opts.doji === undefined ? {} : { doji: opts.doji }),
        ...(opts.wickColor === undefined ? {} : { wickColor: opts.wickColor }),
        ...(opts.borderColor === undefined ? {} : { borderColor: opts.borderColor }),
    };
    emitPlot(ctx, slotId, style, {
        title: opts.title ?? "",
        value: resolvedClose,
        color: null,
        paneOpt: opts.pane,
        visible: opts.visible,
        xShift: 0,
        z: opts.z ?? 0,
        colorValue: undefined,
    });
}

/**
 * Resolve `plotbar`'s four OHLC sources to per-bar scalars, build the
 * value-carrying `ohlc-bar` {@link PlotStyle}, and route through the shared
 * {@link emitPlot} gate + emission core. Same quad-coherence, `value`, and
 * no-tick-branch contract as {@link plotcandleImpl}.
 *
 * The required `color` is selected by `close ≥ open`: an up bar takes
 * `upColor ?? color ?? DEFAULT_CANDLE_BULL`, a down bar
 * `downColor ?? color ?? DEFAULT_CANDLE_BEAR` (a fully-null bar counts as up —
 * colors are irrelevant on a dropped gap). `upColor` / `downColor` also ride
 * the wire when the author sets them, so a richer adapter can re-derive.
 *
 * @since 1.8
 * @example
 *     // Internal — `plotbar` dispatches here with the compiler slotId.
 *     // const fn: typeof plotbarImpl = plotbarImpl;
 *     // void fn;
 */
export function plotbarImpl(
    ctx: RuntimeContext,
    slotId: string,
    open: number | Series<number>,
    high: number | Series<number>,
    low: number | Series<number>,
    close: number | Series<number>,
    opts: PlotBarOpts,
): void {
    const resolvedOpen = resolveValue(open);
    const resolvedClose = resolveValue(close);
    const up = resolvedClose === null || resolvedOpen === null || resolvedClose >= resolvedOpen;
    const color = up
        ? (opts.upColor ?? opts.color ?? DEFAULT_CANDLE_BULL)
        : (opts.downColor ?? opts.color ?? DEFAULT_CANDLE_BEAR);
    const style: PlotStyle = {
        kind: "ohlc-bar",
        open: resolvedOpen,
        high: resolveValue(high),
        low: resolveValue(low),
        close: resolvedClose,
        color,
        ...(opts.upColor === undefined ? {} : { upColor: opts.upColor }),
        ...(opts.downColor === undefined ? {} : { downColor: opts.downColor }),
    };
    emitPlot(ctx, slotId, style, {
        title: opts.title ?? "",
        value: resolvedClose,
        color: null,
        paneOpt: opts.pane,
        visible: opts.visible,
        xShift: 0,
        z: opts.z ?? 0,
        colorValue: undefined,
    });
}

/**
 * Plot a **derived** candle series for the current bar — Pine's `plotcandle`
 * (script-facing overload). Unlike the color-only `candle-override` style
 * (which recolors the primary chart candles), this renders its own OHLC quad
 * (Heikin-Ashi, smoothed candles, a secondary-symbol / HTF overlay).
 *
 * Same dual-signature contract as `plot`: scripts call `plotcandle(open, high,
 * low, close, opts?)`; the compiler's callsite-id transformer rewrites every
 * call to `plotcandle(slotId, open, high, low, close, opts?)` (the sibling
 * overload). Direct invocation without a slot id throws the sentinel error.
 * Adapters that do not declare the `candle` capability drop it with
 * `unsupported-plot-kind`.
 *
 * @since 1.8
 * @example
 *     import { defineIndicator, plotcandle } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "Heikin-Ashi",
 *         apiVersion: 1,
 *         compute({ bar }) {
 *             plotcandle(bar.open, bar.high, bar.low, bar.close, { bull: "#26a69a" });
 *         },
 *     });
 */
export function plotcandle(
    open: number | Series<number>,
    high: number | Series<number>,
    low: number | Series<number>,
    close: number | Series<number>,
    opts?: PlotCandleOpts,
): void;
/**
 * Plot a derived candle series for the current bar (compiler-injected
 * overload). The callsite-id transformer rewrites script-side `plotcandle(open,
 * high, low, close, opts?)` into `plotcandle(slotId, open, high, low, close,
 * opts?)`.
 *
 * @since 1.8
 * @example
 *     // Internal — the compiler rewrites every script callsite, e.g.
 *     // `plotcandle(o,h,l,c)` becomes `plotcandle("demo.chart.ts:5:9#0", o,h,l,c)`.
 *     // const fn: typeof plotcandle = plotcandle;
 *     // void fn;
 */
export function plotcandle(
    slotId: string,
    open: number | Series<number>,
    high: number | Series<number>,
    low: number | Series<number>,
    close: number | Series<number>,
    opts?: PlotCandleOpts,
): void;
/**
 * Implementation signature for {@link plotcandle}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 1.8
 * @example
 *     // const fn: typeof plotcandle = plotcandle;
 *     // void fn;
 */
export function plotcandle(
    arg1: string | number | Series<number>,
    arg2: number | Series<number>,
    arg3: number | Series<number>,
    arg4: number | Series<number>,
    arg5?: number | Series<number> | PlotCandleOpts,
    arg6?: PlotCandleOpts,
): void {
    if (typeof arg1 !== "string" || !isNumberOrSeries(arg5)) {
        throw new Error(CANDLE_OUTSIDE_CTX_MESSAGE);
    }
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (!ctx) throw new Error(CANDLE_OUTSIDE_CTX_MESSAGE);
    plotcandleImpl(ctx, arg1, arg2, arg3, arg4, arg5, arg6 ?? {});
}

/**
 * Plot a **derived** OHLC-bar series for the current bar — Pine's `plotbar`
 * (script-facing overload). Unlike the color-only `bar-override` style (which
 * recolors the primary chart bars), this renders its own OHLC quad.
 *
 * Same dual-signature contract as `plot`: scripts call `plotbar(open, high,
 * low, close, opts?)`; the compiler rewrites every call to `plotbar(slotId,
 * open, high, low, close, opts?)` (the sibling overload). Direct invocation
 * without a slot id throws the sentinel error. Adapters that do not declare
 * the `ohlc-bar` capability drop it with `unsupported-plot-kind`.
 *
 * @since 1.8
 * @example
 *     import { defineIndicator, plotbar } from "@invinite-org/chartlang-core";
 *     export default defineIndicator({
 *         name: "Bars",
 *         apiVersion: 1,
 *         compute({ bar }) {
 *             plotbar(bar.open, bar.high, bar.low, bar.close, { color: "#f59e0b" });
 *         },
 *     });
 */
export function plotbar(
    open: number | Series<number>,
    high: number | Series<number>,
    low: number | Series<number>,
    close: number | Series<number>,
    opts?: PlotBarOpts,
): void;
/**
 * Plot a derived OHLC-bar series for the current bar (compiler-injected
 * overload). The callsite-id transformer rewrites script-side `plotbar(open,
 * high, low, close, opts?)` into `plotbar(slotId, open, high, low, close,
 * opts?)`.
 *
 * @since 1.8
 * @example
 *     // Internal — the compiler rewrites every script callsite, e.g.
 *     // `plotbar(o,h,l,c)` becomes `plotbar("demo.chart.ts:5:9#0", o,h,l,c)`.
 *     // const fn: typeof plotbar = plotbar;
 *     // void fn;
 */
export function plotbar(
    slotId: string,
    open: number | Series<number>,
    high: number | Series<number>,
    low: number | Series<number>,
    close: number | Series<number>,
    opts?: PlotBarOpts,
): void;
/**
 * Implementation signature for {@link plotbar}. Branches on
 * `typeof arg1 === "string"` to dispatch the script-facing vs
 * compiler-injected overload.
 *
 * @since 1.8
 * @example
 *     // const fn: typeof plotbar = plotbar;
 *     // void fn;
 */
export function plotbar(
    arg1: string | number | Series<number>,
    arg2: number | Series<number>,
    arg3: number | Series<number>,
    arg4: number | Series<number>,
    arg5?: number | Series<number> | PlotBarOpts,
    arg6?: PlotBarOpts,
): void {
    if (typeof arg1 !== "string" || !isNumberOrSeries(arg5)) {
        throw new Error(BAR_OUTSIDE_CTX_MESSAGE);
    }
    const ctx = ACTIVE_RUNTIME_CONTEXT.current;
    if (!ctx) throw new Error(BAR_OUTSIDE_CTX_MESSAGE);
    plotbarImpl(ctx, arg1, arg2, arg3, arg4, arg5, arg6 ?? {});
}
