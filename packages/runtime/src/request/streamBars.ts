// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar } from "@invinite-org/chartlang-core";

import type { RuntimeContext } from "../runtimeContext";
import type { StreamState } from "../streamState";

/**
 * Materialise the bar at ring-buffer `age` from a stream state.
 *
 * @since 0.6
 * @stable
 * @example
 *     // const bar = barFromStream(stream, 0);
 *     const age = 0;
 *     void age;
 */
export function barFromStream(stream: StreamState, age: number): Bar {
    const open = stream.ohlcv.open.at(age);
    const high = stream.ohlcv.high.at(age);
    const low = stream.ohlcv.low.at(age);
    const close = stream.ohlcv.close.at(age);
    return {
        time: stream.ohlcv.time.at(age),
        open,
        high,
        low,
        close,
        volume: stream.ohlcv.volume.at(age),
        symbol: stream.bar.symbol,
        interval: stream.bar.interval,
        hl2: (high + low) / 2,
        hlc3: (high + low + close) / 3,
        ohlc4: (open + high + low + close) / 4,
        hlcc4: (high + low + close + close) / 4,
    };
}

/**
 * Return a stream's bars in ascending time order, memoised per step on
 * `ctx.requestSecurityAscendingBars` (cleared each bar close).
 *
 * @since 0.6
 * @stable
 * @example
 *     // const bars = ascendingBarsFor(ctx, ctx.stream);
 *     const memo = "requestSecurityAscendingBars";
 *     void memo;
 */
export function ascendingBarsFor(ctx: RuntimeContext, stream: StreamState): ReadonlyArray<Bar> {
    const cached = ctx.requestSecurityAscendingBars.get(stream);
    if (cached !== undefined) return cached;
    const bars: Bar[] = [];
    for (let age = stream.ohlcv.close.length - 1; age >= 0; age -= 1) {
        bars.push(barFromStream(stream, age));
    }
    ctx.requestSecurityAscendingBars.set(stream, bars);
    return bars;
}
