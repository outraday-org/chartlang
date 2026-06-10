// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar, BarViewport, Series, StreamSnapshot } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "./ringBuffer.js";
import { makeSeriesView } from "./seriesView.js";

type DerivedBarValues = Readonly<{
    hl2: number;
    hlc3: number;
    ohlc4: number;
    hlcc4: number;
}>;

function deriveBarSources(rawBar: Bar): DerivedBarValues {
    return {
        hl2: (rawBar.high + rawBar.low) / 2,
        hlc3: (rawBar.high + rawBar.low + rawBar.close) / 3,
        ohlc4: (rawBar.open + rawBar.high + rawBar.low + rawBar.close) / 4,
        hlcc4: (rawBar.high + rawBar.low + rawBar.close + rawBar.close) / 4,
    };
}

/**
 * The per-stream OHLCV ring-buffer set. Each field is a
 * `Float64RingBuffer` of identical capacity. Derived sources
 * (`hl2`, `hlc3`, `ohlc4`, `hlcc4`) are pre-computed by Task 6's
 * execution loop alongside the raw OHLCV fields so primitives can
 * read them as plain `Series<number>` without re-computing per
 * lookup.
 *
 * @since 0.1
 * @example
 *     // import { createStreamState } from "@invinite-org/chartlang-runtime";
 *     // const { ohlcv } = createStreamState({
 *     //     interval: "1D",
 *     //     capacity: 5,
 *     //     symbol: "AAPL",
 *     // });
 *     // ohlcv.close.capacity; // 5
 */
export type OhlcvBuffers = {
    readonly time: Float64RingBuffer;
    readonly open: Float64RingBuffer;
    readonly high: Float64RingBuffer;
    readonly low: Float64RingBuffer;
    readonly close: Float64RingBuffer;
    readonly volume: Float64RingBuffer;
    readonly hl2: Float64RingBuffer;
    readonly hlc3: Float64RingBuffer;
    readonly ohlc4: Float64RingBuffer;
    readonly hlcc4: Float64RingBuffer;
};

/**
 * Mutable scalar view of the current bar. Identity stays stable across
 * the run — Task 6's execution loop mutates the fields in place per
 * bar so scripts that destructure `bar` in `compute` keep seeing fresh
 * values without rebinding.
 *
 * `symbol` and `interval` are constant for a given `StreamState`
 * instance; the rest are NaN / 0 before the first bar lands.
 *
 * @since 0.1
 * @example
 *     // import { createStreamState } from "@invinite-org/chartlang-runtime";
 *     // const { bar } = createStreamState({
 *     //     interval: "1D",
 *     //     capacity: 5,
 *     //     symbol: "AAPL",
 *     // });
 *     // bar.symbol;   // "AAPL"
 *     // bar.interval; // "1D"
 *     // bar.close;    // NaN until the first bar
 */
export type BarView = {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    hl2: number;
    hlc3: number;
    ohlc4: number;
    hlcc4: number;
    symbol: string;
    interval: string;
    viewport: BarViewport;
};

/**
 * Everything the runtime owns for a single interval stream — the OHLCV
 * ring buffers, the mutable `BarView`, cached `Series<number>` Proxies
 * for each source field (one identity per buffer for the lifetime of
 * the stream), and a `taSlots` map keyed by compiler-assigned slot id
 * that stateful primitives in Task 7 use as their hidden-state
 * scratchpad.
 *
 * Phase 1 ships single-stream scripts; secondary streams via
 * `request.security` arrive in Phase 5 and reuse this exact shape per
 * interval.
 *
 * @since 0.1
 * @example
 *     // import { createStreamState } from "@invinite-org/chartlang-runtime";
 *     // const stream = createStreamState({
 *     //     interval: "1D",
 *     //     capacity: 21,
 *     //     symbol: "AAPL",
 *     // });
 *     // stream.taSlots.size; // 0
 */
export type StreamState = {
    readonly interval: string;
    readonly ohlcv: OhlcvBuffers;
    readonly bar: BarView;
    readonly seriesViews: {
        readonly time: Series<number>;
        readonly open: Series<number>;
        readonly high: Series<number>;
        readonly low: Series<number>;
        readonly close: Series<number>;
        readonly volume: Series<number>;
        readonly hl2: Series<number>;
        readonly hlc3: Series<number>;
        readonly ohlc4: Series<number>;
        readonly hlcc4: Series<number>;
    };
    readonly taSlots: Map<string, unknown>;
    serialiseSnapshot(): StreamSnapshot;
    restoreFromSnapshot(snapshot: StreamSnapshot): void;
};

const rawBufferKeys = ["time", "open", "high", "low", "close", "volume"] as const;

type RawBufferKey = (typeof rawBufferKeys)[number];

function rawBuffers(ohlcv: OhlcvBuffers): Readonly<Record<RawBufferKey, Float64RingBuffer>> {
    return {
        time: ohlcv.time,
        open: ohlcv.open,
        high: ohlcv.high,
        low: ohlcv.low,
        close: ohlcv.close,
        volume: ohlcv.volume,
    };
}

function valueAt(values: ReadonlyArray<number | null>, index: number): number {
    const value = values[index];
    return value === null || value === undefined ? Number.NaN : value;
}

function recomputeDerivedBuffers(ohlcv: OhlcvBuffers, snapshot: StreamSnapshot): void {
    const { headIndex, filled, buffers } = snapshot;
    const capacity = ohlcv.hl2.capacity;
    const derived = {
        hl2: new Array<number | null>(capacity),
        hlc3: new Array<number | null>(capacity),
        ohlc4: new Array<number | null>(capacity),
        hlcc4: new Array<number | null>(capacity),
    };
    for (let i = 0; i < capacity; i += 1) {
        const high = valueAt(buffers.high, i);
        const low = valueAt(buffers.low, i);
        const open = valueAt(buffers.open, i);
        const close = valueAt(buffers.close, i);
        derived.hl2[i] = Number.isNaN(high) || Number.isNaN(low) ? null : (high + low) / 2;
        derived.hlc3[i] =
            Number.isNaN(high) || Number.isNaN(low) || Number.isNaN(close)
                ? null
                : (high + low + close) / 3;
        derived.ohlc4[i] =
            Number.isNaN(open) || Number.isNaN(high) || Number.isNaN(low) || Number.isNaN(close)
                ? null
                : (open + high + low + close) / 4;
        derived.hlcc4[i] =
            Number.isNaN(high) || Number.isNaN(low) || Number.isNaN(close)
                ? null
                : (high + low + close + close) / 4;
    }
    ohlcv.hl2.restoreFromSnapshotBuffer({ headIndex, filled, values: derived.hl2 });
    ohlcv.hlc3.restoreFromSnapshotBuffer({ headIndex, filled, values: derived.hlc3 });
    ohlcv.ohlc4.restoreFromSnapshotBuffer({ headIndex, filled, values: derived.ohlc4 });
    ohlcv.hlcc4.restoreFromSnapshotBuffer({ headIndex, filled, values: derived.hlcc4 });
}

/**
 * Construct a fresh `StreamState`. The ring-buffer capacity is the
 * compiler-emitted `manifest.maxLookback + 1` per PLAN.md §6.6
 * (caller must enforce `capacity >= 1`). All buffers start empty;
 * the `BarView` starts with `NaN` prices, `0` time and volume, and the
 * supplied `symbol` / `interval` constants. `taSlots` is an empty map.
 *
 * @since 0.1
 * @example
 *     // import { createStreamState } from "@invinite-org/chartlang-runtime";
 *     // const stream = createStreamState({
 *     //     interval: "5m",
 *     //     capacity: 12,
 *     //     symbol: "BTCUSD",
 *     // });
 *     // stream.bar.close;          // NaN
 *     // stream.ohlcv.close.length; // 0
 */
export function createStreamState(args: {
    interval: string;
    capacity: number;
    symbol: string;
}): StreamState {
    const { interval, capacity, symbol } = args;
    const ohlcv: OhlcvBuffers = {
        time: new Float64RingBuffer(capacity),
        open: new Float64RingBuffer(capacity),
        high: new Float64RingBuffer(capacity),
        low: new Float64RingBuffer(capacity),
        close: new Float64RingBuffer(capacity),
        volume: new Float64RingBuffer(capacity),
        hl2: new Float64RingBuffer(capacity),
        hlc3: new Float64RingBuffer(capacity),
        ohlc4: new Float64RingBuffer(capacity),
        hlcc4: new Float64RingBuffer(capacity),
    };
    const bar: BarView = {
        time: 0,
        open: Number.NaN,
        high: Number.NaN,
        low: Number.NaN,
        close: Number.NaN,
        volume: 0,
        hl2: Number.NaN,
        hlc3: Number.NaN,
        ohlc4: Number.NaN,
        hlcc4: Number.NaN,
        symbol,
        interval,
        viewport: Object.freeze({ fromTime: 0, toTime: 0 }),
    };
    const seriesViews: StreamState["seriesViews"] = {
        time: makeSeriesView<number>(ohlcv.time),
        open: makeSeriesView<number>(ohlcv.open),
        high: makeSeriesView<number>(ohlcv.high),
        low: makeSeriesView<number>(ohlcv.low),
        close: makeSeriesView<number>(ohlcv.close),
        volume: makeSeriesView<number>(ohlcv.volume),
        hl2: makeSeriesView<number>(ohlcv.hl2),
        hlc3: makeSeriesView<number>(ohlcv.hlc3),
        ohlc4: makeSeriesView<number>(ohlcv.ohlc4),
        hlcc4: makeSeriesView<number>(ohlcv.hlcc4),
    };
    const stream: StreamState = {
        interval,
        ohlcv,
        bar,
        seriesViews,
        taSlots: new Map<string, unknown>(),
        serialiseSnapshot(): StreamSnapshot {
            const close = ohlcv.close.serialiseSnapshotBuffer();
            const buffers = rawBuffers(ohlcv);
            return Object.freeze({
                interval: bar.interval,
                headIndex: close.headIndex,
                filled: close.filled,
                buffers: Object.freeze({
                    time: buffers.time.serialiseSnapshotBuffer().values,
                    open: buffers.open.serialiseSnapshotBuffer().values,
                    high: buffers.high.serialiseSnapshotBuffer().values,
                    low: buffers.low.serialiseSnapshotBuffer().values,
                    close: close.values,
                    volume: buffers.volume.serialiseSnapshotBuffer().values,
                }),
            });
        },
        restoreFromSnapshot(snapshot: StreamSnapshot): void {
            const buffers = rawBuffers(ohlcv);
            for (const key of rawBufferKeys) {
                buffers[key].restoreFromSnapshotBuffer({
                    headIndex: snapshot.headIndex,
                    filled: snapshot.filled,
                    values: snapshot.buffers[key],
                });
            }
            recomputeDerivedBuffers(ohlcv, snapshot);
            const current = snapshot.headIndex;
            if (snapshot.filled === 0 || current < 0) {
                bar.time = 0;
                bar.open = Number.NaN;
                bar.high = Number.NaN;
                bar.low = Number.NaN;
                bar.close = Number.NaN;
                bar.volume = 0;
                bar.hl2 = Number.NaN;
                bar.hlc3 = Number.NaN;
                bar.ohlc4 = Number.NaN;
                bar.hlcc4 = Number.NaN;
            } else {
                bar.time = valueAt(snapshot.buffers.time, current);
                bar.open = valueAt(snapshot.buffers.open, current);
                bar.high = valueAt(snapshot.buffers.high, current);
                bar.low = valueAt(snapshot.buffers.low, current);
                bar.close = valueAt(snapshot.buffers.close, current);
                bar.volume = valueAt(snapshot.buffers.volume, current);
                bar.hl2 = (bar.high + bar.low) / 2;
                bar.hlc3 = (bar.high + bar.low + bar.close) / 3;
                bar.ohlc4 = (bar.open + bar.high + bar.low + bar.close) / 4;
                bar.hlcc4 = (bar.high + bar.low + bar.close + bar.close) / 4;
            }
            bar.interval = snapshot.interval;
        },
    };
    return stream;
}

/**
 * Append a finalised candle to a stream — extends the OHLCV ring buffers
 * by one bar and writes every field of the mutable `BarView` (including
 * `time` / `open`). Used by both the main close path and secondary
 * stream history.
 *
 * @since 0.5
 * @example
 *     // appendBarToStream(stream, rawBar);
 */
export function appendBarToStream(stream: StreamState, rawBar: Bar): void {
    const values = deriveBarSources(rawBar);
    const { ohlcv, bar } = stream;
    ohlcv.time.append(rawBar.time);
    ohlcv.open.append(rawBar.open);
    ohlcv.high.append(rawBar.high);
    ohlcv.low.append(rawBar.low);
    ohlcv.close.append(rawBar.close);
    ohlcv.volume.append(rawBar.volume);
    ohlcv.hl2.append(values.hl2);
    ohlcv.hlc3.append(values.hlc3);
    ohlcv.ohlc4.append(values.ohlc4);
    ohlcv.hlcc4.append(values.hlcc4);
    bar.time = rawBar.time;
    bar.open = rawBar.open;
    bar.high = rawBar.high;
    bar.low = rawBar.low;
    bar.close = rawBar.close;
    bar.volume = rawBar.volume;
    bar.hl2 = values.hl2;
    bar.hlc3 = values.hlc3;
    bar.ohlc4 = values.ohlc4;
    bar.hlcc4 = values.hlcc4;
    bar.symbol = rawBar.symbol;
    bar.interval = rawBar.interval;
}

/**
 * Replace the head of every OHLCV ring buffer in a stream and write
 * every field of the `BarView`. Used by the secondary-stream replace
 * path — falls back to {@link appendBarToStream} for the empty-buffer
 * case so the first secondary bar arrives correctly even when delivered
 * as a replace.
 *
 * @since 0.5
 * @example
 *     // replaceStreamHead(stream, rawBar);
 */
export function replaceStreamHead(stream: StreamState, rawBar: Bar): void {
    if (stream.ohlcv.close.length === 0) {
        appendBarToStream(stream, rawBar);
        return;
    }
    const values = deriveBarSources(rawBar);
    const { ohlcv, bar } = stream;
    ohlcv.time.replaceHead(rawBar.time);
    ohlcv.open.replaceHead(rawBar.open);
    ohlcv.high.replaceHead(rawBar.high);
    ohlcv.low.replaceHead(rawBar.low);
    ohlcv.close.replaceHead(rawBar.close);
    ohlcv.volume.replaceHead(rawBar.volume);
    ohlcv.hl2.replaceHead(values.hl2);
    ohlcv.hlc3.replaceHead(values.hlc3);
    ohlcv.ohlc4.replaceHead(values.ohlc4);
    ohlcv.hlcc4.replaceHead(values.hlcc4);
    bar.time = rawBar.time;
    bar.open = rawBar.open;
    bar.high = rawBar.high;
    bar.low = rawBar.low;
    bar.close = rawBar.close;
    bar.volume = rawBar.volume;
    bar.hl2 = values.hl2;
    bar.hlc3 = values.hlc3;
    bar.ohlc4 = values.ohlc4;
    bar.hlcc4 = values.hlcc4;
    bar.symbol = rawBar.symbol;
    bar.interval = rawBar.interval;
}

/**
 * Replace the head of the close-side OHLCV ring buffers (close, high,
 * low, volume, derived sources) for a tick within the in-progress bar.
 * `time` and `open` are intentionally untouched — see
 * `packages/runtime/CLAUDE.md` "onBarTick does NOT touch time / open"
 * invariant. Mirrors the partial `BarView` update.
 *
 * @since 0.5
 * @example
 *     // replaceTickHead(stream, tickBar);
 */
export function replaceTickHead(stream: StreamState, rawBar: Bar): void {
    const values = deriveBarSources(rawBar);
    const { ohlcv, bar } = stream;
    ohlcv.close.replaceHead(rawBar.close);
    ohlcv.high.replaceHead(rawBar.high);
    ohlcv.low.replaceHead(rawBar.low);
    ohlcv.volume.replaceHead(rawBar.volume);
    ohlcv.hl2.replaceHead(values.hl2);
    ohlcv.hlc3.replaceHead(values.hlc3);
    ohlcv.ohlc4.replaceHead(values.ohlc4);
    ohlcv.hlcc4.replaceHead(values.hlcc4);
    bar.close = rawBar.close;
    bar.high = rawBar.high;
    bar.low = rawBar.low;
    bar.volume = rawBar.volume;
    bar.hl2 = values.hl2;
    bar.hlc3 = values.hlc3;
    bar.ohlc4 = values.ohlc4;
    bar.hlcc4 = values.hlcc4;
}

/**
 * Refresh the stream's fallback visible range to the latest `limit`
 * bars ending at the current head.
 *
 * @since 0.5
 * @example
 *     // updateFallbackViewport(stream);
 */
export function updateFallbackViewport(stream: StreamState, limit = 100): void {
    const length = stream.ohlcv.time.length;
    if (length === 0) {
        stream.bar.viewport = Object.freeze({ fromTime: 0, toTime: 0 });
        return;
    }
    const lookback = Math.min(length - 1, Math.max(0, limit - 1));
    const fromTime = stream.ohlcv.time.at(lookback);
    const toTime = stream.ohlcv.time.at(0);
    stream.bar.viewport = Object.freeze({
        fromTime: Number.isFinite(fromTime) ? fromTime : toTime,
        toTime,
    });
}
