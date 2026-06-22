// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar, Series } from "@invinite-org/chartlang-core";

import type { RuntimeContext } from "../runtimeContext.js";
import { getOrBucket } from "./bucketLtfBarsCache.js";
import { pushOnce } from "./pushOnce.js";
import { ascendingBarsFor } from "./streamBars.js";

const EMPTY_BUCKET: ReadonlyArray<Bar> = Object.freeze([]);

function fallback(
    ctx: RuntimeContext,
    slotId: string,
    interval: string,
    code: "unsupported-interval" | "multi-timeframe-not-supported" | "unknown-secondary-stream",
    message: string,
): ReadonlyArray<Bar> {
    pushOnce(ctx, code, slotId, interval, "lowerTf", message);
    return EMPTY_BUCKET;
}

function bucketAt(
    ctx: RuntimeContext,
    slotId: string,
    interval: string,
    age: number,
): ReadonlyArray<Bar> {
    if (!ctx.capabilities.multiTimeframe) {
        return fallback(
            ctx,
            slotId,
            interval,
            "multi-timeframe-not-supported",
            "Adapter declares multiTimeframe: false; request.lowerTf returns empty buckets",
        );
    }

    const known = ctx.capabilities.intervals.some((descriptor) => descriptor.value === interval);
    if (!known) {
        return fallback(
            ctx,
            slotId,
            interval,
            "unsupported-interval",
            `Requested interval "${interval}" is not in Capabilities.intervals`,
        );
    }

    // `request.lowerTf` is chart-symbol-only (per-feed symbol is a deferred
    // follow-up), so the bare interval IS the feed key — `feedKey(undefined,
    // interval) === interval`. Keying the (feed-keyed) `secondaryStreams` map
    // and the cache below by the bare interval is therefore byte-identical to
    // routing through `feedKey`; if `lowerTf` ever gains a symbol, switch both
    // sites to `feedKey(symbol, interval)` so they cannot silently mis-key.
    const secondary = ctx.secondaryStreams.get(interval);
    if (secondary === undefined) {
        return fallback(
            ctx,
            slotId,
            interval,
            "unknown-secondary-stream",
            `Requested interval "${interval}" has no registered secondary stream`,
        );
    }

    const mainBars = ascendingBarsFor(ctx, ctx.stream);
    const ltfBars = ascendingBarsFor(ctx, secondary);
    const buckets = getOrBucket(mainBars, ltfBars);
    const index = buckets.length - 1 - age;
    return buckets[index] ?? EMPTY_BUCKET;
}

/**
 * Return a stable series view of lower-timeframe buckets for a callsite.
 *
 * @since 0.6
 * @stable
 * @example
 *     // const series = makeLowerTfSeries(ctx, "slot#0", "30s");
 *     const requested = "30s";
 *     void requested;
 */
export function makeLowerTfSeries(
    ctx: RuntimeContext,
    slotId: string,
    interval: string,
): Series<ReadonlyArray<Bar>> {
    const cacheKey = `${slotId}|${interval}`;
    const existing = ctx.requestLowerTfViews.get(cacheKey);
    if (existing !== undefined) return existing;

    const target = {
        get current() {
            return bucketAt(ctx, slotId, interval, 0);
        },
        get length() {
            return ctx.stream.ohlcv.close.length;
        },
    };
    const view = new Proxy(Object.freeze(target), {
        get(obj, prop, receiver) {
            if (typeof prop === "string") {
                const n = Number(prop);
                if (Number.isInteger(n) && n >= 0) return bucketAt(ctx, slotId, interval, n);
            }
            return Reflect.get(obj, prop, receiver);
        },
    }) as Series<ReadonlyArray<Bar>>;
    ctx.requestLowerTfViews.set(cacheKey, view);
    return view;
}
