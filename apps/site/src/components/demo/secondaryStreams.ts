// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";

const MS_PER_SECOND = 1_000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;
const MS_PER_WEEK = 7 * MS_PER_DAY;
// Calendar months are uneven; the demo's resampler uses a ≈30-day bucket
// for `M` so the synthetic higher-timeframe stream stays deterministic.
const MS_PER_MONTH = 30 * MS_PER_DAY;

const UNIT_MS: Readonly<Record<string, number>> = {
    s: MS_PER_SECOND,
    m: MS_PER_MINUTE,
    h: MS_PER_HOUR,
    d: MS_PER_DAY,
    w: MS_PER_WEEK,
    M: MS_PER_MONTH,
};

const INTERVAL_PATTERN = /^(\d+)([smhdwM])$/;

/**
 * Parse a chartlang interval literal (`"30s"`, `"1h"`, `"1D"`, `"1W"`,
 * `"1M"`) into a bucket size in milliseconds. Units are matched
 * case-insensitively except `M` (month) vs `m` (minute), which follow
 * the chartlang interval convention. Returns `null` for an unparseable
 * literal so the caller can skip it.
 */
function intervalToBucketMs(interval: string): number | null {
    if (interval.length === 0) return null;
    // Normalise the unit case so `D`/`W` parse the same as `d`/`w`, while
    // `m` (minute) and `M` (month) keep their author-given casing.
    const match = INTERVAL_PATTERN.exec(normaliseUnit(interval));
    if (match === null) return null;
    const count = Number.parseInt(match[1] ?? "", 10);
    const unitMs = UNIT_MS[match[2] ?? ""];
    if (!Number.isFinite(count) || count <= 0 || unitMs === undefined) return null;
    return count * unitMs;
}

/** Fold every unit to lowercase except a trailing month marker (`M`). */
function normaliseUnit(interval: string): string {
    const unit = interval[interval.length - 1] ?? "";
    const body = interval.slice(0, -1);
    if (unit === "M" || unit === "m") {
        // `M` stays month; `m` stays minute — preserve the author's casing.
        return `${body}${unit}`;
    }
    return `${body}${unit.toLowerCase()}`;
}

/** Aggregate a non-empty run of source bars into one higher-timeframe bar. */
function aggregateBucket(bars: ReadonlyArray<Bar>, interval: string): Bar {
    const first = bars[0];
    const last = bars[bars.length - 1];
    if (first === undefined || last === undefined) {
        throw new Error("aggregateBucket requires a non-empty bucket");
    }
    let high = first.high;
    let low = first.low;
    let volume = 0;
    for (const bar of bars) {
        if (bar.high > high) high = bar.high;
        if (bar.low < low) low = bar.low;
        volume += bar.volume;
    }
    const open = first.open;
    const close = last.close;
    return {
        // No-lookahead: the higher-timeframe bar is only known at its
        // close, so it is timestamped at the LAST constituent bar.
        time: last.time,
        open,
        high,
        low,
        close,
        volume,
        symbol: first.symbol,
        interval,
        hl2: (high + low) / 2,
        hlc3: (high + low + close) / 3,
        ohlc4: (open + high + low + close) / 4,
        hlcc4: (high + low + close + close) / 4,
        // Demo input bars carry no time history, so only the current bar
        // resolves; the runtime injects the real `point` on its BarView.
        point: (offset, price) => ({ time: offset === 0 ? last.time : Number.NaN, price }),
    };
}

/**
 * Resample a main bar series into each requested higher-timeframe
 * interval, keyed by the exact interval literal the manifest carries.
 *
 * The demo has no real higher-timeframe feed, so this synthesises one by
 * bucketing the main bars (`Math.floor(time / bucketMs)`) and aggregating
 * each bucket OHLCV. Intervals whose literal cannot be parsed are
 * omitted. A bucket size at or below the main bar spacing degrades to a
 * sensible 1:1 mapping rather than producing NaN.
 *
 * @since 0.5
 * @example
 *     import { buildSecondaryStreams } from "./secondaryStreams";
 *     const secondary = buildSecondaryStreams(bars, ["1W"]);
 *     // secondary["1W"] is the weekly-resampled series.
 */
export function buildSecondaryStreams(
    bars: ReadonlyArray<Bar>,
    intervals: ReadonlyArray<string>,
): Record<string, ReadonlyArray<Bar>> {
    const result: Record<string, ReadonlyArray<Bar>> = {};
    for (const interval of intervals) {
        const bucketMs = intervalToBucketMs(interval);
        if (bucketMs === null) continue;
        const buckets = new Map<number, Bar[]>();
        for (const bar of bars) {
            const key = Math.floor(bar.time / bucketMs);
            const existing = buckets.get(key);
            if (existing === undefined) {
                buckets.set(key, [bar]);
            } else {
                existing.push(bar);
            }
        }
        const aggregated = [...buckets.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([, bucketBars]) => aggregateBucket(bucketBars, interval));
        result[interval] = aggregated;
    }
    return result;
}
