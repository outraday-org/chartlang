// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import type { Bar, Price, Series, WorldPoint } from "@invinite-org/chartlang-core";

import { resolveBarPoint } from "../barPoint.js";
import type { RuntimeContext } from "../runtimeContext.js";
import type { StreamState } from "../streamState.js";

/**
 * A `Series<string>` whose every head-relative read returns a fixed `value`.
 * Backs the `symbol` / `interval` fields of a materialised {@link SecurityBar}
 * (both the data form's live bar and the expression form's fold bar), where the
 * scalar is constant across history.
 *
 * @since 0.7
 * @stable
 * @example
 *     const s = makeConstantStringSeries("1W");
 *     void s.current; // "1W"
 */
export function makeConstantStringSeries(value: string): Series<string> {
    const target = {
        get current() {
            return value;
        },
        get length() {
            return 0;
        },
    };
    return new Proxy(Object.freeze(target), {
        get(obj, prop, receiver) {
            if (typeof prop === "string") {
                const n = Number(prop);
                if (Number.isInteger(n) && n >= 0) return value;
            }
            return Reflect.get(obj, prop, receiver);
        },
    }) as Series<string>;
}

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
    const barTime = stream.ohlcv.time.at(age);
    return {
        time: barTime,
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
        // Anchored at this materialised bar's own `age`: a negative offset
        // reads `time.at(age - offset)` (further back in this stream's
        // history) so a snapshot bar's offsets stay relative to itself.
        point: (offset: number, price: Price): WorldPoint =>
            resolveBarPoint(stream.ohlcv.time, stream.bar.interval, barTime, offset - age, price),
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
