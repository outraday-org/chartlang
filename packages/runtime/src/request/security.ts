// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { SecurityBar, Series } from "@invinite-org/chartlang-core";

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

function alignmentKey(slotId: string, interval: string, sourceKey: NumericSourceKey): string {
    return `${slotId}|${interval}|${sourceKey}`;
}

function alignedSeries(
    ctx: RuntimeContext,
    slotId: string,
    interval: string,
    sourceKey: NumericSourceKey,
    secondary: StreamState,
): ReadonlyArray<number> {
    const key = alignmentKey(slotId, interval, sourceKey);
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
    interval: string,
    sourceKey: NumericSourceKey,
    secondary: StreamState,
): Series<number> {
    return makeAlignedSeriesProxy(ctx, () =>
        alignedSeries(ctx, slotId, interval, sourceKey, secondary),
    );
}

function makeLiveSecurityBar(
    ctx: RuntimeContext,
    slotId: string,
    interval: string,
    secondary: StreamState,
): SecurityBar {
    const numeric = new Map<NumericSourceKey, Series<number>>();
    for (const key of NUMERIC_SOURCE_KEYS) {
        numeric.set(key, makeAlignedNumberSeries(ctx, slotId, interval, key, secondary));
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

function fallbackNaN(
    ctx: RuntimeContext,
    cacheKey: string,
    slotId: string,
    interval: string,
    code: "unsupported-interval" | "multi-timeframe-not-supported" | "unknown-secondary-stream",
    message: string,
): SecurityBar {
    pushOnce(ctx, code, slotId, interval, "security", message);
    const bar = makeNanSecurityBar();
    ctx.requestSecurityBars.set(cacheKey, bar);
    return bar;
}

/**
 * Return the runtime `request.security` bar for a callsite and interval.
 *
 * @since 0.5
 * @stable
 * @example
 *     // const bar = makeSecurityBar(ctx, "slot#0", "1D");
 *     const requested = "1D";
 *     void requested;
 */
export function makeSecurityBar(
    ctx: RuntimeContext,
    slotId: string,
    interval: string,
): SecurityBar {
    const cacheKey = `${slotId}|${interval}`;
    const existing = ctx.requestSecurityBars.get(cacheKey);
    if (existing !== undefined) return existing;

    if (!ctx.capabilities.multiTimeframe) {
        return fallbackNaN(
            ctx,
            cacheKey,
            slotId,
            interval,
            "multi-timeframe-not-supported",
            "Adapter declares multiTimeframe: false; request.security returns NaN",
        );
    }

    const known = ctx.capabilities.intervals.some((descriptor) => descriptor.value === interval);
    if (!known) {
        return fallbackNaN(
            ctx,
            cacheKey,
            slotId,
            interval,
            "unsupported-interval",
            `Requested interval "${interval}" is not in Capabilities.intervals`,
        );
    }

    const secondary = ctx.secondaryStreams.get(interval);
    if (secondary === undefined) {
        return fallbackNaN(
            ctx,
            cacheKey,
            slotId,
            interval,
            "unknown-secondary-stream",
            `Requested interval "${interval}" has no registered secondary stream`,
        );
    }

    const bar = makeLiveSecurityBar(ctx, slotId, interval, secondary);
    ctx.requestSecurityBars.set(cacheKey, bar);
    return bar;
}

function makeNanNumberSeries(): Series<number> {
    return makeSeries(Number.NaN);
}

function resolveSecondaryOrDiagnose(
    ctx: RuntimeContext,
    slotId: string,
    interval: string,
): StreamState | undefined {
    if (!ctx.capabilities.multiTimeframe) {
        pushOnce(
            ctx,
            "multi-timeframe-not-supported",
            slotId,
            interval,
            "security",
            "Adapter declares multiTimeframe: false; request.security returns NaN",
        );
        return undefined;
    }
    if (!ctx.capabilities.intervals.some((descriptor) => descriptor.value === interval)) {
        pushOnce(
            ctx,
            "unsupported-interval",
            slotId,
            interval,
            "security",
            `Requested interval "${interval}" is not in Capabilities.intervals`,
        );
        return undefined;
    }
    const secondary = ctx.secondaryStreams.get(interval);
    if (secondary === undefined) {
        pushOnce(
            ctx,
            "unknown-secondary-stream",
            slotId,
            interval,
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
 * `slotId|interval` for the bar.
 *
 * @since 0.7
 * @stable
 * @example
 *     // const trend = makeSecurityExprSeries(ctx, runner, "1W");
 *     const requested = "1W";
 *     void requested;
 */
export function makeSecurityExprSeries(
    ctx: RuntimeContext,
    runner: SecurityExprRunner,
    interval: string,
): Series<number> {
    const cacheKey = `${runner.slotId}|${interval}`;
    const cache = ctx.requestSecurityExprSeries;
    const existing = cache?.get(cacheKey);
    if (existing !== undefined) return existing;

    const secondary = resolveSecondaryOrDiagnose(ctx, runner.slotId, interval);
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
