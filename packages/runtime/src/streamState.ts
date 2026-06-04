// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Series } from "@invinite-org/chartlang-core";

import { Float64RingBuffer } from "./ringBuffer";
import { makeSeriesView } from "./seriesView";

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
};

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
    return {
        interval,
        ohlcv,
        bar,
        seriesViews,
        taSlots: new Map<string, unknown>(),
    };
}
