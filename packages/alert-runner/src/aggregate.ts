// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { AlertRunnerError } from "./errors.js";
import { intervalMs } from "./interval.js";
import type { AlertBar } from "./types.js";

/**
 * Where the forming bar's OHLC came from, tracked as the bucket is built
 * (never inferred from the numbers, which cannot tell the cases apart):
 * `"live"` — only ticks / finer bars; `"providerSeed"` — only a provider's
 * forming candle (`seedFormingBar`); `"merged"` — both.
 *
 * @since 1.0
 * @stable
 * @example
 *     import type { AggregatedBarSource } from "@invinite-org/chartlang-alert-runner";
 *     const source: AggregatedBarSource = "merged";
 *     void source;
 */
export type AggregatedBarSource = "live" | "providerSeed" | "merged";

/**
 * Options for {@link createBarAggregator}. `bucketStart` maps a timestamp to
 * the open time of the bar containing it; the default is the wall-clock UTC
 * grid `floor(t / intervalMs) * intervalMs`, right for intraday intervals of
 * a 24h market. Supply your own (non-decreasing) function for session-aligned
 * daily bars or calendar months.
 *
 * @since 1.0
 * @stable
 * @example
 *     import type { BarAggregatorOpts } from "@invinite-org/chartlang-alert-runner";
 *     const opts: BarAggregatorOpts = { interval: "5m" };
 *     void opts;
 */
export type BarAggregatorOpts = Readonly<{
    interval: string;
    bucketStart?: (timeMs: number) => number;
}>;

/**
 * One fold's outcome: `closed` is non-null exactly on the sample that moved
 * past the previous bucket (that bucket's final bar); `current` is the
 * forming bar afterwards (`null` while it is a closed history seed).
 *
 * @since 1.0
 * @stable
 * @example
 *     import type { BarAggregatorResult } from "@invinite-org/chartlang-alert-runner";
 *     declare const result: BarAggregatorResult;
 *     if (result.closed !== null) void result.closed.close;
 */
export type BarAggregatorResult = Readonly<{ closed: AlertBar | null; current: AlertBar | null }>;

/**
 * Rolls ticks or finer bars (e.g. 1m) into bars of one interval, for feeding
 * `AlertRunner.onBarClose` / `onPreClose`.
 *
 * @since 1.0
 * @stable
 * @example
 *     import { createBarAggregator } from "@invinite-org/chartlang-alert-runner";
 *     const agg = createBarAggregator({ interval: "5m" });
 *     const { closed } = agg.ingestTick(101.5, Date.now(), 10);
 *     void closed;
 */
export type BarAggregator = Readonly<{
    /** Fold one trade / quote sample; `size` adds to volume (default 0). */
    ingestTick(price: number, timeMs: number, size?: number): BarAggregatorResult;
    /** Fold one finer closed bar; a bar at or before the last folded one is ignored. */
    ingestBar(bar: AlertBar): BarAggregatorResult;
    /** Close the forming bar when `nowMs` lies in a later bucket (no sample needed). */
    closeIfDue(nowMs: number): AlertBar | null;
    /** The forming bar, or `null` when there is none or it is a closed history seed. */
    currentBar(): AlertBar | null;
    /** Where {@link BarAggregator.currentBar}'s OHLC came from; `null` exactly when it is `null`. */
    currentBarSource(): AggregatedBarSource | null;
    /** Seed from the last CLOSED history bar so a sample in its bucket does not re-open it. */
    seedFromHistory(bars: ReadonlyArray<AlertBar>): void;
    /**
     * Seed the forming bucket from a provider's forming candle. Merges forward
     * only (open from the provider, high max, low min, volume max, close kept
     * when a live sample set it); refuses (`false`) a candle older than the
     * forming bucket.
     */
    seedFormingBar(bar: AlertBar): boolean;
}>;

type Rolling = {
    bucket: number;
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    source: AggregatedBarSource;
};

/**
 * Build a {@link BarAggregator} for one interval. Bucket boundaries follow
 * `bucketStart`; the emitted bar `time` is the bucket start, except on a
 * bucket a provider candle seeded, where both the replace and the merge arm
 * adopt the provider's own stamp so the forming bar sits on the same grid as
 * the provider's history bars. Samples for a bucket older than the forming
 * one are ignored, so the stream never regresses.
 *
 * @since 1.0
 * @stable
 * @example
 *     import { createBarAggregator } from "@invinite-org/chartlang-alert-runner";
 *     const agg = createBarAggregator({ interval: "1h" });
 *     agg.seedFromHistory(history);
 *     const { closed } = agg.ingestBar(oneMinuteBar);
 *     if (closed !== null) await runner.onBarClose(closed);
 */
export function createBarAggregator(opts: BarAggregatorOpts): BarAggregator {
    const ms = intervalMs(opts.interval);
    const bucketStart = opts.bucketStart ?? ((timeMs: number) => Math.floor(timeMs / ms) * ms);
    let current: Rolling | null = null;
    // `current` is an already-closed history bar: never re-emit or extend it.
    let currentIsSeed = false;
    // Highest bucket closed by `closeIfDue` while nothing is forming.
    let closedThrough = Number.NEGATIVE_INFINITY;
    let lastFineBarTime = Number.NEGATIVE_INFINITY;

    function finite(value: number, what: string): void {
        if (!Number.isFinite(value)) {
            throw new AlertRunnerError("invalid-argument", `${what} must be a finite number`);
        }
    }

    function toBar(rolling: Rolling): AlertBar {
        return {
            time: rolling.time,
            open: rolling.open,
            high: rolling.high,
            low: rolling.low,
            close: rolling.close,
            volume: rolling.volume,
        };
    }

    function view(): AlertBar | null {
        return current === null || currentIsSeed ? null : toBar(current);
    }

    function fold(
        timeMs: number,
        sample: Readonly<{
            open: number;
            high: number;
            low: number;
            close: number;
            volume: number;
        }>,
    ): BarAggregatorResult {
        const bucket = bucketStart(timeMs);
        if (bucket <= closedThrough || (current !== null && bucket < current.bucket)) {
            return { closed: null, current: view() };
        }
        if (current !== null && bucket === current.bucket) {
            if (!currentIsSeed) {
                if (sample.high > current.high) current.high = sample.high;
                if (sample.low < current.low) current.low = sample.low;
                current.close = sample.close;
                current.volume += sample.volume;
                if (current.source === "providerSeed") current.source = "merged";
            }
            return { closed: null, current: view() };
        }
        const closed = current === null || currentIsSeed ? null : toBar(current);
        current = { bucket, time: bucket, ...sample, source: "live" };
        currentIsSeed = false;
        return { closed, current: toBar(current) };
    }

    return Object.freeze({
        ingestTick(price: number, timeMs: number, size = 0): BarAggregatorResult {
            finite(price, "price");
            finite(timeMs, "timeMs");
            finite(size, "size");
            return fold(timeMs, {
                open: price,
                high: price,
                low: price,
                close: price,
                volume: size,
            });
        },
        ingestBar(bar: AlertBar): BarAggregatorResult {
            for (const value of [bar.time, bar.open, bar.high, bar.low, bar.close, bar.volume]) {
                finite(value, "bar field");
            }
            // A replayed finer bar would add its volume twice.
            if (bar.time <= lastFineBarTime) return { closed: null, current: view() };
            lastFineBarTime = bar.time;
            return fold(bar.time, bar);
        },
        closeIfDue(nowMs: number): AlertBar | null {
            finite(nowMs, "nowMs");
            if (current === null || currentIsSeed || bucketStart(nowMs) <= current.bucket)
                return null;
            const closed = toBar(current);
            closedThrough = current.bucket;
            current = null;
            return closed;
        },
        currentBar: view,
        currentBarSource(): AggregatedBarSource | null {
            return current === null || currentIsSeed ? null : current.source;
        },
        seedFromHistory(bars: ReadonlyArray<AlertBar>): void {
            const last = bars[bars.length - 1];
            if (last === undefined) return;
            current = {
                bucket: bucketStart(last.time),
                time: last.time,
                open: last.open,
                high: last.high,
                low: last.low,
                close: last.close,
                volume: last.volume,
                source: "live",
            };
            currentIsSeed = true;
        },
        seedFormingBar(bar: AlertBar): boolean {
            const bucket = bucketStart(bar.time);
            if (bucket <= closedThrough || (current !== null && current.bucket > bucket))
                return false;
            if (current === null || currentIsSeed || current.bucket < bucket) {
                current = {
                    bucket,
                    time: bar.time,
                    open: bar.open,
                    high: bar.high,
                    low: bar.low,
                    close: bar.close,
                    volume: bar.volume,
                    source: "providerSeed",
                };
                currentIsSeed = false;
                return true;
            }
            current.time = bar.time;
            current.open = bar.open;
            if (bar.high > current.high) current.high = bar.high;
            if (bar.low < current.low) current.low = bar.low;
            if (bar.volume > current.volume) current.volume = bar.volume;
            // No live sample is newer than the provider's close on a bucket
            // only providers have touched; a live close is never overwritten.
            if (current.source === "providerSeed") current.close = bar.close;
            if (current.source === "live") current.source = "merged";
            return true;
        },
    });
}
