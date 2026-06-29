// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { SecurityBar, Series } from "@invinite-org/chartlang-core";
import { feedKey } from "@invinite-org/chartlang-core";

import type { RuntimeContext } from "../runtimeContext.js";
import type { StreamState } from "../streamState.js";
import { getOrAlign } from "./alignHtfSeriesCache.js";
import { pushOnce } from "./pushOnce.js";
import { type SecurityExprRunner, ascendingValues } from "./securityExprRunner.js";
import { ascendingBarsFor, makeConstantStringSeries } from "./streamBars.js";

type NumericSourceKey =
    | "time"
    | "open"
    | "high"
    | "low"
    | "close"
    | "volume"
    | "hl2"
    | "hlc3"
    | "ohlc4"
    | "hlcc4";

const NUMERIC_SOURCE_KEYS: ReadonlyArray<NumericSourceKey> = Object.freeze([
    "time",
    "open",
    "high",
    "low",
    "close",
    "volume",
    "hl2",
    "hlc3",
    "ohlc4",
    "hlcc4",
]);

function makeSeries<T>(current: T): Series<T> {
    return Object.freeze({ current, length: 0 }) as Series<T>;
}

/**
 * Build the all-NaN `SecurityBar` fallback for unsupported MTF paths.
 *
 * @since 0.4
 * @stable
 * @example
 *     const bar = makeNanSecurityBar();
 *     const close = bar.close.current;
 *     void close;
 */
export function makeNanSecurityBar(): SecurityBar {
    const nanNumberSeries = makeSeries(Number.NaN);
    const nanStringSeries = makeSeries("");
    return Object.freeze({
        time: nanNumberSeries,
        open: nanNumberSeries,
        high: nanNumberSeries,
        low: nanNumberSeries,
        close: nanNumberSeries,
        volume: nanNumberSeries,
        hl2: nanNumberSeries,
        hlc3: nanNumberSeries,
        ohlc4: nanNumberSeries,
        hlcc4: nanNumberSeries,
        symbol: nanStringSeries,
        interval: nanStringSeries,
    });
}

function seriesAscending(stream: StreamState, sourceKey: NumericSourceKey): ReadonlyArray<number> {
    const values: number[] = [];
    const source = stream.ohlcv[sourceKey];
    for (let age = source.length - 1; age >= 0; age -= 1) {
        values.push(source.at(age));
    }
    return values;
}

function alignmentKey(slotId: string, feed: string, sourceKey: NumericSourceKey): string {
    return `${slotId}|${feed}|${sourceKey}`;
}

function alignedSeries(
    ctx: RuntimeContext,
    slotId: string,
    feed: string,
    sourceKey: NumericSourceKey,
    secondary: StreamState,
): ReadonlyArray<number> {
    const key = alignmentKey(slotId, feed, sourceKey);
    const existing = ctx.requestSecurityAlignments.get(key);
    if (existing !== undefined) return existing;
    const htfBars = ascendingBarsFor(ctx, secondary);
    const ltfBars = ascendingBarsFor(ctx, ctx.stream);
    const aligned = getOrAlign(htfBars, seriesAscending(secondary, sourceKey), ltfBars);
    ctx.requestSecurityAlignments.set(key, aligned);
    return aligned;
}

/**
 * Wrap a producer of the latest main-aligned array in the head-relative
 * `Series<number>` Proxy shape. `current` / `[n]` re-run `produce` (cheap —
 * `getOrAlign` memoises per bar) and read from the tail; `length` is the main
 * stream's bar count. Shared by the OHLCV `SecurityBar` fields and the
 * expression-output series so both walk the identical no-lookahead alignment.
 */
function makeAlignedSeriesProxy(
    ctx: RuntimeContext,
    produce: () => ReadonlyArray<number>,
): Series<number> {
    const target = {
        get current() {
            const aligned = produce();
            const value = aligned[aligned.length - 1];
            return value === undefined ? Number.NaN : value;
        },
        get length() {
            return ctx.stream.ohlcv.close.length;
        },
    };
    return new Proxy(Object.freeze(target), {
        get(obj, prop, receiver) {
            if (typeof prop === "string") {
                const n = Number(prop);
                if (Number.isInteger(n) && n >= 0) {
                    const aligned = produce();
                    const value = aligned[aligned.length - 1 - n];
                    return value === undefined ? Number.NaN : value;
                }
            }
            return Reflect.get(obj, prop, receiver);
        },
    }) as Series<number>;
}

function makeAlignedNumberSeries(
    ctx: RuntimeContext,
    slotId: string,
    feed: string,
    sourceKey: NumericSourceKey,
    secondary: StreamState,
): Series<number> {
    return makeAlignedSeriesProxy(ctx, () =>
        alignedSeries(ctx, slotId, feed, sourceKey, secondary),
    );
}

function makeLiveSecurityBar(
    ctx: RuntimeContext,
    slotId: string,
    feed: string,
    interval: string,
    secondary: StreamState,
): SecurityBar {
    const numeric = new Map<NumericSourceKey, Series<number>>();
    for (const key of NUMERIC_SOURCE_KEYS) {
        numeric.set(key, makeAlignedNumberSeries(ctx, slotId, feed, key, secondary));
    }
    return Object.freeze({
        time: numeric.get("time") ?? makeSeries(Number.NaN),
        open: numeric.get("open") ?? makeSeries(Number.NaN),
        high: numeric.get("high") ?? makeSeries(Number.NaN),
        low: numeric.get("low") ?? makeSeries(Number.NaN),
        close: numeric.get("close") ?? makeSeries(Number.NaN),
        volume: numeric.get("volume") ?? makeSeries(Number.NaN),
        hl2: numeric.get("hl2") ?? makeSeries(Number.NaN),
        hlc3: numeric.get("hlc3") ?? makeSeries(Number.NaN),
        ohlc4: numeric.get("ohlc4") ?? makeSeries(Number.NaN),
        hlcc4: numeric.get("hlcc4") ?? makeSeries(Number.NaN),
        symbol: makeConstantStringSeries(secondary.bar.symbol),
        interval: makeConstantStringSeries(interval),
    });
}

/**
 * Build a {@link SecurityBar} view over the MAIN stream's own series for Pine's
 * empty-interval idiom (`request.security(syminfo.tickerid, "", x)` = "the
 * chart's own timeframe"). The chart symbol on the chart clock IS the main
 * stream, so this reuses the stream's existing O(1) head-relative
 * `seriesViews.*` (NO ascending-array rebuild) and pins the constant
 * symbol / interval from the live `bar`. The read is therefore the identity it
 * is in Pine / on TradingView — no secondary feed, no adapter capability.
 *
 * @since 1.6
 * @stable
 * @example
 *     // const bar = makeMainPassthroughSecurityBar(ctx);
 *     const idiom = "chart timeframe";
 *     void idiom;
 */
function makeMainPassthroughSecurityBar(ctx: RuntimeContext): SecurityBar {
    const v = ctx.stream.seriesViews;
    return Object.freeze({
        time: v.time,
        open: v.open,
        high: v.high,
        low: v.low,
        close: v.close,
        volume: v.volume,
        hl2: v.hl2,
        hlc3: v.hlc3,
        ohlc4: v.ohlc4,
        hlcc4: v.hlcc4,
        symbol: makeConstantStringSeries(ctx.stream.bar.symbol),
        interval: makeConstantStringSeries(ctx.stream.bar.interval),
    });
}

// The adapter does not advertise `multiSymbol`, so a `request.security` for a
// symbol other than the chart's own degrades to all-NaN — mirroring the
// `multiTimeframe` fallback message exactly, only naming the symbol gate.
const MULTI_SYMBOL_MSG =
    "Adapter declares multiSymbol: false; request.security for a different symbol returns NaN";

function fallbackNaN(
    ctx: RuntimeContext,
    cacheKey: string,
    slotId: string,
    feed: string,
    code:
        | "unsupported-interval"
        | "multi-timeframe-not-supported"
        | "multi-symbol-not-supported"
        | "unknown-secondary-stream",
    message: string,
): SecurityBar {
    pushOnce(ctx, code, slotId, feed, "security", message);
    const bar = makeNanSecurityBar();
    ctx.requestSecurityBars.set(cacheKey, bar);
    return bar;
}

/**
 * Return the runtime `request.security` bar for a callsite and `(symbol,
 * interval)` feed. `symbol` is already chart-symbol resolved + collapsed by the
 * caller (`undefined` ⇒ the chart's own symbol), so the composite
 * {@link feedKey} collapses to the bare interval for the chart-symbol path —
 * keeping the cache key, secondary-stream lookup, and diagnostics
 * byte-identical to the pre-multi-symbol baseline.
 *
 * A non-`undefined` `symbol` is therefore always a DIFFERENT symbol: the gate
 * order is symbol (`multiSymbol`) → timeframe (`multiTimeframe`) →
 * `unsupported-interval` → `unknown-secondary-stream`, so a request that is
 * both a different symbol AND a different interval against `multiSymbol: false`
 * trips `multi-symbol-not-supported` first (one diagnostic, not both).
 *
 * @since 0.5
 * @stable
 * @example
 *     // const bar = makeSecurityBar(ctx, "slot#0", undefined, "1D");
 *     const requested = "1D";
 *     void requested;
 */
export function makeSecurityBar(
    ctx: RuntimeContext,
    slotId: string,
    symbol: string | undefined,
    interval: string,
): SecurityBar {
    const feed = feedKey(symbol, interval);
    const cacheKey = `${slotId}|${feed}`;
    const existing = ctx.requestSecurityBars.get(cacheKey);
    if (existing !== undefined) return existing;

    // Pine's empty-interval idiom: `request.security(syminfo.tickerid, "", x)` is
    // "the chart's own timeframe" — the chart symbol on the chart clock IS the main
    // stream, no secondary feed and no adapter capability required (core request.ts
    // §"empty interval"). Resolve it to a SecurityBar view over the main stream's
    // own series so the read is the identity it is in Pine / on TradingView. A
    // DIFFERENT symbol at the empty interval is "that instrument on the chart clock"
    // and stays on the multiSymbol secondary path below.
    if (symbol === undefined && interval === "") {
        const bar = makeMainPassthroughSecurityBar(ctx);
        ctx.requestSecurityBars.set(cacheKey, bar);
        return bar;
    }

    // Symbol gate precedes the timeframe gate: a different symbol is a strictly
    // larger ask than a higher timeframe of the chart's own symbol.
    if (symbol !== undefined && !ctx.capabilities.multiSymbol) {
        return fallbackNaN(
            ctx,
            cacheKey,
            slotId,
            feed,
            "multi-symbol-not-supported",
            MULTI_SYMBOL_MSG,
        );
    }

    if (!ctx.capabilities.multiTimeframe) {
        return fallbackNaN(
            ctx,
            cacheKey,
            slotId,
            feed,
            "multi-timeframe-not-supported",
            "Adapter declares multiTimeframe: false; request.security returns NaN",
        );
    }

    // `""` is Pine's "chart's own timeframe" sentinel — never a literal interval
    // an adapter lists, so validating it against `capabilities.intervals` is
    // wrong. For the CHART symbol + `""` the passthrough above already ran; a
    // DIFFERENT symbol + `""` ("that instrument on the chart clock") flows past
    // this gate and is gated only by the secondary-stream lookup below
    // (`unknown-secondary-stream` when none is registered, not the misleading
    // `unsupported-interval`).
    const known =
        interval === "" ||
        ctx.capabilities.intervals.some((descriptor) => descriptor.value === interval);
    if (!known) {
        return fallbackNaN(
            ctx,
            cacheKey,
            slotId,
            feed,
            "unsupported-interval",
            `Requested interval "${interval}" is not in Capabilities.intervals`,
        );
    }

    const secondary = ctx.secondaryStreams.get(feed);
    if (secondary === undefined) {
        return fallbackNaN(
            ctx,
            cacheKey,
            slotId,
            feed,
            "unknown-secondary-stream",
            `Requested interval "${interval}" has no registered secondary stream`,
        );
    }

    const bar = makeLiveSecurityBar(ctx, slotId, feed, interval, secondary);
    ctx.requestSecurityBars.set(cacheKey, bar);
    return bar;
}

function makeNanNumberSeries(): Series<number> {
    return makeSeries(Number.NaN);
}

function resolveSecondaryOrDiagnose(
    ctx: RuntimeContext,
    slotId: string,
    feed: string,
    interval: string,
): StreamState | undefined {
    if (!ctx.capabilities.multiTimeframe) {
        pushOnce(
            ctx,
            "multi-timeframe-not-supported",
            slotId,
            feed,
            "security",
            "Adapter declares multiTimeframe: false; request.security returns NaN",
        );
        return undefined;
    }
    // `""` is the chart-timeframe sentinel (see `makeSecurityBar`) — always a
    // valid interval, never validated against `capabilities.intervals`.
    if (
        interval !== "" &&
        !ctx.capabilities.intervals.some((descriptor) => descriptor.value === interval)
    ) {
        pushOnce(
            ctx,
            "unsupported-interval",
            slotId,
            feed,
            "security",
            `Requested interval "${interval}" is not in Capabilities.intervals`,
        );
        return undefined;
    }
    const secondary = ctx.secondaryStreams.get(feed);
    if (secondary === undefined) {
        pushOnce(
            ctx,
            "unknown-secondary-stream",
            slotId,
            feed,
            "security",
            `Requested interval "${interval}" has no registered secondary stream`,
        );
    }
    return secondary;
}

/**
 * Return the main-aligned output series for an HTF expression callsite. The
 * runner's `output` buffer holds one sampled value per HTF bar; this aligns it
 * no-lookahead to the main timeline against the real secondary stream's
 * timestamps (so `output[i]` pairs with secondary ascending bar `i`). Reuses
 * the OHLCV alignment kernel via {@link getOrAlign}. Capability / interval /
 * stream fallbacks return an all-NaN series and push a deduped diagnostic,
 * matching {@link makeSecurityBar}. The returned Proxy identity is cached per
 * `slotId|feedKey` for the bar. `feed` is the composite key the caller built
 * from the resolved `(symbol, interval)`; `runner.interval` is the bare
 * interval used for the capability check and diagnostic text.
 *
 * `isDifferentSymbol` (`true` when the resolved symbol differs from the chart
 * symbol) gates the all-NaN `multi-symbol-not-supported` fallback BEFORE the
 * timeframe gate, mirroring {@link makeSecurityBar}'s order exactly.
 *
 * @since 0.7
 * @stable
 * @example
 *     // const trend = makeSecurityExprSeries(ctx, runner, "1W", false);
 *     const requested = "1W";
 *     void requested;
 */
export function makeSecurityExprSeries(
    ctx: RuntimeContext,
    runner: SecurityExprRunner,
    feed: string,
    isDifferentSymbol: boolean,
): Series<number> {
    const cacheKey = `${runner.slotId}|${feed}`;
    const cache = ctx.requestSecurityExprSeries;
    const existing = cache?.get(cacheKey);
    if (existing !== undefined) return existing;

    // Symbol gate precedes the timeframe gate, matching `makeSecurityBar`.
    if (isDifferentSymbol && !ctx.capabilities.multiSymbol) {
        pushOnce(
            ctx,
            "multi-symbol-not-supported",
            runner.slotId,
            feed,
            "security",
            MULTI_SYMBOL_MSG,
        );
        const nan = makeNanNumberSeries();
        cache?.set(cacheKey, nan);
        return nan;
    }

    const secondary = resolveSecondaryOrDiagnose(ctx, runner.slotId, feed, runner.interval);
    const series =
        secondary === undefined
            ? makeNanNumberSeries()
            : makeAlignedSeriesProxy(ctx, () =>
                  getOrAlign(
                      ascendingBarsFor(ctx, secondary),
                      ascendingValues(runner.output),
                      ascendingBarsFor(ctx, ctx.stream),
                  ),
              );
    cache?.set(cacheKey, series);
    return series;
}
